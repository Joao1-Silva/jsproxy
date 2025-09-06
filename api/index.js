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

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'https';

  res.json({
    message: 'API Proxy Server - Vercel Deployment',
    endpoints: {
      'GET /proxy': 'Proxy requests to api-sermaca.lat/api_aguilera',
      'POST /proxy': 'Proxy POST requests to api-sermaca.lat/api_aguilera',
      'GET /health': 'Health check endpoint'
    },
    usage: {
      example: `${protocol}://${host}/proxy?param=value`
    },
    deployment: {
      platform: 'Vercel',
      timestamp: new Date().toISOString()
    }
  });
};
