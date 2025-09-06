// Vercel API handler that always returns JSON
// Handles all errors gracefully and never returns HTML or 500 errors

module.exports = async (req, res) => {
  try {
    // Always set JSON content type first
    res.setHeader('Content-Type', 'application/json');
    
    // Enable CORS for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).json({ 
        success: true, 
        message: 'CORS preflight handled' 
      });
    }

    // Only allow GET and POST methods
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Only GET and POST are supported.'
      });
    }

    // Extract query parameters with defaults
    const query = req.query.query || 'sin_query';
    const limit = parseInt(req.query.limit) || 10;

    // Validate limit parameter
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter. Must be a number between 1 and 1000.'
      });
    }

    // Log the request for debugging
    console.log(`${req.method} request received:`, {
      query: req.query,
      body: req.method === 'POST' ? req.body : undefined
    });

    // Simulate some processing time (optional)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Return successful response
    return res.status(200).json({
      success: true,
      query: query,
      limit: limit,
      timestamp: new Date().toISOString(),
      method: req.method,
      // Include additional useful information
      requestId: Math.random().toString(36).substr(2, 9),
      serverTime: Date.now()
    });

  } catch (error) {
    // Log the error for debugging
    console.error('API Error:', error);

    // Always return JSON error response, never let Vercel return HTML
    const errorResponse = {
      success: false,
      error: error.message || 'Internal server error occurred'
    };

    // Add additional error context if available
    if (error.code) {
      errorResponse.errorCode = error.code;
    }

    // Return appropriate status code
    let statusCode = 500;
    if (error.name === 'ValidationError') {
      statusCode = 400;
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
    }

    return res.status(statusCode).json(errorResponse);
  }
};
