const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API endpoint configuration
const API_BASE_URL = 'http://api-sermaca.lat/api_aguilera/api/ai-data';

// Proxy endpoint
app.get('/proxy', async (req, res) => {
  try {
    console.log('Received proxy request with query params:', req.query);
    
    // Forward the request to the original API
    const response = await axios.get(API_BASE_URL, {
      params: req.query,
      timeout: 10000 // 10 second timeout
    });

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
});

// POST endpoint for more complex queries
app.post('/proxy', async (req, res) => {
  try {
    console.log('Received POST proxy request with body:', req.body);
    
    // Forward the POST request to the original API
    const response = await axios.post(API_BASE_URL, req.body, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

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
    console.error('Proxy POST error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint with usage information
app.get('/', (req, res) => {
  res.json({
    message: 'API Proxy Server',
    endpoints: {
      'GET /proxy': 'Proxy requests to api-sermaca.lat/api_aguilera',
      'POST /proxy': 'Proxy POST requests to api-sermaca.lat/api_aguilera',
      'GET /health': 'Health check endpoint'
    },
    usage: {
      example: `${req.protocol}://${req.get('host')}/proxy?param=value`
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`📡 Proxying requests to: ${API_BASE_URL}`);
  console.log(`🔗 Access at: http://localhost:${PORT}`);
});

module.exports = app;
