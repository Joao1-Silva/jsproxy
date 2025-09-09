# 🚀 Setup Local Development

## ⚠️ Prerequisitos Requeridos

### 1. Instalar Node.js
Node.js no está instalado en tu sistema. Necesitas instalarlo primero:

**Opción A - Descarga Oficial:**
1. Ve a [https://nodejs.org/](https://nodejs.org/)
2. Descarga la versión LTS (recomendada)
3. Ejecuta el instalador y sigue las instrucciones
4. Reinicia tu terminal/PowerShell

**Opción B - Chocolatey (si tienes Chocolatey):**
```powershell
choco install nodejs
```

**Opción C - Scoop (si tienes Scoop):**
```powershell
scoop install nodejs
```

### 2. Verificar Instalación
Después de instalar Node.js, verifica que esté funcionando:
```powershell
node --version
npm --version
```

## 📦 Instalar Dependencias del Proyecto

Una vez que Node.js esté instalado:

```powershell
# Navegar al directorio del proyecto
cd "c:\Users\Jonathan Silva\Desktop\jsproxy"

# Instalar dependencias
npm install
```

## 🔧 Configurar Google Drive

Asegúrate de que el archivo `google.json` esté en la raíz del proyecto con las credenciales correctas.

## 🚀 Ejecutar el Proyecto

```powershell
# Iniciar servidor de desarrollo
npm start

# O usar nodemon para desarrollo (si está instalado)
npm run dev
```

## 🧪 Probar Endpoints

Una vez que el servidor esté corriendo en `http://localhost:3000`:

### Endpoints Principales:
- **Documentación**: `http://localhost:3000/`
- **Health Check**: `http://localhost:3000/health`
- **Proxy Data**: `http://localhost:3000/proxy`
- **Backup Manual**: `http://localhost:3000/backup`
- **Test Google Drive**: `http://localhost:3000/backup?test=connection`

### Pruebas con curl:
```powershell
# Test health
curl http://localhost:3000/health

# Test backup
curl http://localhost:3000/backup

# Test Google Drive connection
curl "http://localhost:3000/backup?test=connection"
```

## 📋 Verificar Funcionamiento

1. **Timer Automático**: El backup se ejecuta cada minuto automáticamente
2. **Logs**: Revisa la consola para ver los logs del backup
3. **Google Drive**: Verifica que se cree/actualice `data.json` en tu Google Drive

## 🔍 Troubleshooting

### Si hay errores de dependencias:
```powershell
npm cache clean --force
npm install
```

### Si el puerto 3000 está ocupado:
```powershell
# Cambiar puerto en server.js o usar:
set PORT=3001 && npm start
```

### Si hay errores de Google Drive:
1. Verifica que `google.json` existe
2. Comprueba que la carpeta esté compartida con el service account
3. Usa el endpoint de test: `/backup?test=connection`
