#!/bin/bash
# Script de configuración automática de IP
# Guarda como: setup-ip.sh

echo "🚀 Configuración Automática de Steam Games"
echo "==========================================="

# 1. Detectar IP automáticamente
echo "📍 Detectando configuración de red..."

# IP privada (red local)
PRIVATE_IP=$(hostname -I | awk '{print $1}')

# IP pública (internet)
PUBLIC_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "No disponible")

echo ""
echo "🔍 IPs detectadas:"
echo "   - IP Local (LAN): $PRIVATE_IP"
echo "   - IP Pública: $PUBLIC_IP"
echo ""

# 2. Preguntar cuál usar
echo "¿Qué configuración quieres?"
echo "1) Solo red local (acceso desde tu red WiFi/LAN)"
echo "2) Acceso público (desde internet - requiere configurar router)"
echo "3) Ambas (recomendado)"
echo ""
read -p "Selecciona (1-3): " OPTION

case $OPTION in
    1)
        MAIN_IP=$PRIVATE_IP
        echo "✅ Configurando para red local: $PRIVATE_IP"
        ;;
    2)
        MAIN_IP=$PUBLIC_IP
        echo "✅ Configurando para acceso público: $PUBLIC_IP"
        ;;
    3)
        MAIN_IP=$PRIVATE_IP
        echo "✅ Configurando para ambas: $PRIVATE_IP y $PUBLIC_IP"
        ;;
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac

# 3. Actualizar configuración del frontend
echo ""
echo "🔧 Actualizando configuración del frontend..."

cd ~/steam-games/frontend/src

# Crear backup
cp App.js App.js.backup.$(date +%Y%m%d_%H%M%S)

# Actualizar la URL de la API
sed -i "s|const API_URL = 'http://localhost:3001/api';|const API_URL = 'http://$MAIN_IP:3001/api';|g" App.js

echo "✅ Frontend actualizado para usar: http://$MAIN_IP:3001/api"

# 4. Actualizar configuración de Nginx
echo ""
echo "🔧 Actualizando configuración de Nginx..."

# Crear configuración de nginx
sudo tee /etc/nginx/sites-available/steam-games > /dev/null <<EOF
server {
    listen 80;
    server_name $PRIVATE_IP $PUBLIC_IP localhost;

    # Frontend
    location / {
        root $HOME/steam-games/frontend/build;
        try_files \$uri \$uri/ /index.html;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
        add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
    }
}
EOF

# Activar configuración
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/steam-games /etc/nginx/sites-enabled/

# Verificar nginx
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx configurado correctamente"
else
    echo "❌ Error en configuración de nginx"
    exit 1
fi

# 5. Actualizar configuración del backend para CORS
echo ""
echo "🔧 Actualizando backend para CORS..."

cd ~/steam-games/backend

# Actualizar server.js para permitir CORS desde cualquier origen en desarrollo
sed -i "s|app.use(cors());|app.use(cors({origin: true, credentials: true}));|g" server.js

# 6. Reconstruir frontend
echo ""
echo "🏗️ Reconstruyendo frontend..."
cd ~/steam-games/frontend
npm run build

# 7. Reiniciar servicios
echo ""
echo "🔄 Reiniciando servicios..."
pm2 restart all

echo ""
echo "🎉 ¡Configuración completada!"
echo ""
echo "📱 Puedes acceder desde:"

if [ $OPTION -eq 1 ] || [ $OPTION -eq 3 ]; then
    echo "   🏠 Red local: http://$PRIVATE_IP"
fi

if [ $OPTION -eq 2 ] || [ $OPTION -eq 3 ]; then
    echo "   🌐 Internet: http://$PUBLIC_IP"
    echo "   ⚠️  Para acceso desde internet, configura tu router:"
    echo "      - Port forwarding: Puerto 80 → $PRIVATE_IP:80"
fi

echo ""
echo "👤 Usuarios de prueba:"
echo "   - admin / admin123"
echo "   - user / user123"
echo ""
echo "🔧 Comandos útiles:"
echo "   pm2 status          # Ver estado"
echo "   pm2 logs            # Ver logs"
echo "   sudo nginx -t       # Verificar nginx"
echo ""
