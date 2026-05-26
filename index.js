if (process.platform === 'win32') {
    process.stdout.setEncoding('utf8');
    process.stderr.setEncoding('utf8');
    try { require('child_process').execSync('chcp 65001', { stdio: 'ignore' }); } catch (e) {}
}

const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason, Browsers, isJidBroadcast, isJidNewsletter, isJidStatusBroadcast } = require("@systemzero/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const NodeCache = require('node-cache');
const chalk = require('chalk');

const { AUTH_DIR, config, saveConfig, obterPrefixo, obterConfigCompleta } = require(path.join(__dirname, 'settings', 'config.js'));
const { showBanner } = require(path.join(__dirname, 'src', 'lib', 'bannerASCII.js'));
const { showConnectedMessage } = require(path.join(__dirname, 'src', 'lib', 'reconnectMessages.js'));
const { printLog } = require(path.join(__dirname, 'src', 'lib', 'logs', 'logs.js'));
const { isUserAdmin, isOwner } = require(path.join(__dirname, 'src', 'utils.js'));
const { handleCommand } = require(path.join(__dirname, 'src', 'commands', 'switch(command).js'));
const { carregarListeners, executarListeners } = require(path.join(__dirname, 'src', 'lib', 'listeners-manage', 'listeners-manage.js'));
const HotReload = require(path.join(__dirname, 'src', 'lib', 'hot-reload', 'hot-reload.js'));
const { iniciarMuteHooks } = require(path.join(__dirname, 'src', 'lib', 'mute-hooks', 'mute-hooks.js'));
const { aplicarMentionBridge } = require(path.join(__dirname, 'src', 'lib', 'mention-bridge', 'mention-bridge.js'));

const msgRetryCounterCache = new NodeCache();
const PREFIXOS_ALEATORIOS = ["$", "#", "-", "+", "/", ".", "!", ";", "*", "_", "&", "=", "%", "@", "?", "~", "^", ":", ",", "|"];
let numeroBotParaConectar = '';
let pairingCodeRequested = false;

function getMessageContent(message) {
    const type = Object.keys(message)[0];
    if (type === 'conversation') return message.conversation;
    if (type === 'extendedTextMessage') return message.extendedTextMessage.text;
    if (type === 'imageMessage') return message.imageMessage.caption;
    if (type === 'videoMessage') return message.videoMessage.caption;
    if (type === 'stickerMessage') return message.stickerMessage.stickerPackName || '';
    return '';
}

function getMessageType(message, text, prefix) {
    if (text && text.startsWith(prefix)) return 'Comando';
    const type = Object.keys(message)[0];
    switch (type) {
        case 'conversation':
        case 'extendedTextMessage': return 'Mensagem';
        case 'stickerMessage': return 'Figurinha';
        case 'imageMessage': return 'Imagem';
        case 'videoMessage': return 'Vídeo';
        default: return 'Outro';
    }
}

const activeListeners = new Map();
function registerListener(listenerId, callback, timeout = 300000) {
    activeListeners.set(listenerId, { callback, createdAt: Date.now() });
    setTimeout(() => removeListener(listenerId), timeout);
}
function removeListener(listenerId) { activeListeners.delete(listenerId); }

const commands = new Map();
function carregarComandos(dir = path.join(__dirname, 'src', 'commands')) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            carregarComandos(fullPath);
        } else if (file.endsWith('.js')) {
            try {
                delete require.cache[require.resolve(fullPath)];
                const commandModule = require(fullPath);
                if (commandModule.name && typeof commandModule.execute === 'function') {
                    commands.set(commandModule.name.toLowerCase(), commandModule);
                    if (Array.isArray(commandModule.aliases)) {
                        commandModule.aliases.forEach(alias => commands.set(alias.toLowerCase(), commandModule));
                    }
                }
            } catch (e) {}
        }
    }
}
carregarComandos();

let listeners = [];
const listenersDir = path.join(__dirname, 'src', 'listeners');
if (fs.existsSync(listenersDir)) { listeners = carregarListeners(listenersDir); }

const hotReload = new HotReload({ rootDir: __dirname, comandosMap: commands, listenersArray: listeners });
hotReload.iniciar();

function clearAndBanner() {
    process.stdout.write('\x1B[2J\x1B[0f');
    showBanner();
}

function limparSessao() {
    try {
        if (fs.existsSync(AUTH_DIR)) {
            const files = fs.readdirSync(AUTH_DIR);
            for (const file of files) {
                const fullPath = path.join(AUTH_DIR, file);
                if (fs.lstatSync(fullPath).isDirectory()) {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(fullPath);
                }
            }
        }
    } catch (e) {}
}

const question = (text) => {
    return new Promise((resolve) => {
        const prefix = '  ➤  ';
        const styled = chalk.hex('#4A90E2').bold(prefix) + chalk.white.bold(text);
        console.log(styled);
        // ➤ é caractere largo (2 colunas), prefix visível = 2 + 2 + 2 = 6 colunas
        const col = 6 + text.length + 1;
        process.stdout.write(`\x1B[1A\x1B[${col}G`);
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
        rl.once('line', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
};

async function realizarSetup(jaRegistrado) {
    if (!config.prefix || config.prefix.trim() === '') {
        config.prefix = PREFIXOS_ALEATORIOS[Math.floor(Math.random() * PREFIXOS_ALEATORIOS.length)];
        saveConfig();
    }
    clearAndBanner();
    const respPref = await question('Deseja alterar o prefixo? S/N: ');
    if (respPref.toLowerCase() === 's') {
        clearAndBanner();
        const novoPref = await question('Qual prefixo deseja que o Bot tenha? ');
        if (novoPref.trim() !== '') { config.prefix = novoPref.trim(); saveConfig(); }
    }
    if (!config.ownerNumber || config.ownerNumber.trim() === '') {
        clearAndBanner();
        const numDonoInput = await question('Qual número o dono deve gerenciar o Bot? (ex: 5511999...) ');
        const numDono = numDonoInput.replace(/[^0-9]/g, '');
        if (numDono !== '') { config.ownerNumber = numDono; saveConfig(); }
    }
    if (!jaRegistrado) {
        clearAndBanner();
        const numBotInput = await question('Em qual número deseja conectar o Bot? (ex: 5511999...) ');
        numeroBotParaConectar = numBotInput.replace(/[^0-9]/g, '');
    }
}

async function conectarBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        markOnlineOnConnect: true,
        msgRetryCounterCache,
        shouldIgnoreJid: (jid) => isJidBroadcast(jid) || isJidStatusBroadcast(jid) || isJidNewsletter(jid)
    });

    aplicarMentionBridge(sock);

    sock.ev.on("creds.update", saveCreds);

    if (!state.creds.registered && numeroBotParaConectar && !pairingCodeRequested) {
        pairingCodeRequested = true;

        sock.ev.on('connection.update', async function pairingHandler(u) {
            if (u.connection === 'connecting') {
                sock.ev.off('connection.update', pairingHandler);
                await new Promise(r => setTimeout(r, 600));
                try {
                    const code = await sock.requestPairingCode(numeroBotParaConectar);
                    const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log(chalk.hex('#4A90E2').bold('  ➤  ') + chalk.white.bold(`Código de conexão: ${formattedCode}`));
                } catch (err) {
                    console.error("Erro ao solicitar Pairing Code:", err.message);
                    pairingCodeRequested = false;
                }
            }
        });
    }

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            const botNumber = sock.user.id.split('@')[0].split(':')[0];
            if (botNumber !== config.botNumber) { config.botNumber = botNumber; saveConfig(); }
            showConnectedMessage(obterPrefixo());
            pairingCodeRequested = false;

        } else if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;

            if (statusCode === DisconnectReason.loggedOut) {
                console.log("Sessão encerrada pelo WhatsApp. Limpando dados...");
                limparSessao();
                process.exit(0);
            } else if (statusCode === 405) {
                pairingCodeRequested = false;
                limparSessao();
                setTimeout(() => conectarBot(), 3000);
            } else if (statusCode !== DisconnectReason.connectionClosed) {
                pairingCodeRequested = false;
                setTimeout(() => conectarBot(), 5000);
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.remoteJid === 'status@broadcast') return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const senderName = m.pushName || 'Usuário';
        const content = getMessageContent(m.message);
        const prefixo = obterPrefixo();
        const type = getMessageType(m.message, content, prefixo);
        
        try {
            const resListeners = await executarListeners(listeners, sock, m, from, sender, {
                args: [], prefixoAtual: prefixo, sender, from, senderName, isGroup: from.endsWith("@g.us"),
                config: obterConfigCompleta(), isUserAdmin, isOwner, registerListener, removeListener, comandosMap: commands
            });
            if (resListeners) return;
        } catch (e) { console.error('[LISTENERS ERROR]', e.message, e.stack); }
        
        const listenerId = `${from}_${sender}`;
        if (activeListeners.has(listenerId)) {
            activeListeners.get(listenerId).callback(m);
            return;
        }
        
        if (type !== 'Comando') return;
        const parts = content.slice(prefixo.length).trim().split(/\s+/);
        const cmdName = parts[0].toLowerCase();
        const args = parts.slice(1);
        printLog('⚡ COMANDO EXECUTADO', `Usuário: ${senderName}\nComando: ${cmdName}`);
        const cmd = commands.get(cmdName);
        const context = { args, prefixoAtual: prefixo, sender, from, senderName, isGroup: from.endsWith("@g.us"), config: obterConfigCompleta(), isUserAdmin, isOwner, registerListener, removeListener };
        if (cmd) { try { await cmd.execute(sock, m, context); } catch (e) {} }
        else { try { await handleCommand(cmdName, sock, m, context); } catch (e) {} }
    });

    iniciarMuteHooks(sock, obterConfigCompleta());
}

async function main() {
    const { state } = await useMultiFileAuthState(AUTH_DIR);
    await realizarSetup(state.creds.registered);
    await conectarBot();
}

main().catch(console.error);
