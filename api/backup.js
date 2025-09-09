'use strict';

/**
 * backup.js — SIN lectura de archivo local
 * - GET  /proxy?url=<json_url>&file=<nombre.json>  -> descarga JSON y lo sube directo a Google Drive
 * - POST /proxy?file=<nombre.json>                 -> usa body JSON y lo sube directo a Google Drive
 * - GET  /health, /debug/env, /debug/file
 *
 * Opcional auto-pull:
 *   ENABLE_SELF_CRON=true
 *   POLL_SECONDS=60
 *   SELF_BASE_URL=https://tu-dominio.vercel.app  (o http://localhost:3000)
 */

try { require('dotenv').config(); } catch (e) {}

const fs = require('fs'); // solo para google.json si existiera; no se usa para leer data
const path = require('path');
const https = require('https');
const http = require('http');
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
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || 'REEMPLAZA_CON_FOLDER_ID';
const DRIVE_ID = process.env.GOOGLE_DRIVE_ID || undefined; // Shared Drive (opcional)
const DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID || undefined; // update por ID (Mi unidad + SA)
const REQUIRE_EXISTING_FILE = String(process.env.REQUIRE_EXISTING_FILE || 'false').toLowerCase() === 'true';

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_FILE_NAME = process.env.PROXY_DEFAULT_FILE_NAME || 'data.json';
const DATA_SOURCE_URL = process.env.DATA_SOURCE_URL || null; // para GET /proxy

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
  // opcional: google.json si existe
  var filePath = path.resolve(process.cwd(), 'google.json');
  if (fs.existsSync(filePath)) {
    var txt = fs.readFileSync(filePath, 'utf8');
    var fromFile = JSON.parse(txt);
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
function commonDriveParamsObj() {
  var base = { supportsAllDrives: true, includeItemsFromAllDrives: true };
  if (DRIVE_ID) { base.corpora = 'drive'; base.driveId = DRIVE_ID; }
  return base;
}

// ---- Fetch JSON (sin node-fetch) ----
function fetchJsonFromUrl(url) {
  return new Promise(function (resolve, reject) {
    try {
      var client = url.startsWith('https') ? https : http;
      var req = client.get(url, { headers: { 'accept': 'application/json' } }, function (res) {
        var status = res.statusCode || 0;
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new Error('HTTP ' + status + ' al obtener ' + url));
        }
        var chunks = [];
        res.on('data', function (d) { chunks.push(d); });
        res.on('end', function () {
          try {
            var txt = Buffer.concat(chunks).toString('utf8');
            var data = JSON.parse(txt);
            resolve(data);
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
    } catch (e2) { reject(e2); }
  });
}

// ---- Helpers JSON/Drive ----
function prettyJson(raw) {
  var parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;
  return JSON.stringify(parsed, null, 2) + '\n';
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function findFileInDrive(drive, fileName, folderId) {
  var safeName = fileName.replace(/'/g, "\\'");
  var params = commonDriveParamsObj();
  params.q = "name='" + safeName + "' and '" + folderId + "' in parents and trashed=false";
  params.fields = 'files(id, name, parents)';
  params.pageSize = 1;
  var res = await drive.files.list(params);
  return res && res.data && res.data.files && res.data.files[0] ? res.data.files[0] : null;
}

async function createOrUpdateJsonFromText(drive, jsonText, baseName, folderId) {
  var content = prettyJson(jsonText);
  var bodyStream = ReadableStream.from([content], { objectMode: false });

  // Modo Mi unidad + SA: actualizar por ID
  if (DRIVE_FILE_ID) {
    var up1 = await drive.files.update({
      fileId: DRIVE_FILE_ID,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true
    });
    return { action: 'updated', fileId: up1.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  }

  // Buscar por nombre + carpeta (crear solo viable con Shared Drive u OAuth2)
  var existing = await findFileInDrive(drive, baseName, folderId);
  if (existing) {
    var up2 = await drive.files.update({
      fileId: existing.id,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true
    });
    return { action: 'updated', fileId: up2.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  } else {
    if (REQUIRE_EXISTING_FILE) {
      var err = new Error('Archivo no encontrado y REQUIRE_EXISTING_FILE=true (no se permite crear)');
      err.code = 404;
      throw err;
    }
    var params = { requestBody: { name: baseName, mimeType: 'application/json', parents: [folderId] },
                   media: { mimeType: 'application/json', body: bodyStream },
                   fields: 'id, name, createdTime',
                   supportsAllDrives: true };
    var cr = await drive.files.create(params);
    return { action: 'created', fileId: cr.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  }
}

// ---- Endpoints ----
app.get('/health', function (_req, res) {
  res.json({ ok: true, time: new Date().toISOString(), folderId: GOOGLE_DRIVE_FOLDER_ID });
});

// GET /proxy -> toma JSON desde URL y lo sube a Drive
app.get('/proxy', async function (req, res) {
  var folderId = GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return res.status(400).json({ success: false, error: 'Falta GOOGLE_DRIVE_FOLDER_ID' });

  var src = String(req.query.url || DATA_SOURCE_URL || '');
  if (!src) return res.status(400).json({ success: false, error: 'Falta url', message: 'Provee ?url= o define DATA_SOURCE_URL' });

  var baseName = String(req.query.file || DEFAULT_FILE_NAME);

  var client;
  try { client = await getDriveClient(); } catch (e) { return respondAuthError(res, e, '/proxy(auth)'); }

  // Si es Service Account en Mi unidad, exige FILE_ID
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
    var payload = await fetchJsonFromUrl(src);
    var result = await createOrUpdateJsonFromText(client.drive, JSON.stringify(payload), baseName, folderId);
    return res.json({ success: true, file: baseName, folderId: folderId, auth_mode: client.mode, as: client.who,
      action: result.action, fileId: result.fileId, sha256: result.sha256, size: result.size, timestamp: new Date().toISOString() });
  } catch (e2) {
    return respondAuthError(res, e2, '/proxy');
  }
});

// POST /proxy -> usa body JSON y lo sube a Drive
app.post('/proxy', async function (req, res) {
  var folderId = GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return res.status(400).json({ success: false, error: 'Falta GOOGLE_DRIVE_FOLDER_ID' });

  var ct = req.headers['content-type'] || '';
  if (ct.indexOf('application/json') === -1) {
    return res.status(400).json({ success: false, error: 'invalid_content_type', message: 'Usa content-type: application/json' });
  }
  var body = req.body;
  if (body === undefined || body === null) {
    return res.status(400).json({ success: false, error: 'invalid_json', message: 'Cuerpo vacío o inválido' });
  }

  var baseName = String(req.query.file || DEFAULT_FILE_NAME);

  var client;
  try { client = await getDriveClient(); } catch (e) { return respondAuthError(res, e, '/proxy(auth)'); }

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
    return res.json({ success: true, file: baseName, folderId: folderId, auth_mode: client.mode, as: client.who,
      action: result.action, fileId: result.fileId, sha256: result.sha256, size: result.size, timestamp: new Date().toISOString() });
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
      folder_id: GOOGLE_DRIVE_FOLDER_ID || null,
      drive_id: DRIVE_ID || null,
      file_id: DRIVE_FILE_ID || null,
      require_existing_file: String(REQUIRE_EXISTING_FILE)
    }
  });
});

app.get('/debug/file', async function (req, res) {
  var fileId = req.query.id || DRIVE_FILE_ID;
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
  var msg =
    (error && error.message) ||
    (error && error.response && error.response.data && error.response.data.error_description) ||
    (error && error.response && error.response.data && error.response.data.error) ||
    (error && error.errors && error.errors[0] && error.errors[0].message) ||
    'Error Google API';
  var code = (error && error.code) || (error && error.response && error.response.status) || undefined;
  return { message: msg, code: code };
}

// ---- Auto-pull opcional (fuera de Vercel) ----
(function maybeStartSelfCron() {
  var enabled = String(process.env.ENABLE_SELF_CRON || 'false').toLowerCase() === 'true';
  if (!enabled) return;
  var every = Number(process.env.POLL_SECONDS || 60) * 1000;
  var base = process.env.SELF_BASE_URL || ('http://localhost:' + PORT);
  setInterval(function () {
    var url = base.replace(/\/+$/, '') + '/proxy';
    var client = url.startsWith('https') ? https : http;
    var req = client.get(url, function (res) { res.resume(); });
    req.on('error', function (_e) {}); // silenciar
  }, every);
})();

// ---- Arranque local / export Vercel ----
if (process.env.VERCEL) {
  module.exports = function handler(req, res) { return app(req, res); };
} else {
  app.listen(PORT, function () {
    console.log('[backup] listening on http://localhost:' + PORT);
    console.log('[backup] Folder: ' + GOOGLE_DRIVE_FOLDER_ID);
    console.log('[backup] MODE: ' + (haveOAuth2Env() ? 'OAuth2' : 'Service Account'));
  });
}