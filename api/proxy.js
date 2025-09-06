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
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Check if request wants HTML (from browser) or JSON (programmatic)
  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
  const isDocRequest = req.method === 'GET' && Object.keys(req.query).length === 0;

  // Show documentation page for GET requests without parameters from browser
  if (isDocRequest && acceptsHtml) {
    const host = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${host}`;

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Proxy Endpoint - API Proxy Server</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #e67e22 0%, #f39c12 100%);
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
                background: linear-gradient(135deg, #e67e22 0%, #f39c12 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 2.5em;
                font-weight: 300;
            }
            .content {
                padding: 30px;
            }
            .warning {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .warning h3 {
                margin: 0 0 10px 0;
                color: #856404;
            }
            .example-section {
                background: #f8f9fa;
                border-left: 4px solid #e67e22;
                padding: 20px;
                margin: 20px 0;
                border-radius: 0 8px 8px 0;
            }
            .example {
                background: #2c3e50;
                color: #ecf0f1;
                padding: 15px;
                border-radius: 6px;
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
                margin: 10px 0;
                overflow-x: auto;
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
            .test-form {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border: 1px solid #e9ecef;
            }
            .form-group {
                margin: 15px 0;
            }
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
                color: #2c3e50;
            }
            .form-group input, .form-group textarea {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
            }
            .btn {
                background: #e67e22;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                margin: 5px;
            }
            .btn:hover {
                background: #d35400;
            }
            .btn-secondary {
                background: #3498db;
            }
            .btn-secondary:hover {
                background: #2980b9;
            }
            .response-area {
                background: #2c3e50;
                color: #ecf0f1;
                padding: 15px;
                border-radius: 6px;
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
                min-height: 100px;
                white-space: pre-wrap;
                margin-top: 10px;
            }
            .footer {
                background: #f8f9fa;
                padding: 20px;
                text-align: center;
                color: #666;
                border-top: 1px solid #e9ecef;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔄 Proxy Endpoint</h1>
                <p>Documentación y Testing del Endpoint Principal</p>
            </div>
            
            <div class="content">
                <div class="warning">
                    <h3>⚠️ Información Importante</h3>
                    <p>Este endpoint redirige requests a la API externa <code>api-sermaca.lat/api_aguilera/api/ai-data</code> y procesa las respuestas para consumo de IA.</p>
                    <p>Para uso programático, envía requests con <code>Content-Type: application/json</code> para recibir respuestas JSON.</p>
                </div>

                <h2>📋 Métodos Soportados</h2>
                
                <div class="example-section">
                    <h3><span class="method get">GET</span>Proxy con Query Parameters</h3>
                    <p><strong>Uso:</strong> Para consultas simples con parámetros en la URL</p>
                    <div class="example">GET ${baseUrl}/proxy?query=ejemplo&limit=10</div>
                </div>

                <div class="example-section">
                    <h3><span class="method post">POST</span>Proxy con JSON Body</h3>
                    <p><strong>Uso:</strong> Para consultas complejas con datos JSON</p>
                    <div class="example">curl -X POST "${baseUrl}/proxy" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "buscar datos", "filters": {...}}'</div>
                </div>

                <h2>🧪 Probar el Endpoint</h2>
                
                <div class="test-form">
                    <h3>GET Request Test</h3>
                    <div class="form-group">
                        <label>Query Parameters (formato: key=value&key2=value2):</label>
                        <input type="text" id="getParams" placeholder="query=test&limit=5" value="test=proxy">
                    </div>
                    <button class="btn" onclick="testGet()">🚀 Test GET</button>
                    <button class="btn btn-secondary" onclick="clearResponse()">🧹 Limpiar</button>
                </div>

                <div class="test-form">
                    <h3>POST Request Test</h3>
                    <div class="form-group">
                        <label>JSON Body:</label>
                        <textarea id="postBody" rows="4" placeholder='{"query": "test", "limit": 5}'>{"query": "test proxy", "source": "web-interface"}</textarea>
                    </div>
                    <button class="btn" onclick="testPost()">🚀 Test POST</button>
                </div>

                <div class="form-group">
                    <label>Respuesta:</label>
                    <div id="response" class="response-area">Haz clic en uno de los botones de test para ver la respuesta...</div>
                </div>

                <h2>📊 Estructura de Respuesta</h2>
                <div class="example">{
  "success": true,
  "originalData": { /* Datos originales de la API externa */ },
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
                <p>🔗 <a href="/">← Volver al inicio</a> | <a href="/health">Health Check</a></p>
                <p>🚀 API Proxy Server - Endpoint de Proxy Interactivo</p>
            </div>
        </div>

        <script>
            async function testGet() {
                const params = document.getElementById('getParams').value;
                const url = '/proxy' + (params ? '?' + params : '');
                
                document.getElementById('response').textContent = 'Enviando request GET...';
                
                try {
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    
                    const data = await response.json();
                    document.getElementById('response').textContent = JSON.stringify(data, null, 2);
                } catch (error) {
                    document.getElementById('response').textContent = 'Error: ' + error.message;
                }
            }

            async function testPost() {
                const body = document.getElementById('postBody').value;
                
                document.getElementById('response').textContent = 'Enviando request POST...';
                
                try {
                    const response = await fetch('/proxy', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: body
                    });
                    
                    const data = await response.json();
                    document.getElementById('response').textContent = JSON.stringify(data, null, 2);
                } catch (error) {
                    document.getElementById('response').textContent = 'Error: ' + error.message;
                }
            }

            function clearResponse() {
                document.getElementById('response').textContent = 'Respuesta limpiada. Haz clic en test para ver nuevos resultados...';
            }
        </script>
    </body>
    </html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  try {
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
    } else {
      const errorResponse = {
        success: false,
        error: 'Method not allowed',
        timestamp: new Date().toISOString()
      };

      if (acceptsHtml) {
        const errorHtml = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error - Proxy Endpoint</title>
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
                <p>Solo se permiten métodos GET y POST en este endpoint.</p>
                <p>Timestamp: ${new Date().toISOString()}</p>
                <a href="/proxy">← Volver al proxy</a> | <a href="/">Inicio</a>
            </div>
        </body>
        </html>`;
        return res.status(405).send(errorHtml);
      }
      
      return res.status(405).json(errorResponse);
    }

    console.log('API Response status:', response.status);
    console.log('API Response data:', JSON.stringify(response.data, null, 2));

    // Return the original data directly for ChatGPT and other AI systems
    res.json(response.data);

  } catch (error) {
    console.error('Proxy error:', error.message);
    
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };

    if (acceptsHtml) {
      const errorHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error - Proxy Endpoint</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .error { color: #e74c3c; }
              .details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; font-family: monospace; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1 class="error">❌ Error del Proxy</h1>
              <p><strong>Ha ocurrido un error al procesar la solicitud:</strong></p>
              <div class="details">${error.message}</div>
              <p>Timestamp: ${new Date().toISOString()}</p>
              <a href="/proxy">← Volver al proxy</a> | <a href="/">Inicio</a>
          </div>
      </body>
      </html>`;
      return res.status(500).send(errorHtml);
    }
    
    res.status(500).json(errorResponse);
  }
};
