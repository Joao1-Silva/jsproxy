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
    const errorHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - API Proxy Server</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="error">❌ Error 405</h1>
            <p><strong>Method not allowed</strong></p>
            <p>Timestamp: ${new Date().toISOString()}</p>
            <a href="/">← Volver al inicio</a>
        </div>
    </body>
    </html>`;
    return res.status(405).send(errorHtml);
  }

  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>API Proxy Server - Documentación</title>
      <style>
          body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
          }
          .container {
              max-width: 1000px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              overflow: hidden;
          }
          .header {
              background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
              color: white;
              padding: 30px;
              text-align: center;
          }
          .header h1 {
              margin: 0;
              font-size: 2.5em;
              font-weight: 300;
          }
          .header p {
              margin: 10px 0 0 0;
              opacity: 0.9;
              font-size: 1.1em;
          }
          .content {
              padding: 30px;
          }
          .endpoint {
              background: #f8f9fa;
              border-left: 4px solid #3498db;
              padding: 20px;
              margin: 20px 0;
              border-radius: 0 8px 8px 0;
          }
          .endpoint h3 {
              margin: 0 0 10px 0;
              color: #2c3e50;
              font-size: 1.3em;
          }
          .endpoint p {
              margin: 5px 0;
              color: #666;
          }
          .method {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 0.8em;
              font-weight: bold;
              margin-right: 10px;
          }
          .get { background: #27ae60; color: white; }
          .post { background: #e67e22; color: white; }
          .example {
              background: #ecf0f1;
              padding: 15px;
              border-radius: 6px;
              font-family: 'Courier New', monospace;
              font-size: 0.9em;
              margin: 10px 0;
              overflow-x: auto;
          }
          .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
              margin: 30px 0;
          }
          .info-card {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              border: 1px solid #e9ecef;
          }
          .info-card h4 {
              margin: 0 0 10px 0;
              color: #2c3e50;
          }
          .status {
              display: inline-block;
              padding: 6px 12px;
              background: #27ae60;
              color: white;
              border-radius: 20px;
              font-size: 0.9em;
              font-weight: bold;
          }
          .footer {
              background: #f8f9fa;
              padding: 20px 30px;
              border-top: 1px solid #e9ecef;
              text-align: center;
              color: #666;
          }
          a {
              color: #3498db;
              text-decoration: none;
          }
          a:hover {
              text-decoration: underline;
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h1>🚀 API Proxy Server</h1>
              <p>Vercel Deployment - Proxy para API de IA</p>
              <span class="status">✅ Online</span>
          </div>
          
          <div class="content">
              <div class="info-grid">
                  <div class="info-card">
                      <h4>🌐 Plataforma</h4>
                      <p>Vercel Serverless</p>
                  </div>
                  <div class="info-card">
                      <h4>📡 API Externa</h4>
                      <p>api-sermaca.lat/api_aguilera</p>
                  </div>
                  <div class="info-card">
                      <h4>⏱️ Timestamp</h4>
                      <p>${new Date().toISOString()}</p>
                  </div>
                  <div class="info-card">
                      <h4>🔧 Versión</h4>
                      <p>1.0.0</p>
                  </div>
              </div>

              <h2>📋 Endpoints Disponibles</h2>
              
              <div class="endpoint">
                  <h3><span class="method get">GET</span><span class="method post">POST</span>/proxy</h3>
                  <p><strong>Descripción:</strong> Endpoint principal del proxy que redirige requests a la API externa y procesa las respuestas para consumo de IA.</p>
                  <p><strong>Ejemplo GET:</strong></p>
                  <div class="example">${baseUrl}/proxy?query=ejemplo&limit=10</div>
                  <p><strong>Ejemplo POST:</strong></p>
                  <div class="example">curl -X POST "${baseUrl}/proxy" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "buscar datos", "limit": 5}'</div>
              </div>

              <div class="endpoint">
                  <h3><span class="method get">GET</span>/health</h3>
                  <p><strong>Descripción:</strong> Health check endpoint para verificar el estado del servidor.</p>
                  <p><strong>Ejemplo:</strong></p>
                  <div class="example"><a href="/health" target="_blank">${baseUrl}/health</a></div>
              </div>

              <div class="endpoint">
                  <h3><span class="method get">GET</span>/</h3>
                  <p><strong>Descripción:</strong> Esta página de documentación con información del API.</p>
                  <p><strong>URL:</strong></p>
                  <div class="example">${baseUrl}/</div>
              </div>

              <h2>📊 Estructura de Respuesta del Proxy</h2>
              <div class="example">{
  "success": true,
  "originalData": { /* Datos originales de la API */ },
  "processedForAI": {
    "messageCount": 3,
    "messages": [
      {
        "id": 1,
        "content": "contenido procesado",
        "timestamp": "2025-01-06T20:29:11.000Z",
        "type": "message"
      }
    ],
    "summary": "Found 3 messages from the API"
  },
  "timestamp": "2025-01-06T20:29:11.000Z"
}</div>
          </div>

          <div class="footer">
              <p>🔗 <strong>Enlaces útiles:</strong> 
                 <a href="/health">Health Check</a> | 
                 <a href="/proxy?test=true">Test Proxy</a> |
                 <a href="https://github.com" target="_blank">GitHub</a>
              </p>
              <p>Desarrollado para el ecosistema Vercel</p>
          </div>
      </div>
  </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
