'use strict';

/**
 * backup.js — /backup toma el JSON de proxy.js y lo sube a Google Drive (sin leer disco).
 *
 * Flujo: GET /backup  ->  GET a /proxy (proxy.js)  ->  sube ese JSON a data.json en Drive.
 *
 * ENV mínimas:
 *   GOOGLE_DRIVE_FOLDER_ID     (OBLIGATORIA)
 *   GOOGLE_DRIVE_FILE_ID       (Mi unidad + Service Account: ID del data.json precreado y compartido con el SA)
 *   Credenciales:
 *     - Service Account: GOOGLE_CREDENTIALS_JSON  o  (GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY)
 *     - Alternativa OAuth2: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN
 *
 * Dónde está proxy.js (fuente del JSON):
 *   PROXY_URL=https://tu-dominio/proxy         (recomendado)
 *   o SELF_BASE_URL=https://tu-dominio         -> usa SELF_BASE_URL + "/proxy"
 *   (opcional en runtime) ?proxy=https://.../proxy
 *
 * (Opcionales)
 *   DATA_FILE_NAME=data.json
 *   GOOGLE_DRIVE_ID              (Shared Drive)
 *   REQUIRE_EXISTING_FILE=true   (no crear por nombre si no existe)
 */

try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs'); // solo por si usas google.json; no leemos data local
const crypto = require('crypto');
const ReadableStream = require('stream').Readable;

const { google } = require('googleapis');
const { JWT, OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// ---- Config Drive ----
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || 'REEMPLAZA_CON_FOLDER_ID';
const DRIVE_ID = process.env.GOOGLE_DRIVE_ID || undefined;           // Shared Drive opcional
const DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID || undefined; // Update por ID (Mi unidad + SA)
const REQUIRE_EXISTING_FILE = String(process.env.REQUIRE_EXISTING_FILE || 'false').toLowerCase() === 'true';

// ---- Detectar URL de /proxy (proxy.js) ----
function getProxyUrl(req) {
  var fromQuery = (req && req.query && req.query.proxy) ? String(req.query.proxy) : '';
  if (fromQuery) return fromQuery.replace(/\/+$/, '');
  var direct = (process.env.PROXY_URL || '').trim();  // e.g., https://foo.vercel.app/proxy
  var self = (process.env.SELF_BASE_URL || '').trim(); // e.g., https://bar.vercel.app
  if (direct) return direct.replace(/\/+$/, '');
  if (self) return (self.replace(/\/+$/, '') + '/proxy');
  return '';
}

// ---- Utils ----
function fetchJsonFromUrl(url) {
  return new Promise(function (resolve, reject) {
    try {
      var client = url.startsWith('https') ? https : http;
      var req = client.get(url, { headers: { accept: 'application/json' } }, function (res) {
        var ok = res.statusCode >= 200 && res.statusCode < 300;
        if (!ok) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' al obtener ' + url)); }
        var chunks = [];
        res.on('data', function (d) { chunks.push(d); });
        res.on('end', function () {
          try {
            var txt = Buffer.concat(chunks).toString('utf8');
            resolve(JSON.parse(txt));
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
    } catch (e) { reject(e); }
  });
}

function normalizePrivateKey(key) {
  if (!key) return key;
  if (key.indexOf('\n') === -1) return key.replace(/\\n/g, '\n');
  return key;
}

function haveOAuth2Env() {
  return !!process.env.GOOGLE_OAUTH_CLIENT_ID &&
         !!process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
         !!process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
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
    var txt = fs.readFileSync(filePath, 'utf8');
    var jf = JSON.parse(txt);
    if (jf.private_key) jf.private_key = normalizePrivateKey(jf.private_key);
    return jf;
  }
  return null;
}

// ---- Cliente Drive ----
async function getDriveClient() {
  if (haveOAuth2Env()) {
    var oauth2 = new OAuth2Client({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET
    });
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    await oauth2.getAccessToken();
    return { drive: google.drive({ version: 'v3', auth: oauth2 }), mode: 'oauth2', who: 'OAuth2 (refresh token)' };
  }

  var sa = loadServiceAccountFromEnvOrFile();
  if (!sa || !sa.client_email || !sa.private_key) {
    throw new Error('Faltan credenciales: define OAuth2 o Service Account en variables de entorno.');
  }
  var jwt = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: process.env.GOOGLE_IMPERSONATE_EMAIL || undefined
  });
  await jwt.authorize();
  return { drive: google.drive({ version: 'v3', auth: jwt }), mode: 'service_account', who: sa.client_email };
}

// ---- Helpers Drive ----
function commonDriveParams() {
  var base = { supportsAllDrives: true, includeItemsFromAllDrives: true };
  if (DRIVE_ID) { base.corpora = 'drive'; base.driveId = DRIVE_ID; }
  return base;
}

async function findFileInDrive(drive, fileName, folderId) {
  var safe = fileName.replace(/'/g, "\\'");
  var params = commonDriveParams();
  params.q = "name='" + safe + "' and '" + folderId + "' in parents and trashed=false";
  params.fields = 'files(id, name, parents)';
  params.pageSize = 1;
  var res = await drive.files.list(params);
  return res && res.data && res.data.files && res.data.files[0] ? res.data.files[0] : null;
}

function toPretty(jsonText) {
  var str = (typeof jsonText === 'string') ? jsonText : JSON.stringify(jsonText, null, 2);
  return str.endsWith('\n') ? str : (str + '\n');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function createOrUpdateJsonFromText(drive, jsonText, baseName, folderId) {
  var content = toPretty(jsonText);
  var bodyStream = ReadableStream.from([content], { objectMode: false });

  if (DRIVE_FILE_ID) {
    var r1 = await drive.files.update({
      fileId: DRIVE_FILE_ID,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true
    });
    return { action: 'updated', fileId: r1.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  }

  var existing = await findFileInDrive(drive, baseName, folderId);
  if (existing) {
    var r2 = await drive.files.update({
      fileId: existing.id,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true
    });
    return { action: 'updated', fileId: r2.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  } else {
    if (REQUIRE_EXISTING_FILE) {
      var err = new Error('Archivo no encontrado y REQUIRE_EXISTING_FILE=true (no se permite crear)');
      err.code = 404; throw err;
    }
    var params = {
      requestBody: { name: baseName, mimeType: 'application/json', parents: [folderId] },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, createdTime',
      supportsAllDrives: true
    };
    var r3 = await drive.files.create(params);
    return { action: 'created', fileId: r3.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  }
}

// ---- Endpoint principal: /backup ----
app.get(['/backup','/api/backup'], async function (req, res) {
  try {
    var folderId = GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) return res.status(400).json({ success: false, error: 'Falta GOOGLE_DRIVE_FOLDER_ID' });

    var base = getProxyUrl(req);
    if (!base) return res.status(400).json({ success: false, error: 'Falta PROXY_URL o SELF_BASE_URL', message: 'Define PROXY_URL=https://.../proxy o SELF_BASE_URL=https://este-servicio' });

    var proxyUrl = base.endsWith('/proxy') ? base : (base + '/proxy');

    // 1) Obtener JSON de proxy.js
    var payload = await fetchJsonFromUrl(proxyUrl);

    // 2) Subir a Drive como data.json (o nombre custom)
    var fileName = process.env.DATA_FILE_NAME || 'data.json';
    var g = await getDriveClient();

    if (g.mode === 'service_account' && !DRIVE_ID && !DRIVE_FILE_ID) {
      return res.status(403).json({
        success: false,
        error: 'ServiceAccount en Mi unidad requiere GOOGLE_DRIVE_FILE_ID',
        hint: ['Pre-crea data.json y compártelo con el SA (Editor)', 'Define GOOGLE_DRIVE_FILE_ID', 'O usa OAuth2 / Shared Drive']
      });
    }

    var result = await createOrUpdateJsonFromText(g.drive, JSON.stringify(payload), fileName, folderId);

    return res.json({
      success: true,
      file: fileName,
      action: result.action,
      fileId: result.fileId,
      sha256: result.sha256,
      size: result.size,
      source: proxyUrl,
      folderId: folderId,
      auth_mode: g.mode,
      as: g.who,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || 'error', endpoint: '/backup' });
  }
});

// ---- Health & Debug ----
app.get(['/health','/api/health'], function (_req, res) {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    folderId: GOOGLE_DRIVE_FOLDER_ID,
    proxyUrl: process.env.PROXY_URL || (process.env.SELF_BASE_URL ? (process.env.SELF_BASE_URL.replace(/\/+$/, '') + '/proxy') : null)
  });
});

app.get(['/debug/file','/api/debug/file'], async function (req, res) {
  var fileId = req.query.id || DRIVE_FILE_ID;
  if (!fileId) return res.status(400).json({ success: false, error: 'Falta id (query ?id= o GOOGLE_DRIVE_FILE_ID)' });
  var g;
  try { g = await getDriveClient(); } catch (e) { return res.status(500).json({ success: false, error: e.message, endpoint: '/debug/file(auth)' }); }
  try {
    var meta = await g.drive.files.get({
      fileId: fileId,
      fields: 'id, name, owners, permissions, parents, driveId, teamDriveId, mimeType, modifiedTime',
      supportsAllDrives: true
    });
    return res.json({ success: true, fileId: fileId, meta: meta.data, auth_mode: g.mode });
  } catch (e2) {
    return res.status(500).json({ success: false, error: e2.message, endpoint: '/debug/file' });
  }
});

// ---- Export Vercel / Local ----
if (process.env.VERCEL) {
  module.exports = function (req, res) { return app(req, res); };
} else {
  app.listen(PORT, function () {
    console.log('[backup] listening on http://localhost:' + PORT);
    console.log('[backup] GET /backup -> GET /proxy -> sube a Drive');
  });
}