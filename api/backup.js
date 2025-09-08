const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

// Google Drive configuration
const GOOGLE_DRIVE_CONFIG = {
  clientId: '68215580371-lf12sgaa8e016pcqtoh164qc49lgocl6.apps.googleusercontent.com',
  clientSecret: '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',
  apiKey: 'AIzaSyDzZikcQ1Gr-1G6Bc2jd1vXx0upued-1Fk',
  redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
  folderId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' // Replace with your folder ID
};

// OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_DRIVE_CONFIG.clientId,
  GOOGLE_DRIVE_CONFIG.clientSecret,
  GOOGLE_DRIVE_CONFIG.redirectUri
);

// Set credentials (you'll need to get refresh token first)
oauth2Client.setCredentials({
  refresh_token: 'YOUR_REFRESH_TOKEN_HERE' // You'll need to generate this
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Local file path
const DATA_FILE_PATH = path.join(__dirname, '..', 'data.json');

/**
 * Fetch data from the proxy endpoint
 */
async function fetchProxyData() {
  try {
    console.log('Fetching data from /proxy endpoint...');
    const response = await axios.get('http://localhost:3000/proxy/data.json', {
      timeout: 30000
    });
    console.log('✅ Data fetched successfully from proxy');
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching data from proxy:', error.message);
    throw error;
  }
}

/**
 * Save data to local JSON file
 */
async function saveLocalFile(data) {
  try {
    console.log('Saving data to local file...');
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    console.log('✅ Data saved to local file:', DATA_FILE_PATH);
  } catch (error) {
    console.error('❌ Error saving local file:', error.message);
    throw error;
  }
}

/**
 * Check if file exists in Google Drive folder
 */
async function findFileInDrive() {
  try {
    const response = await drive.files.list({
      q: `name='data.json' and parents in '${GOOGLE_DRIVE_CONFIG.folderId}' and trashed=false`,
      fields: 'files(id, name)'
    });
    
    return response.data.files.length > 0 ? response.data.files[0] : null;
  } catch (error) {
    console.error('❌ Error searching for file in Google Drive:', error.message);
    throw error;
  }
}

/**
 * Upload new file to Google Drive
 */
async function uploadToGoogleDrive() {
  try {
    console.log('Uploading new file to Google Drive...');
    
    const fileMetadata = {
      name: 'data.json',
      parents: [GOOGLE_DRIVE_CONFIG.folderId]
    };

    const media = {
      mimeType: 'application/json',
      body: await fs.readFile(DATA_FILE_PATH)
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    console.log('✅ File uploaded to Google Drive with ID:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('❌ Error uploading to Google Drive:', error.message);
    throw error;
  }
}

/**
 * Update existing file in Google Drive
 */
async function updateGoogleDriveFile(fileId) {
  try {
    console.log('Updating existing file in Google Drive...');
    
    const media = {
      mimeType: 'application/json',
      body: await fs.readFile(DATA_FILE_PATH)
    };

    const response = await drive.files.update({
      fileId: fileId,
      media: media
    });

    console.log('✅ File updated in Google Drive:', fileId);
    return response.data;
  } catch (error) {
    console.error('❌ Error updating Google Drive file:', error.message);
    throw error;
  }
}

/**
 * Main backup process
 */
async function performBackup() {
  try {
    console.log('🔄 Starting backup process...');
    
    // Step 1: Fetch data from proxy
    const data = await fetchProxyData();
    
    // Step 2: Save to local file
    await saveLocalFile(data);
    
    // Step 3: Check if file exists in Google Drive
    const existingFile = await findFileInDrive();
    
    // Step 4: Upload or update in Google Drive
    if (existingFile) {
      await updateGoogleDriveFile(existingFile.id);
    } else {
      await uploadToGoogleDrive();
    }
    
    console.log('✅ Backup process completed successfully');
    return { success: true, timestamp: new Date().toISOString() };
    
  } catch (error) {
    console.error('❌ Backup process failed:', error.message);
    return { success: false, error: error.message, timestamp: new Date().toISOString() };
  }
}

/**
 * Initialize OAuth2 (run this once to get refresh token)
 */
function getAuthUrl() {
  const scopes = ['https://www.googleapis.com/auth/drive.file'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes
  });
  return url;
}

/**
 * Exchange authorization code for tokens (run this once)
 */
async function getTokens(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    console.log('Refresh Token:', tokens.refresh_token);
    return tokens;
  } catch (error) {
    console.error('Error getting tokens:', error.message);
    throw error;
  }
}

// Express endpoint
module.exports = async (req, res) => {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Only GET is supported.',
        timestamp: new Date().toISOString()
      });
    }

    // Check for setup mode
    if (req.query.setup === 'auth') {
      const authUrl = getAuthUrl();
      return res.json({
        success: true,
        message: 'Visit this URL to authorize the application',
        authUrl: authUrl,
        instructions: 'After authorization, call /backup?setup=token&code=YOUR_CODE'
      });
    }

    if (req.query.setup === 'token' && req.query.code) {
      const tokens = await getTokens(req.query.code);
      return res.json({
        success: true,
        message: 'Tokens obtained successfully',
        refreshToken: tokens.refresh_token,
        instructions: 'Update the refresh_token in the code with this value'
      });
    }

    // Perform backup
    const result = await performBackup();
    
    return res.status(result.success ? 200 : 500).json({
      ...result,
      endpoint: '/backup',
      message: result.success ? 'Backup completed successfully' : 'Backup failed'
    });

  } catch (error) {
    console.error('Backup endpoint error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Export functions for timer use
module.exports.performBackup = performBackup;
module.exports.getAuthUrl = getAuthUrl;
module.exports.getTokens = getTokens;
