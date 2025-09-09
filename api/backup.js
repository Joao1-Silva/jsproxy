'use strict';

/**
 * backup.js — Cron que GETea /proxy y sube ese JSON a Google Drive (sin leer disco)
 * Colócalo como: api/backup.js  (Vercel)
 */

try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs'); // solo por si usas google.json; no lee data local
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

// ---- Detección URL de /proxy ----
function getProxyUrl() {
  const direct = (process.env.PROXY_URL || '').trim();       // e.g., https://foo.vercel.app/proxy
  const self = (process.env.SELF_BASE_URL || '').trim();     // e.g., https://bar.vercel.app
  if (direct) return direct.replace(/\/+$/, '');
  if (self) return (self.replace(/\/+$/, '') + '/proxy');
  return '';
}

// ---- Utils ----
function fetchJsonFromUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { accept: 'application/json' } }, (res) => {
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      if (!ok) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' al obtener ' + url)); }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try {
          const txt = Buffer.concat(chunks).toString('utf8');
          resolve(JSON.parse(txt));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

function normalizePrivateKey(key) {
  if (!key) return key;
  if (key.indexOf('\\n') !== -1 && key.indexOf('\n') === -1) return key.replace(/\\n/g, '\n');
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
    const r = await drive.files.update({
      fileId: DRIVE_FILE_ID,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true
    });
    return { action: 'updated', fileId: r.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  }

  const existing = await findFileInDrive(drive, baseName, folderId);
  if (existing) {
    const r = await drive.files.update({
      fileId: existing.id,
      requestBody: { name: baseName, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true
    });
    return { action: 'updated', fileId: r.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  } else {
    if (REQUIRE_EXISTING_FILE) {
      const err = new Error('Archivo no encontrado y REQUIRE_EXISTING_FILE=true (no se permite crear)');
      err.code = 404; throw err;
    }
    const r = await drive.files.create({
      requestBody: { name: baseName, mimeType: 'application/json', parents: [folderId] },
      media: { mimeType: 'application/json', body: bodyStream },
      fields: 'id, name, createdTime',
      supportsAllDrives: true
    });
    return { action: 'created', fileId: r.data.id, sha256: sha256(content), size: Buffer.byteLength(content) };
  }
}

// ---- Health ----
app.get(['/health','/api/backup/health','/api/health'], function (_req, res) {
  res.json({ ok: true, time: new Date().toISOString(), folderId: GOOGLE_DRIVE_FOLDER_ID });
});

// ---- Cron endpoint (con alias para Vercel paths) ----
app.get(['/cron/backup','/api/backup/cron/backup','/api/cron/backup'], async function (req, res) {
  try {
    const folderId = GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) return res.status(400).json({ success: false, error: 'Falta GOOGLE_DRIVE_FOLDER_ID' });

    const base = req.query.proxy ? String(req.query.proxy) : getProxyUrl();
    if (!base) return res.status(400).json({ success: false, error: 'Falta PROXY_URL o SELF_BASE_URL', message: 'Define PROXY_URL=https://.../proxy o SELF_BASE_URL=https://este-servicio' });

    const proxyUrl = base.replace(/\/+$/, '').endsWith('/proxy') ? base.replace(/\/+$/, '') : (base.replace(/\/+$/, '') + '/proxy');

    // 1) Obtener JSON desde /proxy
    const payload = await fetchJsonFromUrl(proxyUrl);

    // 2) Subir a Drive
    const { drive, mode, who } = await getDriveClient();
    if (mode === 'service_account' && !DRIVE_ID && !DRIVE_FILE_ID) {
      return res.status(403).json({
        success: false,
        error: 'ServiceAccount en Mi unidad requiere GOOGLE_DRIVE_FILE_ID',
        hint: ['Pre-crea data.json y compártelo con el SA (Editor)', 'Define GOOGLE_DRIVE_FILE_ID', 'O usa OAuth2 / Shared Drive']
      });
    }

    const fileName = process.env.DATA_FILE_NAME || 'data.json';
    const result = await createOrUpdateJsonFromText(drive, JSON.stringify(payload), fileName, folderId);

    return res.json({
      success: true,
      file: fileName,
      action: result.action,
      fileId: result.fileId,
      sha256: result.sha256,
      size: result.size,
      source: proxyUrl,
      folderId: folderId,
      auth_mode: mode,
      as: who,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || 'error', endpoint: '/cron/backup' });
  }
});

// ---- Export Vercel / Local ----
if (process.env.VERCEL) {
  module.exports = (req, res) => app(req, res);
} else {
  app.listen(PORT, () => {
    console.log('[backup] listening on http://localhost:' + PORT);
    console.log('[backup] Cron endpoint: GET /cron/backup');
  });
}