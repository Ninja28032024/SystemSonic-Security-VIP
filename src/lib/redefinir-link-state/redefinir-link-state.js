// src/lib/redefinir-link-state/redefinir-link-state.js
// Gerenciador de estado para redefinição de link

const fs = require('fs');
const path = require('path');

const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'redefinir-link');
const PENDING_FILE = path.join(DATABASE_DIR, 'pending-reveals.json');

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

let pendingRevealsCache = {};

function safeReadJSON(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) {
            return fallback;
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw || !raw.trim()) {
            return fallback;
        }
        return JSON.parse(raw);
    } catch (error) {
        console.error(`[REDEFINIR-LINK] Erro ao ler ${path.basename(filePath)}:`, error.message);
        return fallback;
    }
}

function safeWriteJSON(filePath, data) {
    try {
        if (!fs.existsSync(DATABASE_DIR)) {
            fs.mkdirSync(DATABASE_DIR, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`[REDEFINIR-LINK] Erro ao salvar ${path.basename(filePath)}:`, error.message);
        return false;
    }
}

function loadAll() {
    pendingRevealsCache = safeReadJSON(PENDING_FILE, {});
}

function savePending() {
    return safeWriteJSON(PENDING_FILE, pendingRevealsCache);
}

function criarPendencia(groupId, sender, inviteCode) {
    pendingRevealsCache[groupId] = {
        groupId,
        sender,
        inviteCode,
        createdAt: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutos
    };
    savePending();
    return pendingRevealsCache[groupId];
}

function obterPendencia(groupId) {
    const pendencia = pendingRevealsCache[groupId] || null;
    
    if (!pendencia) {
        return null;
    }

    // Verificar se expirou
    if (pendencia.expiresAt && Date.now() > pendencia.expiresAt) {
        delete pendingRevealsCache[groupId];
        savePending();
        return null;
    }

    return pendencia;
}

function limparPendencia(groupId) {
    const existia = !!pendingRevealsCache[groupId];
    delete pendingRevealsCache[groupId];
    if (existia) {
        savePending();
    }
    return existia;
}

loadAll();

module.exports = {
    criarPendencia,
    obterPendencia,
    limparPendencia
};