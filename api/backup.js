'use strict';

/**
 * backup.js — Vercel-friendly + Node server (sin optional chaining)
 *
 * Endpoints:
 *   - POST /proxy           -> recibe JSON y lo sube DIRECTO a Google Drive (sin disco)
 *   - GET  /backup          -> sube leyendo DATA_PATH (modo clásico/local)
 *   - GET  /backup?test=connection
 *   - GET  /health
 *   - GET  /debug/env
 *   - GET  /debug/file[?id=...]
 *   - GET  /debug/folder[?id=...]
 */

try { require('dotenv').config(); } catch (e) {}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const ReadableStream = require('stream').Readable;
const googleapis = require('googleapis');
const googleAuthLib = require('google-auth-library');

const google = googleapis.google;
const JWT = googleAuthLib.JWT;
const OAuth2Client = googleAuthLib.OAuth2Client;

const app = express();
app.use(express.json({ limit: '2mb' }));

// ---- Config ----
const GOOGLE_DRIVE_CONFIG = {
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || 'REEMPLAZA_CON_FOLDER_ID'
};

const DATA_PATH = process.env.DATA_PATH || path.resolve(process.cwd(), 'data.json');
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const PORT = Number(process.env.PORT || 3000);

// Flags Drive
const DRIVE_ID = process.env.GOOGLE_DRIVE_ID || undefined; // Shared Drive (opcional)
const DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID || undefined; // update por ID (Mi unidad + SA)
const REQUIRE_EXISTING_FILE = String(process.env.REQUIRE_EXISTING_FILE || 'false').toLowerCase() === 'true';

// ---- Credenciales ----
function normalizePrivateKey(key) {
  if (!key) return key;
  if (key.indexOf('\n') === -1) return key.replace(/\\n/g, '\n');
  return key;
}

function loadServiceAccountFromEnvOrFile() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    var creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    if (creds.private_key) creds.private_key = normalizePrivateKey(creds.private_key);
    return creds;
  }
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      type: 'service_account',
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
      token_uri: 'https://oauth2.googleapis.com/token'
    };
  }
  var filePath = path.resolve(process.cwd(), 'google.json');
  if (fs.existsSync(filePath)) {
    var fileTxt = fs.readFileSync(filePath, 'utf8');
    var fromFile = JSON.parse(fileTxt);
    if (fromFile.private_key) fromFile.private_key = normalizePrivateKey(fromFile.private_key);
    return fromFile;
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

// ---- Cliente Drive ----
async function getDriveClient() {
  if (haveOAuth2Env()) {
    var oauth2Client = new OAuth2Client({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET
    });
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    await oauth2Client.getAccessToken();
    return { drive: google.drive({ version: 'v3', auth: oauth2Client }), mode: 'oauth2', who: 'OAuth2 (refresh token)' };
  }

  var sa = loadServiceAccountFromEnvOrFile();
  if (!sa || !sa.client_email || !sa.private_key) {
    throw new Error('Faltan credenciales: define OAuth2 o Service Account en variables de entorno.');
  }
  var jwtClient = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: process.env.GOOGLE_IMPERSONATE_EMAIL || undefined
  });
  await jwtClient.authorize();
  return { drive: google.drive({ version: 'v3', auth: jwtClient }), mode: 'service_account', who: sa.client_email };
}

// ---- Shared Drives helper ----
function commonDriveParams() {
  var base = { supportsAllDrives: true, includeItemsFromAllDrives: true };
  if (DRIVE_ID) { base.corpora = 'drive'; base.driveId = DRIVE_ID; }
  return base;
}

// ---- Utilidades Drive ----
async function testGoogleDriveConnection(drive, folderId) {
  await drive.files.list({ pageSize: 1, fields: 'files(id, name)', q: "'" + folderId + "' in parents and trashed=false", ...commonDriveParams() });
  return true;
}

async function findFileInDrive(drive, fileName, folderId) {
  var safeName = fileName.replace(/'/g, "\\'");
  var res = await drive.files.list({
    q: "name='" + safeName + "' and '" + folderId + "' in parents and trashed=false",
    fields: 'files(id, name, parents)',
    pageSize: 1,
    ...commonDriveParams()
  });
  return res && res.data && res.data.files && res.data.files[0] ? res.data.files[0] : null;
}

async function getFolderMeta(drive, folderId) {
  var res = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, driveId, teamDriveId, owners, parents',
    supportsAllDrives: true
  });
  return res.data;
}

async function validateFolderLocation(drive, folderId) {
  var meta = await getFolderMeta(drive, folderId);
  var isSharedDrive = !!(meta && (meta.driveId || meta.teamDriveId));
  return { meta: meta, isSharedDrive: isSharedDrive };
}

// ---- Helpers JSON ----
function prettyJson(raw) {
  var parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;
  return JSON.stringify(parsed, null, 2) + '\n';
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ---- Subida/actualización desde STRING (sin disco) ----
async function createOrUpdateJsonFromText(drive, jsonText, baseName, folderId) {
  var content = prettyJson(jsonText);
  var bodyStream = ReadableStream.from([content], { objectMode: false });

  // Forzar update por ID (Mi unidad + Service Account)
  if (DRIVE_FILE_ID) {
    var updated = await drive.files.update({
      fileId: DRIVE_FILE_ID,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true
    });
    return { action: 'updated', fileId: updated.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  }

  // Búsqueda por nombre + carpeta
  var existing = await findFileInDrive(drive, baseName, folderId);
  if (existing) {
    var updated2 = await drive.files.update({
      fileId: existing.id,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true
    });
    return { action: 'updated', fileId: updated2.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  } else {
    if (REQUIRE_EXISTING_FILE) {
      var err = new Error('Archivo no encontrado y REQUIRE_EXISTING_FILE=true (no se permite crear)');
      err.code = 404;
      throw err;
    }
    var created = await drive.files.create({
      requestBody: { name: baseName, mimeType: 'application/json', parents: [folderId] },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, createdTime',
      supportsAllDrives: true
    });
    return { action: 'created', fileId: created.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  }
}

// ---- Endpoints ----
app.get('/health', function (_req, res) {
  res.json({ ok: true, time: new Date().toISOString(), dataPath: DATA_PATH, dataDir: DATA_DIR, folderId: GOOGLE_DRIVE_CONFIG.folderId });
});

// /backup clásico (lee archivo local; en Vercel puede fallar por read-only)
app.get('/backup', async function (req, res) {
  var folderId = GOOGLE_DRIVE_CONFIG.folderId;
  if (!folderId) return res.status(400).json({ success: false, error: 'Falta GOOGLE_DRIVE_FOLDER_ID' });

  var client;
  try { client = await getDriveClient(); } catch (e) { return respondAuthError(res, e, '/backup(auth)'); }

  var forceFileId = !!DRIVE_FILE_ID;
  var q = String(req.query.test || '').toLowerCase();
  if (q === 'connection') {
    if (forceFileId) return res.json({ success: true, message: 'OK (modo update por GOOGLE_DRIVE_FILE_ID)', fileId: DRIVE_FILE_ID });
    try {
      await testGoogleDriveConnection(client.drive, folderId);
      return res.json({ success: true, message: 'Conexión OK', auth_mode: client.mode, as: client.who, folderId: folderId });
    } catch (e2) {
      return respondAuthError(res, e2, '/backup?test=connection');
    }
  }

  // Ruta tradicional: lee de DATA_PATH (para compat local)
  try {
    var baseName = path.basename(DATA_PATH);
    var raw = fs.readFileSync(DATA_PATH, 'utf8');
    var result = await createOrUpdateJsonFromText(client.drive, raw, baseName, folderId);
    return res.json({ success: true, file: baseName, folderId: folderId, auth_mode: client.mode, as: client.who, action: result.action, fileId: result.fileId, sha256: result.sha256, size: result.size });
  } catch (e3) {
    return respondAuthError(res, e3, '/backup');
  }
});

// POST /proxy -> usa cuerpo JSON y lo sube DIRECTO a Drive (sin disco)
app.post('/proxy', async function (req, res) {
  var folderId = GOOGLE_DRIVE_CONFIG.folderId;
  if (!folderId) return res.status(400).json({ success: false, error: 'Falta GOOGLE_DRIVE_FOLDER_ID' });

  var ct = req.headers['content-type'] || '';
  if (ct.indexOf('application/json') === -1) {
    return res.status(400).json({ success: false, error: 'invalid_content_type', message: 'Usa content-type: application/json' });
  }
  var body = req.body;
  if (body === undefined || body === null) {
    return res.status(400).json({ success: false, error: 'invalid_json', message: 'Cuerpo vacío o inválido' });
  }

  var baseName = String(req.query.file || 'data.json');

  var client;
  try { client = await getDriveClient(); } catch (e) { return respondAuthError(res, e, '/proxy(auth)'); }

  // Si es Service Account en Mi unidad y no hay FILE_ID -> error explícito
  if (client.mode === 'service_account' && !DRIVE_ID && !DRIVE_FILE_ID) {
    return res.status(403).json({
      success: false,
      error: 'ServiceAccount en Mi unidad requiere GOOGLE_DRIVE_FILE_ID',
      hint: [
        'Pre-crea el archivo en Mi unidad y compártelo con el SA (Editor)',
        'Define GOOGLE_DRIVE_FILE_ID con su ID para actualizar por ID',
        'O usa OAuth2, o Shared Drive en Workspace'
      ]
    });
  }

  try {
    var rawText = JSON.stringify(body, null, 2) + '\n';
    var result = await createOrUpdateJsonFromText(client.drive, rawText, baseName, folderId);
    return res.json({ success: true, file: baseName, folderId: folderId, auth_mode: client.mode, as: client.who, action: result.action, fileId: result.fileId, sha256: result.sha256, size: result.size, timestamp: new Date().toISOString() });
  } catch (e2) {
    return respondAuthError(res, e2, '/proxy');
  }
});

// Debug
app.get('/debug/env', function (_req, res) {
  res.json({
    success: true,
    env_detected: {
      has_service_account_json: !!process.env.GOOGLE_CREDENTIALS_JSON,
      has_service_account_pair: !!(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
      has_oauth2: !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN),
      folder_id: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
      drive_id: process.env.GOOGLE_DRIVE_ID || null,
      file_id: process.env.GOOGLE_DRIVE_FILE_ID || null,
      require_existing_file: String(process.env.REQUIRE_EXISTING_FILE || 'false').toLowerCase()
    }
  });
});

app.get('/debug/file', async function (req, res) {
  var fileId = req.query.id || process.env.GOOGLE_DRIVE_FILE_ID;
  if (!fileId) return res.status(400).json({ success: false, error: 'Falta id (query ?id= o GOOGLE_DRIVE_FILE_ID)' });
  var client;
  try { client = await getDriveClient(); } catch (e) { return respondAuthError(res, e, '/debug/file(auth)'); }
  try {
    var meta = await client.drive.files.get({
      fileId: fileId,
      fields: 'id, name, owners, permissions, parents, driveId, teamDriveId, mimeType, modifiedTime',
      supportsAllDrives: true
    });
    return res.json({ success: true, fileId: fileId, meta: meta.data, auth_mode: client.mode });
  } catch (e2) {
    return respondAuthError(res, e2, '/debug/file');
  }
});

app.get('/debug/folder', async function (req, res) {
  var folderId = req.query.id || GOOGLE_DRIVE_CONFIG.folderId;
  var client;
  try { client = await getDriveClient(); } catch (e) { return respondAuthError(res, e, '/debug/folder(auth)'); }
  try {
    var meta = await getFolderMeta(client.drive, folderId);
    return res.json({ success: true, folderId: folderId, meta: meta, auth_mode: client.mode });
  } catch (e2) {
    return respondAuthError(res, e2, '/debug/folder');
  }
});

// ---- Errores ----
function respondAuthError(res, error, endpoint) {
  var msg = extractErrMessage(error);
  var body = {
    success: false,
    error: msg.message,
    code: msg.code,
    endpoint: endpoint,
    timestamp: new Date().toISOString()
  };
  var lower = (msg.message || '').toLowerCase();
  if (lower.indexOf('invalid_grant') !== -1 || lower.indexOf('unauthorized_client') !== -1 || lower.indexOf('jwt') !== -1 || lower.indexOf('malformed') !== -1 || lower.indexOf('signature') !== -1) {
    body.hint = haveOAuth2Env()
      ? [
          'OAuth2: vuelve a generar el refresh_token (revoca y consiente de nuevo)',
          'Verifica CLIENT_ID/SECRET del mismo proyecto',
          'Consent Screen en producción'
        ]
      : [
          'Service Account: rota la private_key y vuelve a descargar el JSON',
          'Asegura saltos \\n en la PRIVATE_KEY si usas .env',
          'Comparte la carpeta/archivo con el SA (Editor)',
          'Si es Mi unidad con SA: define GOOGLE_DRIVE_FILE_ID',
          'Sincroniza reloj del servidor (NTP)'
        ];
  }
  return res.status(500).json(body);
}

function extractErrMessage(error) {
  var msg = (error && error.message) ||
            (error && error.response && error.response.data && error.response.data.error_description) ||
            (error && error.response && error.response.data && error.response.data.error) ||
            (error && error.errors && error.errors[0] && error.errors[0].message) ||
            'Error Google API';
  var code = (error && error.code) || (error && error.response && error.response.status) || undefined;
  return { message: msg, code: code };
}

// ---- Arranque local / export Vercel ----
if (process.env.VERCEL) {
  module.exports = function handler(req, res) { return app(req, res); };
} else {
  app.listen(PORT, function () {
    console.log('[backup] listening on http://localhost:' + PORT);
    console.log('[backup] Folder: ' + GOOGLE_DRIVE_CONFIG.folderId);
    console.log('[backup] MODE: ' + (haveOAuth2Env() ? 'OAuth2' : 'Service Account'));
  });
}