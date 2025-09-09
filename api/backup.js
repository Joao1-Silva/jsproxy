
/**
 * backup.js (robusto)
 * Sube/actualiza uno o varios .json locales a una carpeta de Google Drive.
 * 
 * Cambios clave respecto a la versión original:
 *  - Soporta **dos** modos de autenticación: Service Account (JWT) u OAuth2 con Refresh Token.
 *  - Normaliza las credenciales cuando llegan por variables de entorno (saltos de línea del private_key).
 *  - Manejo de errores mejorado para `invalid_grant` con mensajes de acción concretos.
 *  - Endpoints compatibles: /health, /backup?test=connection, /backup, /backup?file=, /backup/bulk
 * 
 * Variables de entorno soportadas:
 *  Servicio (Service Account):
 *    - GOOGLE_CREDENTIALS_JSON   (JSON completo del service account)
 *    - ó GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
 *    - (Opcional) GOOGLE_IMPERSONATE_EMAIL (si usas domain‑wide delegation)
 * 
 *  OAuth2 (cuenta personal):
 *    - GOOGLE_OAUTH_CLIENT_ID
 *    - GOOGLE_OAUTH_CLIENT_SECRET
 *    - GOOGLE_OAUTH_REFRESH_TOKEN
 *
 *  Generales:
 *    - GOOGLE_DRIVE_FOLDER_ID       (ID de carpeta destino en Drive)
 *    - DATA_PATH  (ruta a un .json puntual; default ./data.json)
 *    - DATA_DIR   (directorio con varios .json para /backup/bulk; default ./)
 *    - PORT       (default 3000)
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const { google } = require('googleapis');
const { GoogleAuth, JWT, OAuth2Client } = require('google-auth-library');

const app = express();

// ---- Config ----
const GOOGLE_DRIVE_CONFIG = {
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || 'REEMPLAZA_CON_FOLDER_ID',
};


const DRIVE_ID = process.env.GOOGLE_DRIVE_ID || undefined; // optional (Shared Drive)

function commonDriveParams() {
  // Flags obligatorios cuando trabajas con Shared Drives
  const base = {
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  };
  if (DRIVE_ID) {
    base.corpora = 'drive';
    base.driveId = DRIVE_ID;
  }
  return base;
}


const DATA_PATH = process.env.DATA_PATH || path.resolve(process.cwd(), 'data.json');
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const PORT = Number(process.env.PORT) || 3000;

const DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID || undefined; // opcional: apunta a un archivo específico
const REQUIRE_EXISTING_FILE = String(process.env.REQUIRE_EXISTING_FILE || 'false').toLowerCase() === 'true';


// ---- Utilidades de credenciales ----
function normalizePrivateKey(key) {
  if (!key) return key;
  // Soporta claves que llegan con '\n' literal
  if (!key.includes('\n')) return key.replace(/\\n/g, '\n');
  return key;
}

function loadServiceAccountFromEnvOrFile() {
  // 1) JSON completo en var de entorno
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    if (creds.private_key) creds.private_key = normalizePrivateKey(creds.private_key);
    return creds;
  }
  // 2) Par email/clave en entorno
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      type: 'service_account',
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
      token_uri: 'https://oauth2.googleapis.com/token',
    };
  }
  // 3) Fichero google.json si existe
  const filePath = path.resolve(process.cwd(), 'google.json');
  if (fs.existsSync(filePath)) {
    const creds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (creds.private_key) creds.private_key = normalizePrivateKey(creds.private_key);
    return creds;
  }
  return null;
}

function haveOAuth2Env() {
  return (
    !!process.env.GOOGLE_OAUTH_CLIENT_ID &&
    !!process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    !!process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  );
}

// ---- Cliente de Drive ----
async function getDriveClient() {
  // Prioridad: OAuth2 (si está presente) -> Service Account (por defecto)
  if (haveOAuth2Env()) {
    const oauth2Client = new OAuth2Client({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    });
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    });
    // Forzar acceso para detectar invalid_grant temprano
    await oauth2Client.getAccessToken();
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    return { drive, mode: 'oauth2', who: 'OAuth2 (refresh token)' };
  }

  const sa = loadServiceAccountFromEnvOrFile();
  if (!sa || !sa.client_email || !sa.private_key) {
    throw new Error(
      'No hay credenciales. Define OAuth2 (CLIENT_ID/SECRET/REFRESH_TOKEN) o un Service Account (GOOGLE_CREDENTIALS_JSON o GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY).'
    );
  }

  const jwtOptions = {
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: process.env.GOOGLE_IMPERSONATE_EMAIL || undefined, // opcional para DWD
  };
  const jwtClient = new JWT(jwtOptions);
  // Valida token (detecta invalid_grant por reloj desfasado o clave rota)
  await jwtClient.authorize();

  const drive = google.drive({ version: 'v3', auth: jwtClient });
  return { drive, mode: 'service_account', who: sa.client_email };
}


// ---- Validación de carpeta destino ----
async function getFolderMeta(drive, folderId) {
  const res = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, driveId, parents, owners, teamDriveId',
    supportsAllDrives: true,
  });
  return res.data;
}

async function validateFolderLocation(drive, folderId) {
  const meta = await getFolderMeta(drive, folderId);
  // Si estamos en Service Account y NO hay driveId => es "Mi unidad" de un usuario (no sirve para SA sin DWD)
  const isSharedDrive = !!(meta.driveId || meta.teamDriveId);
  return { meta, isSharedDrive };
}

// ---- Utilidades Drive ----
async function testGoogleDriveConnection(drive, folderId) {
  // simple list para probar permisos en la carpeta
  await drive.files.list({ ...commonDriveParams(), pageSize: 1, fields: 'files(id, name, parents)', q: `'${folderId}' in parents and trashed=false`, ...commonDriveParams() });
  return true;
}

async function findFileInDrive(drive, fileName, folderId) {
  const res = await drive.files.list({ ...commonDriveParams(),
    q: `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });
  return res.data.files?.[0] || null;
}


// --- PATCH: use streams for uploads to avoid 'part.body.pipe is not a function' ---

const { Readable } = require('stream');

async function createOrUpdateJson(drive, filePath, folderId) {
  const baseName = path.basename(filePath);
  const content = formatJsonForUpload(fs.readFileSync(filePath, 'utf8'));
  const bodyStream = Readable.from([content], { objectMode: false });

  // Ruta directa por ID (evita creación; útil en Mi unidad con SA)
  if (DRIVE_FILE_ID) {
    const updated = await drive.files.update({
      fileId: DRIVE_FILE_ID,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true,
    });
    return { action: 'updated', fileId: updated.data.id };
  }

  // Ruta estándar por nombre + carpeta
  const existing = await findFileInDrive(drive, baseName, folderId);

  if (existing) {
    const updated = await drive.files.update({
      fileId: existing.id,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true,
    });
    return { action: 'updated', fileId: updated.data.id };
  } else {
    if (REQUIRE_EXISTING_FILE) {
      const err = new Error(`Archivo no encontrado en la carpeta destino y REQUIRE_EXISTING_FILE=true: ${baseName}`);
      err.code = 404;
      throw err;
    }
    // create (esto fallará en Mi unidad con SA; sólo funciona en Shared Drives u OAuth)
    const created = await drive.files.create({
      requestBody: {
        name: baseName,
        mimeType: 'application/json',
        parents: [folderId],
      },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, createdTime',
      supportsAllDrives: true,
    });
    return { action: 'created', fileId: created.data.id };
  }
}

// ---- Lectura/validación de JSON local ----
function formatJsonForUpload(raw) {
  // Valida que sea JSON válido; subimos con formato bonito para diff fácil
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2) + '\n';
  } catch (err) {
    // Si no es JSON válido, lo subimos como texto de todos modos (pero advertimos)
    return String(raw);
  }
}

function resolveJsonPathFromQuery(fileQuery) {
  // Permite file=nombre.json relativo a DATA_DIR o ruta absoluta
  if (!fileQuery) return DATA_PATH;
  const p = path.isAbsolute(fileQuery) ? fileQuery : path.join(DATA_DIR, fileQuery);
  return p;
}

// ---- Endpoints ----
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    dataPath: DATA_PATH,
    dataDir: DATA_DIR,
    folderId: GOOGLE_DRIVE_CONFIG.folderId,
  });
});

app.get('/backup', async (req, res) => {
  const folderId = GOOGLE_DRIVE_CONFIG.folderId;
  if (!folderId) {
    return res.status(400).json({
      success: false,
      error: 'Falta GOOGLE_DRIVE_FOLDER_ID',
    });
  }

  let client;
  try {
    client = await getDriveClient();
  } catch (error) {
    return respondAuthError(res, error, '/backup(auth)');
  }

  // Validar ubicación de carpeta
  try {
    if (!DRIVE_FILE_ID) {
      const v = await validateFolderLocation(client.drive, folderId);
      if (client.mode === 'service_account' && !v.isSharedDrive) {
        return res.status(403).json({ success: false, error: 'La carpeta destino NO está en una Unidad compartida. Los Service Accounts no tienen cuota en "Mi unidad". Usa una Shared Drive o cambia a OAuth2, o define GOOGLE_DRIVE_FILE_ID para actualizar un archivo existente compartido contigo.', folderMeta: v.meta, hint: ['Crea una Unidad compartida y agrega el Service Account como Content manager', 'O usa OAuth2 (CLIENT_ID/SECRET/REFRESH_TOKEN) para subir a tu Mi unidad', 'O pre‑crea el archivo y comparte con el Service Account; define GOOGLE_DRIVE_FILE_ID para actualizarlo'] });
      }
    }
  } catch (e) {
    return respondAuthError(res, e, '/backup(validateFolder)');
  }

  // ?test=connection
  if (String(req.query.test || '').toLowerCase() === 'connection') {
    try {
      await testGoogleDriveConnection(client.drive, folderId);
      return res.json({
        success: true,
        message: 'Conexión a Google Drive OK',
        auth_mode: client.mode,
        as: client.who,
        folderId,
      });
    } catch (error) {
      return respondAuthError(res, error, '/backup?test=connection');
    }
  }

  // Subir un solo archivo .json (DATA_PATH o ?file=)
  try {
    const targetPath = resolveJsonPathFromQuery(req.query.file);
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, error: `No existe el archivo: ${targetPath}` });
    }

    const result = await createOrUpdateJson(client.drive, targetPath, folderId);
    return res.json({
      success: true,
      file: path.basename(targetPath),
      action: result.action,
      fileId: result.fileId,
      folderId,
      auth_mode: client.mode,
      as: client.who,
    });
  } catch (error) {
    return respondAuthError(res, error, '/backup');
  }
});

app.get('/backup/bulk', async (_req, res) => {
  const folderId = GOOGLE_DRIVE_CONFIG.folderId;
  if (!folderId) {
    return res.status(400).json({
      success: false,
      error: 'Falta GOOGLE_DRIVE_FOLDER_ID',
    });
  }

  let client;
  try {
    client = await getDriveClient();
  } catch (error) {
    return respondAuthError(res, error, '/backup/bulk(auth)');
  }

  // Validar ubicación también aquí
  try {
    const v = await validateFolderLocation(client.drive, folderId);
    if (client.mode === 'service_account' && !v.isSharedDrive) {
      return res.status(403).json({ success: false, error: 'La carpeta destino NO está en una Unidad compartida. Los Service Accounts no tienen cuota en "Mi unidad". Usa una Shared Drive o cambia a OAuth2.', folderMeta: v.meta });
    }

    const files = fs
      .readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endswith('.json'))
      .map((d) => path.join(DATA_DIR, d.name));

    const results = [];
    for (const filePath of files) {
      try {
        const r = await createOrUpdateJson(client.drive, filePath, folderId);
        results.push({ file: path.basename(filePath), ...r });
      } catch (e) {
        results.push({
          file: path.basename(filePath),
          error: e?.message || String(e),
        });
      }
    }

    return res.json({
      success: true,
      folderId,
      auth_mode: client.mode,
      as: client.who,
      results,
    });
  } catch (error) {
    return respondAuthError(res, error, '/backup/bulk');
  }
});

// ---- Manejo de errores de autenticación ----
function respondAuthError(res, error, endpoint) {
  const raw = extractErrMessage(error);
  const body = {
    success: false,
    error: raw.message,
    code: raw.code,
    hint: buildInvalidGrantHint(raw),
    endpoint,
    timestamp: new Date().toISOString(),
  };
  return res.status(500).json(body);
}

function extractErrMessage(error) {
  const msg =
    error?.message ||
    error?.response?.data?.error_description ||
    error?.response?.data?.error ||
    (error?.errors && error.errors[0]?.message) ||
    'Error de autenticación/Google API';
  const code = error?.code || error?.response?.status || undefined;
  return { message: msg, code };
}

function buildInvalidGrantHint(raw) {
  const msg = (raw?.message || '').toLowerCase();
  if (!/invalid_grant|unauthorized_client|jwt|signature|malformed/i.test(msg)) return undefined;

  // Sugerencias según el modo de auth
  const hints = [];

  if (haveOAuth2Env()) {
    hints.push(
      'OAuth2: Revoca y vuelve a otorgar el permiso para obtener un nuevo refresh_token.',
      'Asegura que el "User Type" del OAuth Consent Screen no limita el refresh (Publishing status: In production).',
      'Verifica que el refresh_token no haya sido revocado manualmente (Security > Third‑party access).',
      'Revisa que el CLIENT_ID/CLIENT_SECRET coincidan con el proyecto donde se generó el refresh_token.',
    );
  } else {
    hints.push(
      'Service Account: rota la clave y vuelve a descargar el .json del Service Account (IAM & Admin > Service Accounts).',
      'Coteja que private_key mantiene saltos de línea; si usas env var, reemplaza \\n por saltos reales.',
      'Comparte la carpeta de destino en Drive con el correo del Service Account con permiso de Editor.',
      'Si usas domain‑wide delegation, define GOOGLE_IMPERSONATE_EMAIL (usuario del dominio) y habilita el scope de Drive.',
      'Asegura que el reloj del servidor no tiene desfasaje (>5 min) (NTP).',
    );
  }

  return hints;
}


app.get('/debug/folder', async (req, res) => {
  const folderId = req.query.id || GOOGLE_DRIVE_CONFIG.folderId;
  let client;
  try {
    client = await getDriveClient();
  } catch (e) {
    return respondAuthError(res, e, '/debug/folder(auth)');
  }
  try {
    const meta = await getFolderMeta(client.drive, folderId);
    return res.json({ success: true, folderId, meta, auth_mode: client.mode });
  } catch (e) {
    return respondAuthError(res, e, '/debug/folder');
  }
});

// ---- Arranque ----
app.listen(PORT, () => {
  console.log(`[backup] listening on http://localhost:${PORT}`);
  console.log(`[backup] Carpeta Drive: ${GOOGLE_DRIVE_CONFIG.folderId}`);
  console.log(`[backup] DATA_PATH: ${DATA_PATH}`);
  console.log(`[backup] DATA_DIR: ${DATA_DIR}`);
});
