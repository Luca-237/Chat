// server.js - Servidor Local Mejorado para Múltiples Dispositivos

import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8080;
const HTTP_PORT = 3000;

// Variable global para el servidor WebSocket
let wss;
const lobbies = new Map();

// Función mejorada para obtener todas las IPs locales disponibles
function getAllLocalIPs() {
    const nets = os.networkInterfaces();
    const localIPs = [];

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Incluir solo IPv4 y excluir direcciones internas (127.x.x.x)
            if (net.family === 'IPv4' && !net.internal) {
                localIPs.push({
                    interface: name,
                    address: net.address,
                    primary: name.toLowerCase().includes('wifi') || name.toLowerCase().includes('ethernet')
                });
            }
        }
    }
    
    // Ordenar para que WiFi/Ethernet aparezcan primero
    localIPs.sort((a, b) => b.primary - a.primary);
    return localIPs;
}

// Función para detectar el puerto disponible automáticamente
async function findAvailablePort(startPort, isWebSocket = false) {
    return new Promise((resolve, reject) => {
        if (isWebSocket) {
            // Para WebSocket, creamos un servidor temporal WebSocket
            const testWss = new WebSocketServer({ port: startPort }, (err) => {
                if (err) {
                    if (err.code === 'EADDRINUSE') {
                        testWss.close();
                        resolve(findAvailablePort(startPort + 1, true));
                    } else {
                        reject(err);
                    }
                } else {
                    testWss.close();
                    resolve(startPort);
                }
            });
        } else {
            // Para HTTP
            const server = http.createServer();
            server.listen(startPort, '0.0.0.0', (err) => {
                if (err) {
                    server.close();
                    if (err.code === 'EADDRINUSE') {
                        resolve(findAvailablePort(startPort + 1, false));
                    } else {
                        reject(err);
                    }
                } else {
                    const port = server.address().port;
                    server.close();
                    resolve(port);
                }
            });
        }
    });
}

// Función para generar código QR en consola (ASCII)
function generateQRCode(text) {
    // Esta es una representación simple. Para un QR real, usarías una librería como 'qrcode'
    console.log(`\n📱 Código QR (instala 'qrcode-terminal' para ver el QR real):`);
    console.log(`   npm install qrcode-terminal`);
    console.log(`   Luego añade: import qrcode from 'qrcode-terminal';`);
    console.log(`   Y usa: qrcode.generate('${text}');`);
}

// Mejorar la función de obtención de IP pública
async function getPublicIP() {
    const services = [
        'https://api.ipify.org?format=json',
        'https://ipapi.co/json/',
        'https://ifconfig.me/ip'
    ];
    
    for (const service of services) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(service, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (service.includes('ipify')) {
                const data = await response.json();
                return data.ip;
            } else if (service.includes('ipapi')) {
                const data = await response.json();
                return data.ip;
            } else {
                return await response.text().then(ip => ip.trim());
            }
        } catch (error) {
            continue; // Intentar con el siguiente servicio
        }
    }
    return null;
}

// Crear servidor HTTP con CORS habilitado para conexiones externas
const server = http.createServer((req, res) => {
    // Habilitar CORS para todas las solicitudes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    // Ruta especial para obtener información del servidor
    if (req.url === '/server-info') {
        const serverInfo = {
            localIPs: getAllLocalIPs(),
            httpPort: server.address()?.port || HTTP_PORT,
            wsPort: wss?.options?.port || PORT,
            timestamp: new Date().toISOString(),
            activeLobbies: lobbies.size,
            totalClients: Array.from(lobbies.values()).reduce((sum, lobby) => sum + lobby.clients.size, 0)
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(serverInfo, null, 2));
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.svg': 'application/image/svg+xml'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404 - Archivo no encontrado', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Error del servidor: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Función para configurar los manejadores de WebSocket
function setupWebSocketHandlers(websocketServer, wsPort) {
    console.log(`📡 Servidor WebSocket configurado en puerto ${wsPort}`);
    
    // Manejo mejorado de conexiones WebSocket
    websocketServer.on('connection', (ws, req) => {
        const clientIP = req.socket.remoteAddress;
        console.log(`🔗 Nueva conexión desde: ${clientIP}`);
        
        const url = new URL(req.url, `http://${req.headers.host}`);
        const username = url.searchParams.get('username');
        const lobbyName = url.searchParams.get('lobby');

        if (!username || !lobbyName) {
            console.log(`❌ Conexión rechazada desde ${clientIP}: Faltan parámetros`);
            ws.close(1008, 'Faltan nombre de usuario o lobby');
            return;
        }

        ws.username = username;
        ws.lobbyName = lobbyName;
        ws.clientIP = clientIP;

        // Crear lobby si no existe
        if (!lobbies.has(lobbyName)) {
            lobbies.set(lobbyName, {
                clients: new Set(),
                createdAt: new Date().toISOString()
            });
            console.log(`🏠 Nuevo lobby creado: '${lobbyName}'`);
        }
        
        lobbies.get(lobbyName).clients.add(ws);
        console.log(`👤 '${username}' se unió al lobby '${lobbyName}' desde ${clientIP}`);

        // Notificar unión
        const joinMessage = {
            type: 'user_join',
            user: username,
            timestamp: new Date().toISOString()
        };
        broadcast(lobbyName, JSON.stringify(joinMessage));
        broadcastRoomsList();

        // Manejo de mensajes
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'get_rooms') {
                    const roomsMessage = {
                        type: 'rooms_list',
                        rooms: getRoomsInfo()
                    };
                    ws.send(JSON.stringify(roomsMessage));
                    return;
                }
                
                // Añadir información adicional
                data.user = ws.username;
                data.lobby = ws.lobbyName;
                data.timestamp = new Date().toISOString();
                
                broadcast(ws.lobbyName, JSON.stringify(data), ws);
            } catch (error) {
                console.error(`❌ Error procesando mensaje de ${ws.username}:`, error);
            }
        });

        // Manejo de desconexiones
        ws.on('close', (code, reason) => {
            console.log(`👋 '${ws.username}' desconectado del lobby '${ws.lobbyName}' (${code})`);

            const lobby = lobbies.get(ws.lobbyName);
            if (lobby) {
                lobby.clients.delete(ws);

                if (lobby.clients.size === 0) {
                    lobbies.delete(ws.lobbyName);
                    console.log(`🗑️ Lobby '${ws.lobbyName}' eliminado (vacío)`);
                } else {
                    const leaveMessage = {
                        type: 'user_leave',
                        user: ws.username,
                        timestamp: new Date().toISOString()
                    };
                    broadcast(ws.lobbyName, JSON.stringify(leaveMessage));
                }
                broadcastRoomsList();
            }
        });

        ws.on('error', (error) => {
            console.error(`❌ Error en conexión de '${ws.username}':`, error.message);
        });
    });
    
    return websocketServer;
}

function getRoomsInfo() {
    const rooms = [];
    for (const [roomName, roomData] of lobbies.entries()) {
        rooms.push({
            name: roomName,
            users: Array.from(roomData.clients).map(client => client.username),
            userCount: roomData.clients.size,
            createdAt: roomData.createdAt
        });
    }
    return rooms;
}

// Función para mostrar información de conexión de manera más clara
function displayConnectionInfo(localIPs, publicIP, httpPort, wsPort) {
    console.clear(); // Limpiar consola para mejor presentación
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║             🚀 SERVIDOR LOCAL INICIADO              ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    
    // Mostrar todas las IPs locales disponibles
    console.log('║ 🏠 CONEXIONES LOCALES:                              ║');
    localIPs.forEach((ip) => {
        const indicator = ip.primary ? '⭐' : '  ';
        console.log(`║ ${indicator} ${ip.interface.padEnd(12)} http://${ip.address}:${httpPort.toString().padEnd(8)} ║`);
    });
    
    console.log('║                                                      ║');
    console.log('║ 📡 WEBSOCKET:                                        ║');
    localIPs.forEach((ip) => {
        const indicator = ip.primary ? '⭐' : '  ';
        console.log(`║ ${indicator} ${ip.interface.padEnd(12)} ws://${ip.address}:${wsPort.toString().padEnd(10)} ║`);
    });
    
    if (publicIP) {
        console.log('║                                                      ║');
        console.log('║ 🌍 CONEXIÓN EXTERNA (requiere port forwarding):     ║');
        console.log(`║    HTTP: http://${publicIP}:${httpPort}                    ║`);
        console.log(`║    WS:   ws://${publicIP}:${wsPort}                      ║`);
    }
    
    console.log('║                                                      ║');
    console.log('║ 📋 INSTRUCCIONES:                                   ║');
    console.log('║ • Comparte la IP marcada con ⭐ con otros usuarios   ║');
    console.log('║ • Asegúrate de que el firewall permita las conexiones║');
    console.log('║ • Para conexiones externas, configura port forwarding║');
    console.log('╚══════════════════════════════════════════════════════╝');
    
    // Mostrar la IP principal recomendada
    const primaryIP = localIPs.find(ip => ip.primary) || localIPs[0];
    if (primaryIP) {
        console.log(`\n🔗 ENLACE RECOMENDADO PARA COMPARTIR:`);
        console.log(`   http://${primaryIP.address}:${httpPort}`);
        generateQRCode(`http://${primaryIP.address}:${httpPort}`);
    }
}

function broadcast(lobbyName, message, excludeClient) {
    const lobby = lobbies.get(lobbyName);
    if (lobby) {
        let sentCount = 0;
        for (const client of lobby.clients) {
            if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
                client.send(message);
                sentCount++;
            }
        }
        // console.log(`📤 Mensaje enviado a ${sentCount} clientes en '${lobbyName}'`);
    }
}

function broadcastRoomsList() {
    const roomsMessage = {
        type: 'rooms_list',
        rooms: getRoomsInfo(),
        timestamp: new Date().toISOString()
    };
    const message = JSON.stringify(roomsMessage);
    
    for (const [roomName, roomData] of lobbies.entries()) {
        for (const client of roomData.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }
}

async function startServer() {
    try {
        // Obtener todas las IPs locales
        const localIPs = getAllLocalIPs();
        
        if (localIPs.length === 0) {
            console.error('❌ No se encontraron interfaces de red válidas');
            return;
        }
        
        // Verificar puertos disponibles
        console.log('🔄 Verificando puertos disponibles...');
        const availableHTTPPort = await findAvailablePort(HTTP_PORT, false);
        const availableWSPort = await findAvailablePort(PORT, true);
        
        if (availableHTTPPort !== HTTP_PORT) {
            console.warn(`⚠️ Puerto HTTP ${HTTP_PORT} ocupado, usando ${availableHTTPPort}`);
        }
        if (availableWSPort !== PORT) {
            console.warn(`⚠️ Puerto WebSocket ${PORT} ocupado, usando ${availableWSPort}`);
        }
        
        // Obtener IP pública (opcional)
        console.log('🔄 Obteniendo IP pública...');
        const publicIP = await getPublicIP();
        
        // Crear el servidor WebSocket con el puerto disponible
        wss = new WebSocketServer({ 
            port: availableWSPort,
            perMessageDeflate: false 
        });
        
        // Configurar el manejo de WebSocket
        setupWebSocketHandlers(wss, availableWSPort);
        
        // Iniciar servidor HTTP
        server.listen(availableHTTPPort, '0.0.0.0', () => {
            displayConnectionInfo(localIPs, publicIP, availableHTTPPort, availableWSPort);
            console.log('\n⚡ Servidor listo para recibir conexiones!');
            console.log('   Presiona Ctrl+C para detener el servidor\n');
        });

    } catch (error) {
        console.error('❌ Error fatal al iniciar el servidor:', error);
        process.exit(1);
    }
}

// Manejo de cierre del servidor
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servidor...');
    
    // Cerrar todas las conexiones WebSocket si existe
    if (wss) {
        for (const [roomName, roomData] of lobbies.entries()) {
            for (const client of roomData.clients) {
                client.close(1001, 'Servidor cerrando');
            }
        }
        wss.close();
    }
    
    server.close(() => {
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
    });
});

// Mostrar estadísticas periódicamente
setInterval(() => {
    const totalClients = Array.from(lobbies.values()).reduce((sum, lobby) => sum + lobby.clients.size, 0);
    if (totalClients > 0) {
        console.log(`📊 Estadísticas: ${lobbies.size} lobbies activos, ${totalClients} clientes conectados`);
    }
}, 30000); // Cada 30 segundos

// Iniciar el servidor
startServer();