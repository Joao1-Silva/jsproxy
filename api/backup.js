// backup.js
// Sube/actualiza uno o varios .json locales a una carpeta de Google Drive.
//
// Endpoints:
//   GET /health
//   GET /backup?test=connection                 -> prueba de conexión
//   GET /backup                                 -> crea/actualiza DATA_PATH (por defecto ./data.json)
//   GET /backup?file=<archivo.json>             -> crea/actualiza ese archivo JSON del cwd o DATA_DIR
//   GET /backup/bulk                            -> crea/actualiza TODOS los .json de DATA_DIR
//
// Env vars (opcional):
//   GOOGLE_CREDENTIALS_JSON  (o GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY)
//   GOOGLE_DRIVE_FOLDER_ID
//   DATA_PATH              (ruta a un .json puntual; default ./data.json)
//   DATA_DIR               (directorio con varios .json para /backup/bulk; default ./)
//   PORT                   (default 3000)

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

const app = express();

const GOOGLE_DRIVE_CONFIG = {
  folderId:
    process.env.GOOGLE_DRIVE_FOLDER_ID ||
    '1iTXbYmxpfFpaycAiKwZdlEqHhqKF2OBG',
  credentialsPath: path.resolve(process.cwd(), 'google.json'),
};

const DATA_PATH = process.env.DATA_PATH || path.resolve(process.cwd(), 'data.json');
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const PORT = Number(process.env.PORT) || 3000;

// ---- Credenciales ----
function loadCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    if (creds.private_key && !creds.private_key.includes('\n')) {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
    return creds;
  }
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    let key = process.env.GOOGLE_PRIVATE_KEY;
    if (!key.includes('\n')) key = key.replace(/\\n/g, '\n');
    return { client_email: process.env.GOOGLE_CLIENT_EMAIL, private_key: key };
  }
  const creds = require(GOOGLE_DRIVE_CONFIG.credentialsPath);
  if (creds.private_key && !creds.private_key.includes('\n')) {
    creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  }
  return creds;
}

function getDriveClient() {
  const credentials = loadCredentials();
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });
  return { drive, credentials };
}

// ---- Utilidades Drive ----
async function testGoogleDriveConnection(drive) {
  await drive.files.list({
    pageSize: 1,
    fields: 'files(id, name)',
    q: `'${GOOGLE_DRIVE_CONFIG.folderId}' in parents and trashed=false`,
  });
  return true;
}

async function findFileInDrive(drive, fileName, folderId) {
  const res = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });
  return res.data.files?.[0] || null;
}

async function uploadOrUpdateJsonFromBuffer(drive, fileName, folderId, buffer) {
  const file = await findFileInDrive(drive, fileName, folderId);
  const media = { mimeType: 'application/json', body: buffer };

  if (file) {
    const upd = await drive.files.update({ fileId: file.id, media });
    return { action: 'updated', fileId: upd.data.id };
  } else {
    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId], mimeType: 'application/json' },
      media,
      fields: 'id',
    });
    return { action: 'created', fileId: created.data.id };
  }
}

// ---- Lectura de .json local ----
function readJsonFileAsBuffer(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe el archivo: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  // Validar que sea JSON válido (pero subimos texto formateado bonito)
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON inválido: ${filePath} -> ${e.message}`);
  }
  const pretty = JSON.stringify(parsed, null, 2);
  return Buffer.from(pretty);
}

function resolveJsonPath(requestedName) {
  // Si viene ruta absoluta, úsala; si es nombre, búscalo en DATA_DIR
  if (!requestedName) return DATA_PATH;
  const p = path.isAbsolute(requestedName)
    ? requestedName
    : path.join(DATA_DIR, requestedName);
  return p;
}

// ---- Rutas ----
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backup', time: new Date().toISOString() });
});

app.get('/backup', async (req, res) => {
  const { drive, credentials } = getDriveClient();

  // ?test=connection
  if (String(req.query.test || '').toLowerCase() === 'connection') {
    try {
      await testGoogleDriveConnection(drive);
      return res.json({
        success: true,
        message: 'Conexión a Google Drive OK',
        service_account: credentials.client_email || '(sin email)',
        folderId: GOOGLE_DRIVE_CONFIG.folderId,
      });
    } catch (error) {
      const msg = error?.message || error?.errors?.[0]?.message || 'Fallo en test de conexión';
      return res.status(500).json({
        success: false,
        error: msg,
        code: error?.code,
        details:
          /invalid_grant|jwt|signature/i.test(msg)
            ? 'Rotar clave del Service Account y asegurar saltos \\n en private_key.'
            : undefined,
        timestamp: new Date().toISOString(),
        endpoint: '/backup?test=connection',
      });
    }
  }

  // Subir un solo archivo .json (DATA_PATH o ?file=)
  try {
    const requested = req.query.file ? String(req.query.file) : null;
    const filePath = resolveJsonPath(requested);
    const buffer = readJsonFileAsBuffer(filePath);
    const fileName = path.basename(filePath);

    const result = await uploadOrUpdateJsonFromBuffer(
      drive,
      fileName,
      GOOGLE_DRIVE_CONFIG.folderId,
      buffer
    );

    return res.json({
      success: true,
      message: result.action === 'created' ? 'Archivo creado' : 'Archivo actualizado',
      file: fileName,
      fileId: result.fileId,
      folderId: GOOGLE_DRIVE_CONFIG.folderId,
      timestamp: new Date().toISOString(),
      endpoint: '/backup',
    });
  } catch (error) {
    const msg = error?.message || error?.errors?.[0]?.message || 'Backup failed';
    return res.status(500).json({
      success: false,
      error: msg,
      code: error?.code,
      details:
        /invalid_grant|jwt|signature/i.test(msg)
          ? 'Rotar clave del Service Account y asegurar saltos \\n en private_key.'
          : undefined,
      timestamp: new Date().toISOString(),
      endpoint: '/backup',
    });
  }
});

// Subir TODOS los .json de DATA_DIR
app.get('/backup/bulk', async (_req, res) => {
  const { drive } = getDriveClient();
  try {
    const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    const jsonFiles = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))
      .map((e) => path.join(DATA_DIR, e.name));

    if (jsonFiles.length === 0) {
      return res.json({
        success: true,
        message: 'No se encontraron .json en DATA_DIR',
        DATA_DIR,
        results: [],
      });
    }

    const results = [];
    for (const filePath of jsonFiles) {
      try {
        const buf = readJsonFileAsBuffer(filePath);
        const fileName = path.basename(filePath);
        const r = await uploadOrUpdateJsonFromBuffer(
          drive,
          fileName,
          GOOGLE_DRIVE_CONFIG.folderId,
          buf
        );
        results.push({
          file: fileName,
          status: r.action,
          fileId: r.fileId,
        });
      } catch (e) {
        results.push({
          file: path.basename(filePath),
          status: 'error',
          error: e.message,
        });
      }
    }

    res.json({
      success: true,
      message: 'Procesamiento en lote completado',
      DATA_DIR,
      folderId: GOOGLE_DRIVE_CONFIG.folderId,
      results,
      timestamp: new Date().toISOString(),
      endpoint: '/backup/bulk',
    });
  } catch (error) {
    const msg = error?.message || 'Bulk backup failed';
    res.status(500).json({
      success: false,
      error: msg,
      timestamp: new Date().toISOString(),
      endpoint: '/backup/bulk',
    });
  }
});

app.listen(PORT, () => {
  console.log(`[backup] listening on http://localhost:${PORT}`);
  console.log(`[backup] Carpeta Drive: ${GOOGLE_DRIVE_CONFIG.folderId}`);
  console.log(`[backup] DATA_PATH: ${DATA_PATH}`);
  console.log(`[backup] DATA_DIR: ${DATA_DIR}`);
});