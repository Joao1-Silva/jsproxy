const axios = require('axios');

// API endpoint configuration
const API_BASE_URL = 'http://api-sermaca.lat/api_aguilera/api/ai-data';

module.exports = async (req, res) => {
  try {
    // Always set JSON content type first
    res.setHeader('Content-Type', 'application/json');
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).json({ success: true, message: 'CORS preflight handled' });
    }

    // Only allow GET and POST methods
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Only GET and POST are supported.',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Received ${req.method} proxy request`);
    
    let response;
    
    if (req.method === 'GET') {
      console.log('Query params:', req.query);
      
      // Forward the GET request to the original API
      response = await axios.get(API_BASE_URL, {
        params: req.query,
        timeout: 10000 // 10 second timeout
      });
    } else if (req.method === 'POST') {
      console.log('Request body:', req.body);
      
      // Forward the POST request to the original API
      response = await axios.post(API_BASE_URL, req.body, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('API Response status:', response.status);
    console.log('API Response data received from external API');

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const filename = `api-data-${timestamp}.json`;

    // Set headers to trigger file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send the JSON data as a downloadable file
    return res.status(200).send(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('Proxy error:', error.message);
    
    // Always return JSON error response
    const errorResponse = {
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    };

    // Determine appropriate status code based on error type
    let statusCode = 500;
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      statusCode = 503; // Service Unavailable
      errorResponse.error = 'External API is currently unavailable';
    } else if (error.response) {
      statusCode = error.response.status || 500;
      errorResponse.error = `External API error: ${error.response.statusText || error.message}`;
    }
    
    return res.status(statusCode).json(errorResponse);
  }
};
