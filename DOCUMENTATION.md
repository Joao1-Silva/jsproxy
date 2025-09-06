# Documentación Técnica - API Proxy Server

## Resumen del Sistema

Este proyecto es un servidor proxy que redirige consultas HTTP hacia la API externa `http://api-sermaca.lat/api_aguilera/api/ai-data` y procesa las respuestas para optimizar su consumo por sistemas de IA.

## Arquitectura del Sistema

### Flujo de Datos

```
Cliente → Proxy Server → API Externa → Procesamiento → Respuesta Formateada → Cliente
```

1. **Cliente** envía request (GET/POST) al proxy
2. **Proxy Server** valida y reenvía el request a la API externa
3. **API Externa** procesa y devuelve datos
4. **Procesamiento** formatea la respuesta para consumo de IA
5. **Respuesta Formateada** se envía de vuelta al cliente

### Componentes Principales

#### 1. Funciones Serverless (Vercel)
- **`/api/proxy.js`**: Función principal del proxy
- **`/api/health.js`**: Health check endpoint
- **`/api/index.js`**: Documentación y información del API

#### 2. Servidor Express (Desarrollo Local)
- **`server.js`**: Servidor completo para desarrollo local

## Variables de Configuración

### Variables de Entorno

| Variable | Valor por Defecto | Descripción |
|----------|-------------------|-------------|
| `PORT` | `3000` | Puerto para servidor local (solo desarrollo) |
| `API_BASE_URL` | `http://api-sermaca.lat/api_aguilera/api/ai-data` | URL de la API externa |
| `TIMEOUT` | `10000` | Timeout en milisegundos para requests |

### Constantes del Sistema

```javascript
// URL base de la API externa
const API_BASE_URL = 'http://api-sermaca.lat/api_aguilera/api/ai-data';

// Timeout para requests HTTP
const TIMEOUT = 10000; // 10 segundos

// Headers CORS
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
```

## Endpoints Disponibles

### 1. `/proxy` - Endpoint Principal

**Métodos Soportados:** `GET`, `POST`, `OPTIONS`

#### GET Request
```bash
GET /proxy?param1=value1&param2=value2
```

**Parámetros:**
- Query parameters se reenvían directamente a la API externa

**Ejemplo:**
```bash
curl "https://tu-proyecto.vercel.app/proxy?query=ejemplo&limit=10"
```

#### POST Request
```bash
POST /proxy
Content-Type: application/json

{
  "query": "ejemplo",
  "filters": {...}
}
```

**Body:**
- JSON object que se reenvía a la API externa

**Ejemplo:**
```bash
curl -X POST "https://tu-proyecto.vercel.app/proxy" \
  -H "Content-Type: application/json" \
  -d '{"query": "buscar datos", "limit": 5}'
```

#### Respuesta del Proxy

```json
{
  "success": true,
  "originalData": {
    // Respuesta original de la API externa
  },
  "processedForAI": {
    "messageCount": 3,
    "messages": [
      {
        "id": 1,
        "content": "contenido del mensaje",
        "timestamp": "2025-01-06T16:24:08.000Z",
        "type": "message"
      }
    ],
    "summary": "Found 3 messages from the API"
  },
  "timestamp": "2025-01-06T16:24:08.000Z"
}
```

### 2. `/health` - Health Check

**Método:** `GET`

**Respuesta:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-06T16:24:08.000Z",
  "environment": "vercel",
  "version": "1.0.0"
}
```

### 3. `/` - Documentación

**Método:** `GET`

**Respuesta:**
```json
{
  "message": "API Proxy Server - Vercel Deployment",
  "endpoints": {
    "GET /proxy": "Proxy requests to api-sermaca.lat/api_aguilera",
    "POST /proxy": "Proxy POST requests to api-sermaca.lat/api_aguilera",
    "GET /health": "Health check endpoint"
  },
  "usage": {
    "example": "https://tu-proyecto.vercel.app/proxy?param=value"
  },
  "deployment": {
    "platform": "Vercel",
    "timestamp": "2025-01-06T16:24:08.000Z"
  }
}
```

## Procesamiento de Datos para IA

### Función `processForAI(data)`

Esta función transforma la respuesta de la API externa en un formato optimizado para consumo de IA.

#### Casos de Procesamiento:

1. **Array de mensajes en `data.messages`:**
```javascript
{
  messageCount: data.messages.length,
  messages: [
    {
      id: 1,
      content: "contenido extraído",
      timestamp: "ISO timestamp",
      type: "message"
    }
  ],
  summary: "Found X messages from the API"
}
```

2. **Array directo de datos:**
```javascript
{
  messageCount: data.length,
  messages: [
    {
      id: 1,
      content: "string o JSON stringificado",
      timestamp: "ISO timestamp",
      type: "message"
    }
  ],
  summary: "Found X messages from the API"
}
```

3. **Objeto genérico:**
```javascript
{
  messageCount: 1,
  messages: [
    {
      id: 1,
      content: "JSON stringificado del objeto completo",
      timestamp: "ISO timestamp",
      type: "data"
    }
  ],
  summary: "API response formatted for AI consumption"
}
```

## Manejo de Errores

### Códigos de Estado HTTP

| Código | Descripción | Caso de Uso |
|--------|-------------|-------------|
| `200` | OK | Request exitoso |
| `405` | Method Not Allowed | Método HTTP no soportado |
| `500` | Internal Server Error | Error en proxy o API externa |

### Estructura de Error

```json
{
  "success": false,
  "error": "Descripción del error",
  "timestamp": "2025-01-06T16:24:08.000Z"
}
```

### Tipos de Errores Comunes

1. **Timeout de la API externa**
2. **API externa no disponible**
3. **Formato de datos inválido**
4. **Método HTTP no soportado**

## CORS (Cross-Origin Resource Sharing)

### Headers Configurados

```javascript
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
'Access-Control-Allow-Headers': 'Content-Type'
```

### Preflight Requests

El sistema maneja automáticamente las requests `OPTIONS` para CORS preflight.

## Logging y Monitoreo

### Logs Disponibles

1. **Request recibido:** Método y parámetros/body
2. **Respuesta de API externa:** Status y datos
3. **Errores:** Detalles completos del error

### Ejemplo de Logs

```
Received GET proxy request
Query params: { query: "ejemplo", limit: "10" }
API Response status: 200
API Response data: {...}
```

## Configuración de Vercel

### `vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/proxy",
      "dest": "/api/proxy"
    },
    {
      "src": "/health", 
      "dest": "/api/health"
    },
    {
      "src": "/",
      "dest": "/api/index"
    }
  ],
  "functions": {
    "api/**/*.js": {
      "maxDuration": 10
    }
  }
}
```

### Límites de Vercel

- **Timeout máximo:** 10 segundos por función
- **Memory limit:** 1024 MB (plan gratuito)
- **Concurrent executions:** 1000 (plan gratuito)

## Testing

### Tests Incluidos

1. **`test-api.js`**: Prueba directa de la API externa
2. **`test-proxy.js`**: Prueba del servidor proxy local

### Ejecutar Tests

```bash
# Test API externa
node test-api.js

# Test proxy local (requiere servidor corriendo)
npm start
node test-proxy.js
```

## Deployment

### Desarrollo Local

```bash
npm install
npm start          # Servidor Express
# o
npm run vercel-dev # Simulación de Vercel
```

### Producción en Vercel

```bash
npm run deploy
# o
vercel --prod
```

## Seguridad

### Consideraciones

1. **CORS abierto:** Permite requests desde cualquier origen
2. **Sin autenticación:** No requiere API keys o tokens
3. **Rate limiting:** Dependiente de Vercel y API externa
4. **Input validation:** Mínima, se confía en la API externa

### Recomendaciones

1. Implementar rate limiting si es necesario
2. Agregar validación de input para producción
3. Considerar autenticación para uso empresarial
4. Monitorear logs para detectar abuso
