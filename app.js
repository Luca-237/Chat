// app.js - Configurado para detectar IP automáticamente

// --- ELEMENTOS DEL DOM ---
const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const usernameInput = document.getElementById('username-input');
const lobbyInput = document.getElementById('lobby-input');
const joinButton = document.getElementById('join-btn');
const roomsListButton = document.getElementById('rooms-list-btn');
const roomsPanel = document.getElementById('rooms-panel');
const roomsList = document.getElementById('rooms-list');
const closeRoomsButton = document.getElementById('close-rooms-btn');
const lobbyTitle = document.getElementById('lobby-title');
const output = document.getElementById('output');
const typingIndicator = document.getElementById('typing-indicator');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-btn');

// --- ESTADO DE LA APLICACIÓN ---
let username = '';
let lobby = '';
let socket;
let typingTimeout;

// Detectar la URL del WebSocket basada en la ubicación actual
function getWebSocketURL() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '8080'; // Puerto del WebSocket
    
    return `${protocol}//${host}:${port}`;
}

// --- LÓGICA DE UNIRSE AL CHAT ---
joinButton.addEventListener('click', joinChat);
roomsListButton.addEventListener('click', showRoomsPanel);
closeRoomsButton.addEventListener('click', hideRoomsPanel);
usernameInput.addEventListener('keypress', (e) => e.key === 'Enter' && joinChat());
lobbyInput.addEventListener('keypress', (e) => e.key === 'Enter' && joinChat());

function joinChat() {
    const userVal = usernameInput.value.trim();
    const lobbyVal = lobbyInput.value.trim();

    if (userVal && lobbyVal) {
        username = userVal;
        lobby = lobbyVal;
        
        loginContainer.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        hideRoomsPanel(); // Cerrar panel de salas si está abierto
        
        lobbyTitle.textContent = `Sala: ${lobby}`;
        connectWebSocket();
    } else {
        alert('Por favor, ingresa un nombre de usuario y un lobby.');
    }
}

function showRoomsPanel() {
    roomsPanel.classList.remove('hidden');
    // Solicitar lista actualizada de salas
    requestRoomsList();
}

function hideRoomsPanel() {
    roomsPanel.classList.add('hidden');
}

function requestRoomsList() {
    // Crear conexión temporal solo para obtener la lista de salas
    const wsUrl = getWebSocketURL();
    const tempSocket = new WebSocket(`${wsUrl}?username=temp&lobby=temp`);
    
    tempSocket.onopen = () => {
        tempSocket.send(JSON.stringify({ type: 'get_rooms' }));
    };

    tempSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'rooms_list') {
            displayRoomsList(data.rooms);
            tempSocket.close();
        }
    };

    tempSocket.onerror = (error) => {
        console.error('Error al conectar para obtener salas:', error);
        roomsList.innerHTML = '<div class="no-rooms">Error al conectar con el servidor</div>';
    };
}

function displayRoomsList(rooms) {
    roomsList.innerHTML = '';
    
    if (rooms.length === 0) {
        roomsList.innerHTML = '<div class="no-rooms">No hay salas activas</div>';
        return;
    }

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        roomElement.innerHTML = `
            <div class="room-info">
                <div class="room-name">${escapeHtml(room.name)}</div>
                <div class="room-users">${room.userCount} usuario${room.userCount !== 1 ? 's' : ''}</div>
                <div class="room-members">${room.users.map(user => escapeHtml(user)).join(', ')}</div>
            </div>
            <button class="join-room-btn" onclick="joinExistingRoom('${escapeHtml(room.name)}')">Unirse</button>
        `;
        roomsList.appendChild(roomElement);
    });
}

function joinExistingRoom(roomName) {
    if (!usernameInput.value.trim()) {
        alert('Primero ingresa tu nombre de usuario');
        usernameInput.focus();
        return;
    }
    
    lobbyInput.value = roomName;
    hideRoomsPanel();
    joinChat();
}

function connectWebSocket() {
    // Conectamos usando la URL detectada automáticamente
    const wsUrl = getWebSocketURL();
    const fullUrl = `${wsUrl}?username=${encodeURIComponent(username)}&lobby=${encodeURIComponent(lobby)}`;
    
    console.log('Conectando a:', fullUrl);
    socket = new WebSocket(fullUrl);

    socket.onopen = () => {
        console.log("WebSocket conectado al servidor.");
        displaySystemMessage('Te has unido al chat.');
        // Habilitamos los controles de envío
        sendButton.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (error) {
            console.error('Error al parsear mensaje:', error);
        }
    };

    socket.onerror = (error) => {
        console.error("Error de WebSocket:", error);
        displaySystemMessage('Error de conexión. Verifica que el servidor esté funcionando.');
    };

    socket.onclose = () => {
        console.log("WebSocket desconectado.");
        displaySystemMessage('Te has desconectado. Puedes recargar la página para volver a unirte.');
        sendButton.disabled = true;
        messageInput.disabled = true;
    };
}

// --- MANEJO DE MENSAJES RECIBIDOS ---
function handleMessage(data) {
    // Limpiamos el indicador de "escribiendo" si el mensaje es del mismo usuario que estaba escribiendo
    if (typingIndicator.textContent.includes(data.user)) {
        typingIndicator.textContent = '';
    }
    
    switch(data.type) {
        case 'message':
            // Solo mostramos mensajes de otros usuarios, no los nuestros (para evitar duplicados)
            if (data.user !== username) {
                displayChatMessage(data.user, data.text);
            }
            break;
        case 'user_join':
            if (data.user !== username) {
                displaySystemMessage(`${data.user} se ha unido.`);
            }
            break;
        case 'user_leave':
            displaySystemMessage(`${data.user} se ha ido.`);
            break;
        case 'typing':
            if (data.user !== username) {
                typingIndicator.textContent = `${data.user} está escribiendo...`;
            }
            break;
        case 'stop_typing':
            if (typingIndicator.textContent.includes(data.user)) {
                typingIndicator.textContent = '';
            }
            break;
        case 'rooms_list':
            // Actualizar lista de salas si el panel está abierto
            if (!roomsPanel.classList.contains('hidden')) {
                displayRoomsList(data.rooms);
            }
            break;
    }
}

// --- FUNCIONES DE VISUALIZACIÓN ---
function displayChatMessage(user, message) {
    const p = document.createElement('p');
    p.innerHTML = `<strong>${escapeHtml(user)}:</strong> ${escapeHtml(message)}`;
    p.className = (user === username) ? 'message-own' : 'message-other';
    output.appendChild(p);
    scrollToBottom();
}

function displaySystemMessage(message) {
    const p = document.createElement('p');
    p.className = 'message-system';
    p.textContent = message;
    output.appendChild(p);
    scrollToBottom();
}

function scrollToBottom() {
    output.parentElement.scrollTop = output.parentElement.scrollHeight;
}

// Función para escapar HTML y prevenir XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- LÓGICA DE ENVÍO ---
function sendMessage() {
    const messageText = messageInput.value.trim();
    if (messageText && socket.readyState === WebSocket.OPEN) {
        const message = { type: 'message', text: messageText };
        socket.send(JSON.stringify(message));
        
        // Mostramos nuestro mensaje localmente
        displayChatMessage(username, messageText);
        messageInput.value = '';
        
        // Limpiamos el indicador de typing
        clearTimeout(typingTimeout);
        sendTypingStatus(false);
    }
}

function sendTypingStatus(isTyping) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const type = isTyping ? 'typing' : 'stop_typing';
        const message = { type: type };
        socket.send(JSON.stringify(message));
    }
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

messageInput.addEventListener('input', () => {
    if (messageInput.value.trim().length > 0) {
        clearTimeout(typingTimeout);
        sendTypingStatus(true);
        typingTimeout = setTimeout(() => sendTypingStatus(false), 2000);
    } else {
        clearTimeout(typingTimeout);
        sendTypingStatus(false);
    }
});

// Limpiar typing cuando el usuario deja de escribir
messageInput.addEventListener('blur', () => {
    clearTimeout(typingTimeout);
    sendTypingStatus(false);
});

// Mostrar información de conexión en la consola al cargar la página
console.log('🌐 Chat WebSocket');
console.log('Servidor detectado:', getWebSocketURL());
console.log('Página servida desde:', window.location.origin);