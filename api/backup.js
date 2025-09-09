const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

// Google Drive configuration
const GOOGLE_DRIVE_CONFIG = {
  folderId: 'root', // Use root folder or specify your folder ID
  credentialsPath: path.join(__dirname, '..', 'google.json')
};

// Service Account authentication
const auth = new google.auth.GoogleAuth({
  keyFile: GOOGLE_DRIVE_CONFIG.credentialsPath,
  scopes: ['https://www.googleapis.com/auth/drive.file']
});

const drive = google.drive({ version: 'v3', auth });

// Local file path - use /tmp for serverless environments like Vercel
const DATA_FILE_PATH = process.env.VERCEL ? '/tmp/data.json' : path.join(__dirname, '..', 'data.json');

/**
 * Fetch data from the proxy endpoint
 */
async function fetchProxyData() {
  try {
    console.log('Fetching data from /proxy endpoint...');
    
    // Try different possible endpoints
    const endpoints = [
      'https://jsproxyflax.vercel.app/proxy/data.json',
      'https://jsproxyflax.vercel.app/proxy',
      'http://api-sermaca.lat/api_aguilera/api/ai-data'
    ];
    
    let lastError;
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const response = await axios.get(endpoint, {
          timeout: 30000
        });
        console.log('✅ Data fetched successfully from:', endpoint);
        return response.data;
      } catch (error) {
        console.log(`❌ Failed to fetch from ${endpoint}:`, error.message);
        lastError = error;
        continue;
      }
    }
    
    throw lastError;
  } catch (error) {
    console.error('❌ Error fetching data from all endpoints:', error.message);
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
 * Upload new file to Google Drive directly from data
 */
async function uploadToGoogleDriveDirectly(data) {
  try {
    console.log('Uploading new file to Google Drive...');
    
    const fileMetadata = {
      name: 'data.json',
      parents: [GOOGLE_DRIVE_CONFIG.folderId]
    };

    const media = {
      mimeType: 'application/json',
      body: JSON.stringify(data, null, 2)
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
 * Update existing file in Google Drive directly from data
 */
async function updateGoogleDriveFileDirectly(fileId, data) {
  try {
    console.log('Updating existing file in Google Drive...');
    
    const media = {
      mimeType: 'application/json',
      body: JSON.stringify(data, null, 2)
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
    
    // Step 2: Upload directly to Google Drive without local file
    const existingFile = await findFileInDrive();
    
    if (existingFile) {
      await updateGoogleDriveFileDirectly(existingFile.id, data);
    } else {
      await uploadToGoogleDriveDirectly(data);
    }
    
    console.log('✅ Backup process completed successfully');
    return { success: true, timestamp: new Date().toISOString() };
    
  } catch (error) {
    console.error('❌ Backup process failed:', error.message);
    return { success: false, error: error.message, timestamp: new Date().toISOString() };
  }
}

/**
 * Test Google Drive connection
 */
async function testGoogleDriveConnection() {
  try {
    const authClient = await auth.getClient();
    const response = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)'
    });
    console.log('✅ Google Drive connection successful');
    return true;
  } catch (error) {
    console.error('❌ Google Drive connection failed:', error.message);
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

    // Check for test mode
    if (req.query.test === 'connection') {
      try {
        await testGoogleDriveConnection();
        return res.json({
          success: true,
          message: 'Google Drive connection test successful',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Google Drive connection test failed: ' + error.message,
          timestamp: new Date().toISOString()
        });
      }
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
module.exports.testGoogleDriveConnection = testGoogleDriveConnection;
