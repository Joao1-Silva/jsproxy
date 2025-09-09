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
        <title>Error - Health Check</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
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

  const timestamp = new Date().toISOString();
  const uptime = process.uptime ? Math.floor(process.uptime()) : 'N/A';

  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Health Check - API Proxy Server</title>
      <style>
          body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 20px;
              background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
              min-height: 100vh;
          }
          .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              overflow: hidden;
          }
          .header {
              background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
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
          .status-card {
              background: #f8f9fa;
              border: 2px solid #27ae60;
              border-radius: 8px;
              padding: 25px;
              text-align: center;
              margin: 20px 0;
          }
          .status-icon {
              font-size: 4em;
              margin-bottom: 15px;
          }
          .status-text {
              font-size: 1.5em;
              font-weight: bold;
              color: #27ae60;
              margin-bottom: 10px;
          }
          .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin: 30px 0;
          }
          .info-item {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #3498db;
          }
          .info-item h4 {
              margin: 0 0 10px 0;
              color: #2c3e50;
              font-size: 1.1em;
          }
          .info-item p {
              margin: 0;
              color: #666;
              font-family: 'Courier New', monospace;
              font-size: 0.9em;
          }
          .actions {
              background: #ecf0f1;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
          }
          .actions h3 {
              margin: 0 0 15px 0;
              color: #2c3e50;
          }
          .btn {
              display: inline-block;
              padding: 10px 20px;
              background: #3498db;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 5px;
              font-weight: bold;
          }
          .btn:hover {
              background: #2980b9;
          }
          .btn-success {
              background: #27ae60;
          }
          .btn-success:hover {
              background: #229954;
          }
          .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              color: #666;
              border-top: 1px solid #e9ecef;
          }
          .refresh-info {
              font-size: 0.9em;
              color: #666;
              margin-top: 15px;
          }
      </style>
      <script>
          // Auto-refresh cada 30 segundos
          setTimeout(() => {
              window.location.reload();
          }, 30000);
          
          // Mostrar tiempo transcurrido
          let startTime = Date.now();
          setInterval(() => {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              const element = document.getElementById('page-uptime');
              if (element) {
                  element.textContent = elapsed + 's';
              }
          }, 1000);
      </script>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h1>💚 Health Check</h1>
              <p>Estado del API Proxy Server</p>
          </div>
          
          <div class="content">
              <div class="status-card">
                  <div class="status-icon">✅</div>
                  <div class="status-text">SISTEMA SALUDABLE</div>
                  <p>Todos los servicios funcionando correctamente</p>
              </div>

              <div class="info-grid">
                  <div class="info-item">
                      <h4>🔋 Estado</h4>
                      <p>healthy</p>
                  </div>
                  <div class="info-item">
                      <h4>🌐 Entorno</h4>
                      <p>vercel</p>
                  </div>
                  <div class="info-item">
                      <h4>📦 Versión</h4>
                      <p>4.8.2</p>
                  </div>
                  <div class="info-item">
                      <h4>⏰ Timestamp</h4>
                      <p>${timestamp}</p>
                  </div>
                  <div class="info-item">
                      <h4>⏱️ Uptime Función</h4>
                      <p>${uptime}s</p>
                  </div>
                  <div class="info-item">
                      <h4>📄 Tiempo en Página</h4>
                      <p><span id="page-uptime">0</span></p>
                  </div>
              </div>

              <div class="actions">
                  <h3>🔧 Acciones Disponibles</h3>
                  <a href="/proxy?test=health" class="btn btn-success">🧪 Test Proxy</a>
                  <a href="/" class="btn">📋 Documentación</a>
                  <a href="/health" class="btn">🔄 Refresh</a>
              </div>

              <div class="info-item">
                  <h4>📊 Información del Sistema</h4>
                  <p><strong>Plataforma:</strong> Vercel Serverless Functions</p>
                  <p><strong>Runtime:</strong> Node.js</p>
                  <p><strong>Región:</strong> Auto (Edge Network)</p>
                  <p><strong>CORS:</strong> Habilitado</p>
                  <p><strong>Timeout:</strong> 10 segundos</p>
              </div>

              <div class="refresh-info">
                  <p>🔄 Esta página se actualiza automáticamente cada 30 segundos</p>
                  <p>⚡ Función serverless ejecutándose bajo demanda</p>
              </div>
          </div>

          <div class="footer">
              <p>🚀 API Proxy Server - Vercel Deployment</p>
              <p>Monitoreo en tiempo real del estado del sistema</p>
          </div>
      </div>
  </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
