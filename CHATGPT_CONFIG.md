# Configuración para Acceso desde ChatGPT

## Problema Identificado

ChatGPT requiere configuraciones específicas de CORS y headers para acceder correctamente a APIs. Los errores 500 suelen deberse a:

1. **Headers CORS insuficientes**
2. **Falta de headers de seguridad**
3. **User-Agent restrictions**
4. **Content-Type mal configurado**

## Configuraciones Implementadas

### 1. Headers CORS Mejorados

```javascript
// CORS configuration for ChatGPT compatibility
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent');
res.setHeader('Access-Control-Allow-Credentials', 'false');
res.setHeader('Access-Control-Max-Age', '86400');
```

### 2. Headers de Seguridad

```javascript
// Security headers for ChatGPT compatibility
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
```

### 3. Content-Type Explícito

```javascript
// Ensure proper JSON content type
res.setHeader('Content-Type', 'application/json; charset=utf-8');
```

### 4. Headers para Requests Salientes

```javascript
// Headers for outgoing requests to external API
headers: {
  'User-Agent': 'Mozilla/5.0 (compatible; API-Proxy/1.0)',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive'
}
```

## Logging para Debugging

Se agregó logging específico para identificar requests de ChatGPT:

```javascript
console.log('User-Agent:', req.headers['user-agent']);
console.log('Origin:', req.headers.origin);
```

## Verificación de Funcionamiento

### 1. Test desde ChatGPT

Para probar que la API funciona desde ChatGPT, usa este prompt:

```
Haz una petición GET a https://tu-proyecto.vercel.app/health para verificar que la API esté funcionando.
```

### 2. Test con curl

```bash
# Simular request de ChatGPT
curl -X GET "https://tu-proyecto.vercel.app/health" \
  -H "User-Agent: ChatGPT-User/1.0" \
  -H "Accept: application/json" \
  -H "Origin: https://chat.openai.com"
```

### 3. Test de CORS Preflight

```bash
# Test OPTIONS request
curl -X OPTIONS "https://tu-proyecto.vercel.app/proxy" \
  -H "Origin: https://chat.openai.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type"
```

## Características Específicas para ChatGPT

### User-Agent de ChatGPT

ChatGPT usa diferentes User-Agents:
- `ChatGPT-User/1.0`
- `Mozilla/5.0 (compatible; ChatGPT)`
- Otros variantes

### Origins Esperados

- `https://chat.openai.com`
- `https://chatgpt.com`
- `null` (para algunos casos)

### Métodos HTTP

ChatGPT principalmente usa:
- `GET` para consultas simples
- `POST` para datos complejos
- `OPTIONS` para preflight CORS

## Troubleshooting

### Si sigue dando error 500:

1. **Verificar logs de Vercel:**
   ```bash
   vercel logs
   ```

2. **Verificar headers en respuesta:**
   ```bash
   curl -I "https://tu-proyecto.vercel.app/health"
   ```

3. **Test local con Vercel dev:**
   ```bash
   npm run vercel-dev
   # En otra terminal:
   curl -X GET "http://localhost:3000/health" -H "User-Agent: ChatGPT-User/1.0"
   ```

### Errores Comunes:

| Error | Causa | Solución |
|-------|-------|----------|
| 500 Internal Server Error | Headers mal configurados | Verificar CORS headers |
| 405 Method Not Allowed | Método HTTP no soportado | Agregar método a CORS |
| 404 Not Found | Ruta mal configurada | Verificar vercel.json |
| Timeout | Request muy lento | Optimizar timeout |

## Configuración Final Aplicada

Todos los endpoints (`/api/proxy.js`, `/api/health.js`, `/api/index.js`) ahora incluyen:

✅ **CORS completo** para ChatGPT
✅ **Headers de seguridad** requeridos
✅ **Content-Type explícito**
✅ **Manejo de OPTIONS** para preflight
✅ **User-Agent logging** para debugging
✅ **Headers optimizados** para requests salientes

## Deploy

Después de estos cambios, redeploy a Vercel:

```bash
npm run deploy
```

La API ahora debería ser completamente accesible desde ChatGPT sin errores 500.
