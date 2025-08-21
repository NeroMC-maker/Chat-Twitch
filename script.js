import tmi from 'tmi.js';
import { config } from './config.js';

// Configuración del cliente
const client = new tmi.Client({
    options: { 
        debug: false,
        messagesLogLevel: "info"
    },
    connection: {
        secure: true,
        reconnect: true
    },
    channels: [config.channel]
});

// Cache para fotos de perfil y emotes
const profilePicCache = new Map();
const emotesCache = {
    twitch: new Map(),
    bttv: new Map(),
    ffz: new Map(),
    '7tv': new Map()
};

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM5MTQ2ZkYiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTRzLTEuNzktNC00LTQtNCAxLjc5LTQgNHMxLjc5IDQgNCA0em0wIDJjLTIuNjcgMC04IDEuMzQtOCA0djJoMTZ2LTJjMC0yLjY2LTUuMzMtNC04LTR6Ii8+Cjwvc3ZnPgo8L3N2Zz4K';

let messageCount = 0;
let channelId = null;
const animationTypes = ['slideInRight', 'bounce-in', 'fade-in', 'zoom-in'];

// ============ FUNCIONES PARA OBTENER EMOTES ============

// Obtener ID del canal
async function getChannelId(channelName) {
    try {
        const response = await fetch(`https://api.twitch.tv/helix/users?login=${channelName.replace('#', '')}`, {
            headers: {
                'Client-ID': config.clientId,
                'Authorization': `Bearer ${config.accessToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                return data.data[0].id;
            }
        }
    } catch (error) {
        console.warn('Error obteniendo ID del canal:', error);
    }
    return null;
}

// Cargar emotes globales de Twitch
async function loadTwitchGlobalEmotes() {
    try {
        const response = await fetch('https://api.twitch.tv/helix/chat/emotes/global', {
            headers: {
                'Client-ID': config.clientId,
                'Authorization': `Bearer ${config.accessToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            data.data.forEach(emote => {
                emotesCache.twitch.set(emote.name, {
                    id: emote.id,
                    url: `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`,
                    name: emote.name
                });
            });
            console.log(`✅ Cargados ${data.data.length} emotes globales de Twitch`);
        }
    } catch (error) {
        console.error('Error cargando emotes globales de Twitch:', error);
    }
}

// Cargar emotes del canal de Twitch
async function loadTwitchChannelEmotes(channelId) {
    if (!channelId) return;
    
    try {
        const response = await fetch(`https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${channelId}`, {
            headers: {
                'Client-ID': config.clientId,
                'Authorization': `Bearer ${config.accessToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            data.data.forEach(emote => {
                emotesCache.twitch.set(emote.name, {
                    id: emote.id,
                    url: `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`,
                    name: emote.name
                });
            });
            console.log(`✅ Cargados ${data.data.length} emotes del canal en Twitch`);
        }
    } catch (error) {
        console.error('Error cargando emotes del canal:', error);
    }
}

// Cargar emotes globales de BetterTTV
async function loadBTTVGlobalEmotes() {
    try {
        const response = await fetch('https://api.betterttv.net/3/cached/emotes/global');
        
        if (response.ok) {
            const emotes = await response.json();
            emotes.forEach(emote => {
                emotesCache.bttv.set(emote.code, {
                    id: emote.id,
                    url: `https://cdn.betterttv.net/emote/${emote.id}/1x`,
                    name: emote.code
                });
            });
            console.log(`✅ Cargados ${emotes.length} emotes globales de BetterTTV`);
        }
    } catch (error) {
        console.error('Error cargando emotes de BetterTTV:', error);
    }
}

// Cargar emotes del canal de BetterTTV
async function loadBTTVChannelEmotes(channelId) {
    if (!channelId) return;
    
    try {
        const response = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channelId}`);
        
        if (response.ok) {
            const data = await response.json();
            
            // Emotes propios del canal
            if (data.channelEmotes) {
                data.channelEmotes.forEach(emote => {
                    emotesCache.bttv.set(emote.code, {
                        id: emote.id,
                        url: `https://cdn.betterttv.net/emote/${emote.id}/1x`,
                        name: emote.code
                    });
                });
            }
            
            // Emotes compartidos
            if (data.sharedEmotes) {
                data.sharedEmotes.forEach(emote => {
                    emotesCache.bttv.set(emote.code, {
                        id: emote.id,
                        url: `https://cdn.betterttv.net/emote/${emote.id}/1x`,
                        name: emote.code
                    });
                });
            }
            
            const total = (data.channelEmotes?.length || 0) + (data.sharedEmotes?.length || 0);
            console.log(`✅ Cargados ${total} emotes del canal en BetterTTV`);
        }
    } catch (error) {
        console.error('Error cargando emotes del canal de BetterTTV:', error);
    }
}

// Cargar emotes de FrankerFaceZ
async function loadFFZEmotes(channelName) {
    try {
        // Emotes globales
        const globalResponse = await fetch('https://api.frankerfacez.com/v1/set/global');
        if (globalResponse.ok) {
            const globalData = await globalResponse.json();
            Object.values(globalData.sets).forEach(set => {
                set.emoticons.forEach(emote => {
                    const url = `https:${emote.urls['1'] || Object.values(emote.urls)[0]}`;
                    emotesCache.ffz.set(emote.name, {
                        id: emote.id,
                        url: url,
                        name: emote.name
                    });
                });
            });
        }
        
        // Emotes del canal
        const channelResponse = await fetch(`https://api.frankerfacez.com/v1/room/${channelName.replace('#', '')}`);
        if (channelResponse.ok) {
            const channelData = await channelResponse.json();
            Object.values(channelData.sets).forEach(set => {
                set.emoticons.forEach(emote => {
                    const url = `https:${emote.urls['1'] || Object.values(emote.urls)[0]}`;
                    emotesCache.ffz.set(emote.name, {
                        id: emote.id,
                        url: url,
                        name: emote.name
                    });
                });
            });
        }
        
        console.log(`✅ Cargados ${emotesCache.ffz.size} emotes de FrankerFaceZ`);
    } catch (error) {
        console.error('Error cargando emotes de FFZ:', error);
    }
}

// Cargar emotes de 7TV
async function load7TVEmotes(channelName) {
    try {
        // Emotes globales
        const globalResponse = await fetch('https://7tv.io/v3/emote-sets/global');
        if (globalResponse.ok) {
            const globalData = await globalResponse.json();
            globalData.emotes.forEach(emote => {
                emotesCache['7tv'].set(emote.name, {
                    id: emote.id,
                    url: `https://cdn.7tv.app/emote/${emote.id}/1x.webp`,
                    name: emote.name
                });
            });
        }
        
        // Emotes del canal
        const userResponse = await fetch(`https://7tv.io/v3/users/twitch/${channelName.replace('#', '')}`);
        if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.emote_set && userData.emote_set.emotes) {
                userData.emote_set.emotes.forEach(emote => {
                    emotesCache['7tv'].set(emote.name, {
                        id: emote.id,
                        url: `https://cdn.7tv.app/emote/${emote.id}/1x.webp`,
                        name: emote.name
                    });
                });
            }
        }
        
        console.log(`✅ Cargados ${emotesCache['7tv'].size} emotes de 7TV`);
    } catch (error) {
        console.error('Error cargando emotes de 7TV:', error);
    }
}

// Inicializar todos los emotes
async function initializeEmotes() {
    console.log('🔄 Cargando emotes...');
    
    // Obtener ID del canal
    channelId = await getChannelId(config.channel);
    
    // Cargar todos los emotes en paralelo
    await Promise.all([
        loadTwitchGlobalEmotes(),
        loadTwitchChannelEmotes(channelId),
        loadBTTVGlobalEmotes(),
        loadBTTVChannelEmotes(channelId),
        loadFFZEmotes(config.channel),
        load7TVEmotes(config.channel)
    ]);
    
    const totalEmotes = emotesCache.twitch.size + emotesCache.bttv.size + 
                       emotesCache.ffz.size + emotesCache['7tv'].size;
    console.log(`🎉 Total de emotes cargados: ${totalEmotes}`);
}

// ============ FUNCIÓN MEJORADA PARA PROCESAR EMOTES ============

function processEmotes(message, twitchEmotes = null) {
    let processedMessage = message;
    
    // Primero procesar emotes nativos de Twitch si vienen en el mensaje
    if (twitchEmotes && Object.keys(twitchEmotes).length > 0) {
    const sortedEmotes = Object.keys(twitchEmotes)
        .map(id => twitchEmotes[id].map(pos => ({ 
            id, 
            startIndex: parseInt(pos.split('-')[0]), 
            endIndex: parseInt(pos.split('-')[1])
        })))
        .flat()
        .sort((a, b) => b.startIndex - a.startIndex);
        
        sortedEmotes.forEach(emote => {
            const emoteName = message.substring(emote.startIndex, emote.endIndex + 1);
            const emoteImg = `<img src="https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0" alt="${emoteName}" class="emote-img">`;
            
            processedMessage = processedMessage.substring(0, emote.startIndex) + 
                             emoteImg + 
                             processedMessage.substring(emote.endIndex + 1);
        });
        
        return processedMessage;
    }
    
    // Procesar emotes de terceros (palabra completa)
    const words = processedMessage.split(/(\s+)/);
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i].trim();
        if (!word || /^\s+$/.test(words[i])) continue;
        
        let emoteFound = false;
        
        // Buscar en todas las cachés de emotes
        const caches = [
            { cache: emotesCache.twitch, type: 'twitch' },
            { cache: emotesCache.bttv, type: 'bttv' },
            { cache: emotesCache.ffz, type: 'ffz' },
            { cache: emotesCache['7tv'], type: '7tv' }
        ];
        
        for (const { cache, type } of caches) {
            if (cache.has(word)) {
                const emote = cache.get(word);
                words[i] = words[i].replace(word, 
                    `<img src="${emote.url}" alt="${emote.name}" class="emote-img" title="${emote.name} (${type})">`
                );
                emoteFound = true;
                break;
            }
        }
    }
    
    return words.join('');
}

// ============ RESTO DEL CÓDIGO (sin cambios significativos) ============

// Función para obtener foto de perfil
async function getProfilePicture(username) {
    if (profilePicCache.has(username)) {
        return profilePicCache.get(username);
    }
    
    try {
        const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
            headers: {
                'Client-ID': config.clientId,
                'Authorization': `Bearer ${config.accessToken}`
            }
        });
        
        if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.data && userData.data.length > 0) {
                const profilePic = userData.data[0].profile_image_url;
                profilePicCache.set(username, profilePic);
                return profilePic;
            }
        }
    } catch (error) {
        console.warn('Error obteniendo foto de perfil:', error);
    }
    
    profilePicCache.set(username, defaultAvatar);
    return defaultAvatar;
}

// Conectar y inicializar
client.connect().then(async () => {
    console.log('🎉 ¡Conectado correctamente!');
    await initializeEmotes();
}).catch(err => {
    console.error('❌ Error:', err);
});

// Escuchar mensajes
client.on('message', async (channel, tags, message, self) => {
    messageCount++;
    console.log('📨', tags['display-name'] + ':', message);
    await addMessageToOverlay(tags['display-name'], message, tags);
});

// Función principal para agregar mensajes
async function addMessageToOverlay(username, message, tags) {
    const chatContainer = document.getElementById('chat-container');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    addSpecialEffects(messageDiv, message, tags);
    
    const userIcon = await createUserIcon(tags, username);
    const messageContent = createMessageContent(username, message, tags);
    
    messageDiv.appendChild(userIcon);
    messageDiv.appendChild(messageContent);
    chatContainer.appendChild(messageDiv);
    
    smoothScrollToBottom(chatContainer);
    
    if (chatContainer.children.length > config.maxMessages) {
        const firstChild = chatContainer.firstChild;
        firstChild.style.animation = 'fadeOut 0.5s ease-out';
        setTimeout(() => {
            if (firstChild.parentNode) {
                chatContainer.removeChild(firstChild);
            }
        }, 500);
    }
}

async function createUserIcon(tags, username) {
    const userIcon = document.createElement('div');
    userIcon.className = 'user-icon';
    
    const profilePic = await getProfilePicture(username);
    
    const img = document.createElement('img');
    img.src = profilePic;
    img.alt = username;
    img.style.cssText = 'width: 32px; height: 32px; border-radius: 50%; object-fit: cover; display: block;';
    
    userIcon.appendChild(img);
    
    if (tags.broadcaster) {
        userIcon.style.background = 'linear-gradient(135deg, #FFD700, #FFA500)';
        userIcon.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.8)';
    } else if (tags.mod) {
        userIcon.style.background = 'linear-gradient(135deg, #00FF00, #32CD32)';
        userIcon.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.8)';
    } else if (tags.subscriber) {
        userIcon.style.background = 'linear-gradient(135deg, #9146ff, #7c3aed)';
        userIcon.style.boxShadow = '0 0 15px rgba(145, 70, 255, 0.8)';
    } else if (tags.vip) {
        userIcon.style.background = 'linear-gradient(135deg, #FF69B4, #FF1493)';
        userIcon.style.boxShadow = '0 0 15px rgba(255, 105, 180, 0.8)';
    }
    
    return userIcon;
}

function createMessageContent(username, message, tags) {
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';
    
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.style.color = tags.color || getRandomColor();
    usernameSpan.textContent = username;
    
    let badgeText = '';
    if (tags.broadcaster) {
        badgeText = ' 👑';
    } else if (tags.mod) {
        badgeText = ' 🔨';
    } else if (tags.subscriber) {
        badgeText = ' ⭐';
    } else if (tags.vip) {
        badgeText = ' 💎';
    }
    
    if (badgeText) {
        const badgeSpan = document.createElement('span');
        badgeSpan.textContent = badgeText;
        usernameSpan.appendChild(badgeSpan);
    }
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = getCurrentTime();
    
    header.appendChild(usernameSpan);
    header.appendChild(timestamp);
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.innerHTML = processEmotes(message, tags.emotes);
    
    messageContent.appendChild(header);
    messageContent.appendChild(messageText);
    
    return messageContent;
}

function addSpecialEffects(messageDiv, message, tags) {
    if (messageCount % 5 === 0) {
        const randomAnimation = animationTypes[Math.floor(Math.random() * animationTypes.length)];
        messageDiv.classList.add(randomAnimation);
    }
    
    if (message.includes('!') || message === message.toUpperCase()) {
        messageDiv.classList.add('highlight');
    }
    
    if (tags.broadcaster) {
        messageDiv.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(0, 0, 0, 0.8))';
        messageDiv.style.borderLeft = '4px solid #FFD700';
    }
    
    if (tags.mod) {
        messageDiv.style.background = 'linear-gradient(135deg, rgba(0, 255, 0, 0.1), rgba(0, 0, 0, 0.8))';
        messageDiv.style.borderLeft = '4px solid #00FF00';
    }
}

function smoothScrollToBottom(container) {
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    
    if (maxScroll > 0) {
        container.scrollTo({
            top: maxScroll,
            behavior: 'smooth'
        });
    }
}

function getCurrentTime() {
    return new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getRandomColor() {
    const colors = [
        '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24',
        '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe',
        '#fd79a8', '#e17055', '#00b894', '#0984e3'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Eventos de conexión
client.on('connected', () => {
    console.log('✅ Conectado correctamente');
    
    const welcomeDiv = document.createElement('div');
    welcomeDiv.style.textAlign = 'center';
    welcomeDiv.style.color = '#9146ff';
    welcomeDiv.style.padding = '20px';
    welcomeDiv.style.fontWeight = 'bold';
    welcomeDiv.innerHTML = '🎮 Chat conectado - Todos los emotes activos';
    document.getElementById('chat-container').appendChild(welcomeDiv);
});

client.on('disconnected', (reason) => {
    console.log('❌ Desconectado:', reason);
});

// Agregar estilos para emotes
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.8); }
    }
    
    .emote-img {
        height: 24px;
        vertical-align: middle;
        margin: 0 2px;
        display: inline-block;
        image-rendering: pixelated;
    }
`;
document.head.appendChild(style);