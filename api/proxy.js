const axios = require('axios');

// API endpoint configuration
const API_BASE_URL = 'http://api-sermaca.lat/api_aguilera/api/ai-data';

// Function to process API response for AI consumption
function processForAI(data) {
  try {
    // If data contains messages array, extract and format them
    if (data && Array.isArray(data.messages)) {
      return {
        messageCount: data.messages.length,
        messages: data.messages.map((msg, index) => ({
          id: index + 1,
          content: msg.content || msg.text || msg.message || JSON.stringify(msg),
          timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
          type: msg.type || 'message'
        })),
        summary: `Found ${data.messages.length} messages from the API`
      };
    }
    
    // If data is an array of messages
    if (Array.isArray(data)) {
      return {
        messageCount: data.length,
        messages: data.map((msg, index) => ({
          id: index + 1,
          content: typeof msg === 'string' ? msg : JSON.stringify(msg),
          timestamp: new Date().toISOString(),
          type: 'message'
        })),
        summary: `Found ${data.length} messages from the API`
      };
    }
    
    // For other data structures, provide a general format
    return {
      messageCount: 1,
      messages: [{
        id: 1,
        content: JSON.stringify(data, null, 2),
        timestamp: new Date().toISOString(),
        type: 'data'
      }],
      summary: 'API response formatted for AI consumption'
    };
    
  } catch (error) {
    console.error('Error processing data for AI:', error.message);
    return {
      messageCount: 0,
      messages: [],
      summary: 'Error processing API response',
      error: error.message
    };
  }
}

module.exports = async (req, res) => {
  // Enhanced CORS configuration for ChatGPT compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Additional headers for ChatGPT compatibility
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Ensure JSON content type
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log(`Received ${req.method} proxy request`);
    console.log('User-Agent:', req.headers['user-agent']);
    console.log('Origin:', req.headers.origin);
    
    let response;
    
    if (req.method === 'GET') {
      console.log('Query params:', req.query);
      
      // Forward the GET request to the original API with proper headers
      response = await axios.get(API_BASE_URL, {
        params: req.query,
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; API-Proxy/1.0)',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        }
      });
    } else if (req.method === 'POST') {
      console.log('Request body:', req.body);
      
      // Forward the POST request to the original API with proper headers
      response = await axios.post(API_BASE_URL, req.body, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; API-Proxy/1.0)',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        }
      });
    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        timestamp: new Date().toISOString()
      });
    }

    console.log('API Response status:', response.status);
    console.log('API Response data:', JSON.stringify(response.data, null, 2));

    // Process the JSON response for AI consumption
    const processedData = processForAI(response.data);
    
    res.json({
      success: true,
      originalData: response.data,
      processedForAI: processedData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Proxy error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
