const axios = require('axios');

// API endpoint configuration
const API_BASE_URL = 'http://api-sermaca.lat/api_aguilera/api/ai-data';

module.exports = async (req, res) => {
  try {
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

    // Fetch data from external API
    console.log('Fetching data from external API for AI visualization');
    const response = await axios.get(API_BASE_URL, {
      timeout: 10000
    });

    const apiData = response.data;
    console.log('API data fetched successfully for AI visualization');

    const host = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${host}`;

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Visualización de Datos IA - API Proxy Server</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }
            .container {
                max-width: 1200px;
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
            .section {
                background: #f8f9fa;
                border-left: 4px solid #3498db;
                padding: 20px;
                margin: 20px 0;
                border-radius: 0 8px 8px 0;
            }
            .section h3 {
                margin: 0 0 15px 0;
                color: #2c3e50;
                font-size: 1.3em;
            }
            .json-display {
                background: #2c3e50;
                color: #ecf0f1;
                padding: 15px;
                border-radius: 6px;
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
                margin: 10px 0;
                overflow-x: auto;
                max-height: 400px;
                overflow-y: auto;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin: 20px 0;
            }
            .stat-item {
                background: white;
                padding: 15px;
                border-radius: 6px;
                border: 1px solid #ddd;
                text-align: center;
            }
            .stat-value {
                font-size: 1.5em;
                font-weight: bold;
                color: #3498db;
            }
            .stat-label {
                font-size: 0.9em;
                color: #666;
                margin-top: 5px;
            }
            .footer {
                background: #f8f9fa;
                padding: 20px 30px;
                border-top: 1px solid #e9ecef;
                text-align: center;
                color: #666;
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
            a {
                color: #3498db;
                text-decoration: none;
            }
            a:hover {
                text-decoration: underline;
            }
            .refresh-btn {
                background: #3498db;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                margin: 10px 0;
            }
            .refresh-btn:hover {
                background: #2980b9;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤖 Visualización de Datos IA</h1>
                <p>Sistema HMI - Monitoreo Industrial en Tiempo Real</p>
                <span class="status">✅ Datos Actualizados</span>
            </div>
            
            <div class="content">
                <div class="info-grid">
                    <div class="info-card">
                        <h4>📊 Total Registros</h4>
                        <p>${apiData.metadata?.total_registros || apiData.estadisticas_generales?.total_registros || 'N/A'}</p>
                    </div>
                    <div class="info-card">
                        <h4>🕒 Última Actualización</h4>
                        <p>${new Date(apiData.metadata?.timestamp || new Date()).toLocaleString('es-ES')}</p>
                    </div>
                    <div class="info-card">
                        <h4>🏭 Fuente</h4>
                        <p>${apiData.metadata?.fuente || 'API Aguilera - Sistema de monitoreo industrial'}</p>
                    </div>
                    <div class="info-card">
                        <h4>📈 Descripción</h4>
                        <p>${apiData.metadata?.descripcion || 'Base de datos completa del sistema HMI'}</p>
                    </div>
                </div>

                <button class="refresh-btn" onclick="window.location.reload()">🔄 Actualizar Datos</button>

                <div class="section">
                    <h3>📊 Estadísticas Generales de Mediciones</h3>
                    ${apiData.estadisticas_generales ? `
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-value">${apiData.estadisticas_generales.total_registros || 'N/A'}</div>
                            <div class="stat-label">Total de Registros</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(apiData.estadisticas_generales.temperatura_promedio && typeof apiData.estadisticas_generales.temperatura_promedio === 'number') ? apiData.estadisticas_generales.temperatura_promedio.toFixed(2) + '°C' : 'N/A'}</div>
                            <div class="stat-label">Temperatura Promedio</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(apiData.estadisticas_generales.caudal_bruto_promedio && typeof apiData.estadisticas_generales.caudal_bruto_promedio === 'number') ? apiData.estadisticas_generales.caudal_bruto_promedio.toFixed(2) : 'N/A'}</div>
                            <div class="stat-label">Caudal Bruto Promedio</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(apiData.estadisticas_generales.densidad_promedio && typeof apiData.estadisticas_generales.densidad_promedio === 'number') ? apiData.estadisticas_generales.densidad_promedio.toFixed(4) : 'N/A'}</div>
                            <div class="stat-label">Densidad Promedio</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(apiData.estadisticas_generales.bsw_promedio && typeof apiData.estadisticas_generales.bsw_promedio === 'number') ? apiData.estadisticas_generales.bsw_promedio.toFixed(2) + '%' : 'N/A'}</div>
                            <div class="stat-label">BSW Promedio</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(apiData.estadisticas_generales.drive_gain_gas_promedio && typeof apiData.estadisticas_generales.drive_gain_gas_promedio === 'number') ? apiData.estadisticas_generales.drive_gain_gas_promedio.toFixed(2) : 'N/A'}</div>
                            <div class="stat-label">Drive Gain Gas Promedio</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(apiData.estadisticas_generales.temperatura_maxima && typeof apiData.estadisticas_generales.temperatura_maxima === 'number') ? apiData.estadisticas_generales.temperatura_maxima.toFixed(2) + '°C' : 'N/A'}</div>
                            <div class="stat-label">Temperatura Máxima</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(apiData.estadisticas_generales.temperatura_minima && typeof apiData.estadisticas_generales.temperatura_minima === 'number') ? apiData.estadisticas_generales.temperatura_minima.toFixed(2) + '°C' : 'N/A'}</div>
                            <div class="stat-label">Temperatura Mínima</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(apiData.estadisticas_generales.caudal_bruto_maximo && typeof apiData.estadisticas_generales.caudal_bruto_maximo === 'number') ? apiData.estadisticas_generales.caudal_bruto_maximo.toFixed(2) : 'N/A'}</div>
                            <div class="stat-label">Caudal Bruto Máximo</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(apiData.estadisticas_generales.caudal_bruto_minimo && typeof apiData.estadisticas_generales.caudal_bruto_minimo === 'number') ? apiData.estadisticas_generales.caudal_bruto_minimo.toFixed(2) : 'N/A'}</div>
                            <div class="stat-label">Caudal Bruto Mínimo</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${apiData.estadisticas_generales.fecha_mas_antigua ? new Date(apiData.estadisticas_generales.fecha_mas_antigua).toLocaleDateString('es-ES') : 'N/A'}</div>
                            <div class="stat-label">Fecha Más Antigua</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${apiData.estadisticas_generales.fecha_mas_reciente ? new Date(apiData.estadisticas_generales.fecha_mas_reciente).toLocaleDateString('es-ES') : 'N/A'}</div>
                            <div class="stat-label">Fecha Más Reciente</div>
                        </div>
                    </div>
                    ` : '<p>No hay estadísticas disponibles</p>'}
                </div>

                <div class="section">
                    <h3>🏗️ Estructura de la Base de Datos</h3>
                    <div class="json-display">${JSON.stringify(apiData.estructura_tabla || [], null, 2)}</div>
                </div>

                <div class="section">
                    <h3>📝 Descripción de Campos</h3>
                    <div class="json-display">${JSON.stringify(apiData.campos_descripcion || {}, null, 2)}</div>
                </div>

                <div class="section">
                    <h3>📊 Metadatos del Sistema</h3>
                    <div class="json-display">${JSON.stringify(apiData.metadata || {}, null, 2)}</div>
                </div>

                <div class="section">
                    <h3>💾 Registros de Mediciones (Últimos 5 registros)</h3>
                    ${apiData.datos_completos && apiData.datos_completos.length > 0 ? `
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 0.9em;">
                            <thead>
                                <tr style="background: #34495e; color: white;">
                                    <th style="padding: 10px; border: 1px solid #ddd;">ID</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Fecha Creación</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Temp °C</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Q Bruto</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Densidad</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">BSW %</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Q Net Oil</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Drive Gain Gas</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${apiData.datos_completos.slice(0, 5).map(registro => `
                                <tr style="background: ${apiData.datos_completos.indexOf(registro) % 2 === 0 ? '#f8f9fa' : 'white'};">
                                    <td style="padding: 8px; border: 1px solid #ddd;">${registro.id || 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${registro.fecha_creacion ? new Date(registro.fecha_creacion).toLocaleString('es-ES') : 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${(registro.temp_1 && typeof registro.temp_1 === 'number') ? registro.temp_1.toFixed(2) : 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${(registro.q_bruto_1 && typeof registro.q_bruto_1 === 'number') ? registro.q_bruto_1.toFixed(2) : 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${(registro.densidad_1 && typeof registro.densidad_1 === 'number') ? registro.densidad_1.toFixed(4) : 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${(registro.bsw_1 && typeof registro.bsw_1 === 'number') ? registro.bsw_1.toFixed(2) : 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${(registro.q_net_oil_1 && typeof registro.q_net_oil_1 === 'number') ? registro.q_net_oil_1.toFixed(2) : 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${(registro.driv_gain_gas_1 && typeof registro.driv_gain_gas_1 === 'number') ? registro.driv_gain_gas_1.toFixed(2) : 'N/A'}</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <p><strong>Total de registros en la base de datos: ${apiData.datos_completos.length}</strong></p>
                    ` : '<p>No hay datos de mediciones disponibles</p>'}
                </div>

                <div class="section">
                    <h3>📋 Estructura JSON Completa</h3>
                    <p>JSON completo que envía la API externa:</p>
                    <div class="json-display" style="max-height: 600px; overflow-y: auto;">${JSON.stringify(apiData, null, 2)}</div>
                </div>

                <div class="section">
                    <h3>🔗 Enlaces Útiles</h3>
                    <p>
                        <a href="/proxy/data.json" target="_blank">📄 Ver JSON Completo</a> | 
                        <a href="/proxy">🔄 Actualizar Datos</a> | 
                        <a href="/">🏠 Inicio</a>
                    </p>
                </div>
            </div>

            <div class="footer">
                <p>🔗 <strong>API Proxy Server</strong> - Visualización de Datos para IA</p>
                <p>Datos obtenidos de: <code>api-sermaca.lat/api_aguilera/api/ai-data</code></p>
                <p>Última actualización: ${new Date().toLocaleString('es-ES')}</p>
            </div>
        </div>
    </body>
    </html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error('Error fetching data for AI visualization:', error.message);
    
    // Return error page
    const errorHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - Visualización IA</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="error">❌ Error al cargar datos</h1>
            <p><strong>No se pudieron obtener los datos de la API externa</strong></p>
            <p>Error: ${error.message}</p>
            <p>Timestamp: ${new Date().toISOString()}</p>
            <a href="/proxy/ai">🔄 Reintentar</a> | <a href="/">← Volver al inicio</a>
        </div>
    </body>
    </html>`;
    
    res.status(500).send(errorHtml);
  }
};
