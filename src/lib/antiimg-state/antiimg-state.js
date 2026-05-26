// src/lib/antiimg-state/antiimg-state.js
// Gerenciador de estado e persistência do sistema anti-imagens

const fs = require('fs');
const path = require('path');

const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'antiimg');
const SETTINGS_FILE = path.join(DATABASE_DIR, 'settings.json');
const SETUP_FILE = path.join(DATABASE_DIR, 'setup-state.json');
const WARNINGS_FILE = path.join(DATABASE_DIR, 'warnings.json');

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

// Usa global para sobreviver ao hot-reload sem perder o estado em andamento
if (!global.__antiimgSettings) global.__antiimgSettings = {};
if (!global.__antiimgSetup)    global.__antiimgSetup    = {};
if (!global.__antiimgWarnings) global.__antiimgWarnings = {};

let settingsCache = global.__antiimgSettings;
let setupCache    = global.__antiimgSetup;
let warningsCache = global.__antiimgWarnings;

function safeReadJSON(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw || !raw.trim()) return fallback;
        return JSON.parse(raw);
    } catch (error) {
        console.error(`[ANTIIMG] Erro ao ler ${path.basename(filePath)}:`, error.message);
        return fallback;
    }
}

function safeWriteJSON(filePath, data) {
    try {
        if (!fs.existsSync(DATABASE_DIR)) fs.mkdirSync(DATABASE_DIR, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`[ANTIIMG] Erro ao salvar ${path.basename(filePath)}:`, error.message);
        return false;
    }
}

function loadAll() {
    const s = safeReadJSON(SETTINGS_FILE, {});
    const u = safeReadJSON(SETUP_FILE, {});
    const w = safeReadJSON(WARNINGS_FILE, {});
    // Mescla no global sem substituir entradas já existentes em memória
    Object.assign(global.__antiimgSettings, s);
    Object.assign(global.__antiimgSetup, u);
    Object.assign(global.__antiimgWarnings, w);
}

function saveSettings()   { return safeWriteJSON(SETTINGS_FILE, settingsCache); }
function saveSetupState() { return safeWriteJSON(SETUP_FILE, setupCache); }
function saveWarnings()   { return safeWriteJSON(WARNINGS_FILE, warningsCache); }

function obterConfiguracao(groupId) { return settingsCache[groupId] || null; }

function salvarConfiguracao(groupId, config) {
    settingsCache[groupId] = { groupId, ...config, updatedAt: Date.now() };
    saveSettings();
    return settingsCache[groupId];
}

function desativarAntiimg(groupId) {
    const existia = !!settingsCache[groupId];
    delete settingsCache[groupId];
    if (existia) saveSettings();
    return existia;
}

function definirEtapaSetup(groupId, sender, step, data = {}) {
    setupCache[groupId] = { groupId, sender, step, data, updatedAt: Date.now() };
    saveSetupState();
    return setupCache[groupId];
}

function obterSetup(groupId)  { return setupCache[groupId] || null; }

function limparSetup(groupId) {
    const existia = !!setupCache[groupId];
    delete setupCache[groupId];
    if (existia) saveSetupState();
    return existia;
}

function atualizarDadosSetup(groupId, partialData = {}) {
    if (!setupCache[groupId]) return null;
    setupCache[groupId].data = { ...(setupCache[groupId].data || {}), ...partialData };
    setupCache[groupId].updatedAt = Date.now();
    saveSetupState();
    return setupCache[groupId];
}

function obterAdvertenciasGrupo(groupId) {
    if (!warningsCache[groupId]) { warningsCache[groupId] = {}; saveWarnings(); }
    return warningsCache[groupId];
}

function obterAdvertenciasUsuario(groupId, userId) {
    return obterAdvertenciasGrupo(groupId)[userId] || 0;
}

function adicionarAdvertencia(groupId, userId) {
    const grupo = obterAdvertenciasGrupo(groupId);
    grupo[userId] = (grupo[userId] || 0) + 1;
    warningsCache[groupId] = grupo;
    saveWarnings();
    return grupo[userId];
}

function zerarAdvertenciasUsuario(groupId, userId) {
    const grupo = obterAdvertenciasGrupo(groupId);
    if (grupo[userId]) {
        delete grupo[userId];
        warningsCache[groupId] = grupo;
        saveWarnings();
    }
}

function limparAdvertenciasGrupo(groupId) {
    const existia = !!warningsCache[groupId];
    delete warningsCache[groupId];
    if (existia) saveWarnings();
    return existia;
}

loadAll();

module.exports = {
    obterConfiguracao,
    salvarConfiguracao,
    desativarAntiimg,
    definirEtapaSetup,
    obterSetup,
    limparSetup,
    atualizarDadosSetup,
    obterAdvertenciasGrupo,
    obterAdvertenciasUsuario,
    adicionarAdvertencia,
    zerarAdvertenciasUsuario,
    limparAdvertenciasGrupo
};
