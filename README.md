# API Proxy Server

Un servidor proxy en Node.js que redirige consultas de la API `http://api-sermaca.lat/api_aguilera/api/ai-data` y las formatea para consumo de IA.

## Características

- Proxy para requests GET y POST
- Procesamiento automático de respuestas JSON para IA
- Manejo de errores robusto
- Logging detallado
- Endpoints de salud y documentación
- **Configurado para Vercel** con funciones serverless
- CORS habilitado para uso desde frontend

## Instalación

```bash
npm install
```

## Uso

### Desarrollo Local (Express)
```bash
npm run dev
```

### Desarrollo con Vercel
```bash
npm run vercel-dev
```

### Producción Local
```bash
npm start
```

### Deploy a Vercel
```bash
npm run deploy
```

El servidor local se ejecutará en `http://localhost:3000`

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

### Variables de Entorno
- **Puerto:** Por defecto 3000, configurable con `PORT` environment variable (solo para desarrollo local)
- **API URL:** `http://api-sermaca.lat/api_aguilera/api/ai-data`
- **Timeout:** 10 segundos para requests a la API externa

### Estructura del Proyecto

```
jsproxy/
├── api/                    # Funciones serverless para Vercel
│   ├── index.js           # Endpoint raíz (/)
│   ├── proxy.js           # Endpoint proxy (/proxy)
│   └── health.js          # Health check (/health)
├── server.js              # Servidor Express (desarrollo local)
├── vercel.json            # Configuración de Vercel
├── .vercelignore          # Archivos ignorados en deploy
└── package.json           # Dependencias y scripts
```

## Deployment en Vercel

### Opción 1: CLI de Vercel
1. Instala Vercel CLI globalmente:
   ```bash
   npm install -g vercel
   ```

2. Inicia sesión en Vercel:
   ```bash
   vercel login
   ```

3. Deploy del proyecto:
   ```bash
   vercel --prod
   ```

### Opción 2: GitHub Integration
1. Sube el código a un repositorio de GitHub
2. Conecta el repositorio en [vercel.com](https://vercel.com)
3. Vercel detectará automáticamente la configuración

### URLs de Ejemplo (después del deploy)
- **Producción:** `https://tu-proyecto.vercel.app/proxy?param=value`
- **Health Check:** `https://tu-proyecto.vercel.app/health`
- **Documentación:** `https://tu-proyecto.vercel.app/`

## Diferencias entre Local y Vercel

| Aspecto | Local (Express) | Vercel (Serverless) |
|---------|----------------|---------------------|
| Servidor | Siempre activo | Funciones bajo demanda |
| CORS | Middleware cors | Headers manuales |
| Routing | Express routes | Vercel routes config |
| Logs | Console local | Vercel Functions logs |
