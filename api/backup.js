'use strict';

/**
 * backup.js — GET /backup toma el JSON de https://jsproxy-flax.vercel.app/proxy
 * (siguiendo redirecciones) y lo sube a Google Drive como data.json (o DATA_FILE_NAME),
 * sin leer disco local.
 *
 * Colócalo en: api/backup.js  (Vercel)
 *
 * ENV mínimas:
 *   GOOGLE_DRIVE_FOLDER_ID
 *   (Mi unidad + Service Account) GOOGLE_DRIVE_FILE_ID + credenciales SA:
 *      - GOOGLE_CREDENTIALS_JSON  o  (GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY)
 *   (Opcional) DATA_FILE_NAME=data.json
 *   (Opcional) GOOGLE_DRIVE_ID (Shared Drive)
 *   (Opcional) REQUIRE_EXISTING_FILE=true
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

// ---- Config fija de proxy ----
const PROXY_URL_FIXED = 'https://jsproxy-flax.vercel.app/proxy';

// ---- Config Drive ----
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || 'REEMPLAZA_CON_FOLDER_ID';
const DRIVE_ID = process.env.GOOGLE_DRIVE_ID || undefined;           // Shared Drive opcional
const DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID || undefined; // Update por ID (Mi unidad + SA)
const REQUIRE_EXISTING_FILE = String(process.env.REQUIRE_EXISTING_FILE || 'false').toLowerCase() === 'true';

// ---- Utils ----
// Fetch JSON con soporte de redirecciones (301/302/303/307/308)
function fetchJsonFromUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const visited = new Set();

    function follow(u, redirects) {
      if (redirects < 0) return reject(new Error('Demasiadas redirecciones'));
      const client = u.startsWith('https') ? https : http;

      const req = client.get(u, { headers: { accept: 'application/json' } }, (res) => {
        const status = res.statusCode || 0;
        const loc = res.headers && res.headers.location;

        if ((status === 301 || status === 302 || status === 303 || status === 307 || status === 308) && loc) {
          const next = new URL(loc, u).toString(); // resuelve relativas
          if (visited.has(next)) { res.resume(); return reject(new Error('Bucle de redirección')); }
          visited.add(next);
          res.resume();
          return follow(next, redirects - 1);
        }

        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new Error('HTTP ' + status + ' desde ' + u));
        }

        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          try {
            const txt = Buffer.concat(chunks).toString('utf8');
            const json = JSON.parse(txt);
            resolve(json);
          } catch (_e) {
            reject(new Error('Respuesta no es JSON válido desde ' + u));
          }
        });
      });

      req.on('error', reject);
    }

    follow(url, maxRedirects);
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
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
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
  const filePath = path.resolve(process.cwd(), 'google.json');
  if (fs.existsSync(filePath)) {
    const txt = fs.readFileSync(filePath, 'utf8');
    const jf = JSON.parse(txt);
    if (jf.private_key) jf.private_key = normalizePrivateKey(jf.private_key);
    return jf;
  }
  return null;
}

// ---- Cliente Drive ----
async function getDriveClient() {
  if (haveOAuth2Env()) {
    const oauth2 = new OAuth2Client({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET
    });
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    await oauth2.getAccessToken();
    return { drive: google.drive({ version: 'v3', auth: oauth2 }), mode: 'oauth2', who: 'OAuth2 (refresh token)' };
  }

  const sa = loadServiceAccountFromEnvOrFile();
  if (!sa || !sa.client_email || !sa.private_key) {
    throw new Error('Faltan credenciales: define OAuth2 o Service Account en variables de entorno.');
  }
  const jwt = new JWT({
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
  const base = { supportsAllDrives: true, includeItemsFromAllDrives: true };
  if (DRIVE_ID) { base.corpora = 'drive'; base.driveId = DRIVE_ID; }
  return base;
}

async function findFileInDrive(drive, fileName, folderId) {
  const safe = fileName.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: "name='" + safe + "' and '" + folderId + "' in parents and trashed=false",
    fields: 'files(id, name, parents)',
    pageSize: 1,
    ...commonDriveParams()
  });
  return res && res.data && res.data.files && res.data.files[0] ? res.data.files[0] : null;
}

function toPretty(jsonText) {
  const str = (typeof jsonText === 'string') ? jsonText : JSON.stringify(jsonText, null, 2);
  return str.endsWith('\n') ? str : (str + '\n');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function createOrUpdateJsonFromText(drive, jsonText, baseName, folderId) {
  const content = toPretty(jsonText);
  const bodyStream = ReadableStream.from([content], { objectMode: false });

  if (DRIVE_FILE_ID) {
    const r1 = await drive.files.update({
      fileId: DRIVE_FILE_ID,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true
    });
    return { action: 'updated', fileId: r1.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  }

  const existing = await findFileInDrive(drive, baseName, folderId);
  if (existing) {
    const r2 = await drive.files.update({
      fileId: existing.id,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true
    });
    return { action: 'updated', fileId: r2.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  } else {
    if (REQUIRE_EXISTING_FILE) {
      const err = new Error('Archivo no encontrado y REQUIRE_EXISTING_FILE=true (no se permite crear)');
      err.code = 404; throw err;
    }
    const r3 = await drive.files.create({
      requestBody: { name: baseName, mimeType: 'application/json', parents: [folderId] },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, createdTime',
      supportsAllDrives: true
    });
    return { action: 'created', fileId: r3.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  }
}

// ---- Endpoint principal: /backup ----
app.get(['/backup','/api/backup'], async function (req, res) {
  try {
    const folderId = GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) return res.status(400).json({ success: false, error: 'Falta GOOGLE_DRIVE_FOLDER_ID' });

    const proxyUrl = PROXY_URL_FIXED; // Fijado al dominio solicitado

    // 1) Obtener JSON de proxy.js (siguiendo redirecciones)
    const payload = await fetchJsonFromUrl(proxyUrl);

    // 2) Subir a Drive como data.json (o nombre custom)
    const fileName = process.env.DATA_FILE_NAME || 'data.json';
    const g = await getDriveClient();

    if (g.mode === 'service_account' && !DRIVE_ID && !DRIVE_FILE_ID) {
      return res.status(403).json({
        success: false,
        error: 'ServiceAccount en Mi unidad requiere GOOGLE_DRIVE_FILE_ID',
        hint: ['Pre-crea data.json y compártelo con el SA (Editor)', 'Define GOOGLE_DRIVE_FILE_ID', 'O usa OAuth2 / Shared Drive']
      });
    }

    const result = await createOrUpdateJsonFromText(g.drive, JSON.stringify(payload), fileName, folderId);

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
    proxyUrl: PROXY_URL_FIXED
  });
});

app.get(['/debug/file','/api/debug/file'], async function (req, res) {
  const fileId = req.query.id || DRIVE_FILE_ID;
  if (!fileId) return res.status(400).json({ success: false, error: 'Falta id (query ?id= o GOOGLE_DRIVE_FILE_ID)' });
  let g;
  try { g = await getDriveClient(); } catch (e) { return res.status(500).json({ success: false, error: e.message, endpoint: '/debug/file(auth)' }); }
  try {
    const meta = await g.drive.files.get({
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
    console.log('[backup] GET /backup -> GET ' + PROXY_URL_FIXED + ' (con redirecciones) -> sube a Drive');
  });
}