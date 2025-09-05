# API Proxy Server

Un servidor proxy en Node.js que redirige consultas de la API `http://api-sermaca.lat/api_aguilera/api/ai-data` y las formatea para consumo de IA.

## Características

- Proxy para requests GET y POST
- Procesamiento automático de respuestas JSON para IA
- Manejo de errores robusto
- Logging detallado
- Endpoints de salud y documentación

## Instalación

```bash
npm install
```

## Uso

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

El servidor se ejecutará en `http://localhost:3000`

## Endpoints

### `GET /proxy`
Redirige requests GET a la API original con parámetros de consulta.

**Ejemplo:**
```
GET http://localhost:3000/proxy?param=value
```

### `POST /proxy`
Redirige requests POST a la API original con body JSON.

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -d '{"query": "ejemplo"}'
```

### `GET /health`
Endpoint de verificación de salud del servidor.

### `GET /`
Información de uso y documentación de endpoints.

## Respuesta del Proxy

El proxy devuelve una respuesta estructurada:

```json
{
  "success": true,
  "originalData": "...",
  "processedForAI": {
    "messageCount": 3,
    "messages": [
      {
        "id": 1,
        "content": "mensaje procesado",
        "timestamp": "2025-01-05T13:53:40.000Z",
        "type": "message"
      }
    ],
    "summary": "Found 3 messages from the API"
  },
  "timestamp": "2025-01-05T13:53:40.000Z"
}
```

## Configuración

- **Puerto:** Por defecto 3000, configurable con `PORT` environment variable
- **API URL:** `http://api-sermaca.lat/api_aguilera/api/ai-data`
- **Timeout:** 10 segundos para requests a la API externa
