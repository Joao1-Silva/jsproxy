module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
