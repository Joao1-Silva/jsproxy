const axios = require('axios');

// API endpoint configuration
const API_BASE_URL = 'http://api-sermaca.lat/api_aguilera/api/ai-data';

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

  // Fetch real data from external API
  let realApiData = null;
  try {
    console.log('Fetching real data from external API for index page');
    const response = await axios.get(API_BASE_URL, { timeout: 5000 });
    realApiData = response.data;
    console.log('Real API data fetched successfully for index');
  } catch (error) {
    console.error('Error fetching real data for index:', error.message);
    // Continue with fallback example data if API fails
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
                      <p>4.8.2</p>
                  </div>
              </div>

              <h2>📋 Endpoints Disponibles</h2>
              
              <div class="endpoint">
                  <h3><span class="method get">GET</span><span class="method post">POST</span>/proxy</h3>
                  <p><strong>Descripción:</strong> Endpoint principal que obtiene datos de la API externa y redirige automáticamente a <code>/proxy/data.json</code> para mostrar el JSON en el navegador.</p>
                  <p><strong>Ejemplo:</strong></p>
                  <div class="example"><a href="/proxy" target="_blank">${baseUrl}/proxy</a></div>
                  <p><strong>Comportamiento:</strong> Redirige automáticamente a <code>/proxy/data.json</code> con datos actualizados.</p>
              </div>

              <div class="endpoint">
                  <h3><span class="method get">GET</span>/proxy/data.json</h3>
                  <p><strong>Descripción:</strong> Muestra el JSON completo de la API externa directamente en el navegador con datos frescos.</p>
                  <p><strong>Ejemplo:</strong></p>
                  <div class="example"><a href="/proxy/data.json" target="_blank">${baseUrl}/proxy/data.json</a></div>
                  <p><strong>Respuesta:</strong> JSON completo con metadata, estadísticas, estructura de tabla y todos los registros de mediciones.</p>
              </div>

              <div class="endpoint">
                  <h3><span class="method get">GET</span>/proxy/ai</h3>
                  <p><strong>Descripción:</strong> Visualización HTML atractiva de los datos de la API externa con estadísticas, tablas y estructura JSON completa.</p>
                  <p><strong>Ejemplo:</strong></p>
                  <div class="example"><a href="/proxy/ai" target="_blank">${baseUrl}/proxy/ai</a></div>
                  <p><strong>Características:</strong> Dashboard visual con estadísticas en tiempo real, tabla de registros y JSON completo navegable.</p>
              </div>

              <div class="endpoint">
                  <h3><span class="method get">GET</span>/health</h3>
                  <p><strong>Descripción:</strong> Health check endpoint para verificar el estado del servidor.</p>
                  <p><strong>Ejemplo:</strong></p>
                  <div class="example"><a href="/health" target="_blank">${baseUrl}/health</a></div>
              </div>

              <div class="endpoint">
                  <h3><span class="method get">GET</span>/</h3>
                  <p><strong>Descripción:</strong> Esta página de documentación con información completa del API.</p>
                  <p><strong>URL:</strong></p>
                  <div class="example">${baseUrl}/</div>
              </div>

              <h2>📊 Estructura de Respuesta del Proxy</h2>
              ${realApiData ? `
              <p><strong>Datos reales completos obtenidos de la API externa:</strong></p>
              <div class="example">${JSON.stringify(realApiData, null, 2)}</div>
              ` : `
              <p><strong>Ejemplo de estructura (API externa no disponible):</strong></p>
              <div class="example">{
  "metadata": {
    "timestamp": "2025-01-08T13:45:40.000Z",
    "total_registros": 1250,
    "descripcion": "Base de datos completa del sistema HMI para análisis de IA",
    "fuente": "API Aguilera - Sistema de monitoreo industrial"
  },
  "estructura_tabla": [...],
  "estadisticas_generales": {
    "total_registros": 1250,
    "fecha_mas_antigua": "2024-01-01T00:00:00.000Z",
    "fecha_mas_reciente": "2025-01-08T13:45:40.000Z",
    "temperatura_promedio": 85.5,
    "drive_gain_gas_promedio": 12.3,
    "caudal_bruto_promedio": 150.7,
    "densidad_promedio": 0.85,
    "bsw_promedio": 2.1
  },
  "datos_completos": [...],
  "campos_descripcion": {
    "id": "Identificador único autoincremental",
    "fecha_creacion": "Timestamp de cuando se insertó el registro",
    "temp_1": "Temperatura",
    "q_bruto_1": "Caudal bruto",
    "densidad_1": "Densidad del fluido",
    "bsw_1": "Basic Sediment and Water"
  }
}</div>
              `}
          </div>

          <div class="footer">
              <p>🔗 <strong>Enlaces útiles:</strong> 
                 <a href="/health">Health Check</a> | 
                 <a href="/proxy">🔄 Proxy (Redirige a JSON)</a> |
                 <a href="/proxy/data.json">📄 JSON Directo</a> |
                 <a href="/proxy/ai">🤖 Visualización IA</a>
              </p>
              <p>Desarrollado para el ecosistema Vercel</p>
          </div>
      </div>
  </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
