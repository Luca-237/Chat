https://drive.google.com/file/d/1P341wyQ6Ryq85KJ0GtsvOY4ZU0RzVALU/view?usp=sharing
# Steam Games - Instalación y Configuración

## Estructura de Directorios

```
steam-games/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── ecosystem.config.js
│   └── logs/
└── frontend/
    ├── src/
    │   └── App.js
    ├── package.json
    └── public/
```

## Instalación del Backend

1. **Crear directorio del backend:**
```bash
mkdir -p steam-games/backend
cd steam-games/backend
```

2. **Crear los archivos:**
   - Copiar `server.js` y `package.json` del backend
   - Copiar `ecosystem.config.js`

3. **Instalar dependencias:**
```bash
npm install
```

4. **Crear directorio de logs:**
```bash
mkdir logs
```

5. **Configurar Steam API (Opcional):**
   - Ve a: https://steamcommunity.com/dev/apikey
   - Obtén tu Steam API Key
   - Encuentra tu Steam ID en: https://steamid.io/
   - Edita `server.js` y actualiza el `steamId` en el array de usuarios
   - Configura la variable de entorno `STEAM_API_KEY`

## Instalación del Frontend

1. **Crear la aplicación React:**
```bash
cd ../
npx create-react-app frontend
cd frontend
```

2. **Instalar dependencias adicionales:**
```bash
npm install lucide-react
```

3. **Reemplazar App.js:**
   - Copiar el contenido del archivo `App.js` proporcionado
   - Reemplazar el archivo `src/App.js` existente

4. **Construir para producción:**
```bash
npm run build
```

## Configuración de PM2

1. **Instalar PM2 globalmente:**
```bash
sudo npm install -g pm2
```

2. **Configurar PM2 para iniciar con el sistema:**
```bash
pm2 startup
# Ejecutar el comando que te muestre PM2
```

3. **Iniciar el backend con PM2:**
```bash
cd steam-games/backend
pm2 start ecosystem.config.js
```

4. **Guardar la configuración de PM2:**
```bash
pm2 save
```

## Configuración de Nginx (Recomendado)

1. **Instalar Nginx:**
```bash
sudo apt update
sudo apt install nginx
```

2. **Crear configuración del sitio:**
```bash
sudo nano /etc/nginx/sites-available/steam-games
```

3. **Contenido del archivo de configuración:**
```nginx
server {
    listen 80;
    server_name tu-dominio.com; # Cambia por tu dominio o IP

    # Frontend
    location / {
        root /ruta/a/steam-games/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. **Habilitar el sitio:**
```bash
sudo ln -s /etc/nginx/sites-available/steam-games /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Variables de Entorno

Crea un archivo `.env` en el directorio del backend:

```bash
# Backend/.env
NODE_ENV=production
PORT=3001
JWT_SECRET=tu-secreto-jwt-muy-seguro-aqui
STEAM_API_KEY=tu-steam-api-key-aqui
```

**Importante:** Cambia el `JWT_SECRET` por algo más seguro en producción.

## Configuración de Steam API

1. **Obtener Steam API Key:**
   - Ve a: https://steamcommunity.com/dev/apikey
   - Registra tu dominio/aplicación
   - Copia la API Key

2. **Encontrar tu Steam ID:**
   - Ve a: https://steamid.io/
   - Ingresa tu perfil de Steam
   - Copia el Steam ID 64 (formato: 76561198000000000)

3. **Actualizar usuarios en server.js:**
```javascript
const users = [
  {
    id: 1,
    username: 'tu-usuario',
    password: 'tu-contraseña',
    steamId: '76561198XXXXXXXXX' // Tu Steam ID real
  }
];
```

## Comandos Útiles de PM2

```bash
# Ver estado de los procesos
pm2 status

# Ver logs en tiempo real
pm2 logs steam-games-backend

# Reiniciar la aplicación
pm2 restart steam-games-backend

# Parar la aplicación
pm2 stop steam-games-backend

# Eliminar de PM2
pm2 delete steam-games-backend

# Monitor en tiempo real
pm2 monit
```

## Firewall (UFW)

```bash
# Permitir SSH
sudo ufw allow ssh

# Permitir HTTP y HTTPS
sudo ufw allow 'Nginx Full'

# Habilitar firewall
sudo ufw enable
```

## Testing

1. **Verificar backend:**
```bash
curl http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

2. **Verificar frontend:**
   - Abrir navegador en `http://tu-servidor`
   - Iniciar sesión con: `admin` / `admin123`

## Solución de Problemas

### Backend no inicia:
```bash
pm2 logs steam-games-backend
```

### Error de permisos:
```bash
sudo chown -R $USER:$USER /ruta/a/steam-games
```

### Error de puerto ocupado:
```bash
sudo netstat -tulpn | grep :3001
sudo kill -9 <PID>
```

### Nginx no sirve archivos:
```bash
sudo nginx -t
sudo systemctl status nginx
```

## Usuarios de Prueba

- **Usuario 1:** `admin` / `admin123`
- **Usuario 2:** `user` / `user123`

## Actualización de la Aplicación

1. **Actualizar código:**
```bash
cd steam-games/backend
git pull # si usas git
```

2. **Reinstalar dependencias si es necesario:**
```bash
npm install
```

3. **Reiniciar con PM2:**
```bash
pm2 restart steam-games-backend
```

4. **Para el frontend:**
```bash
cd ../frontend
npm run build
```

## Monitoreo

PM2 incluye un monitor web básico:
```bash
pm2 web
```

Accede a `http://tu-servidor:9615` para ver estadísticas.

## Backup

Respalda regularmente:
- Configuración de PM2: `pm2 dump`
- Código fuente
- Configuración de Nginx
- Variables de entorno

## Consideraciones de Seguridad

1. Cambiar el `JWT_SECRET` por algo más seguro
2. Usar HTTPS en producción
3. Implementar rate limiting
4. Validar y sanitizar inputs
5. Usar variables de entorno para datos sensibles
6. Configurar fail2ban para proteger SSH

Esta configuración te dará una aplicación completa corriendo en PM2 con nginx como proxy reverso.
