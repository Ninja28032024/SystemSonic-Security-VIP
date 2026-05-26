// src/lib/so-membro-state/so-membro-state.js

const fs   = require('fs');
const path = require('path');

const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'so-membro');
const STATE_FILE   = path.join(DATABASE_DIR, 'state.json');

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

let stateCache = {};

function safeReadJSON(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw || !raw.trim()) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        console.error('[SO-MEMBRO] Erro ao ler state:', e.message);
        return fallback;
    }
}

function safeWriteJSON(filePath, data) {
    try {
        if (!fs.existsSync(DATABASE_DIR)) fs.mkdirSync(DATABASE_DIR, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[SO-MEMBRO] Erro ao salvar state:', e.message);
        return false;
    }
}

function carregarState() {
    stateCache = safeReadJSON(STATE_FILE, {});
}

function salvarState() {
    safeWriteJSON(STATE_FILE, stateCache);
}

carregarState();

/**
 * Verifica se o modo so-membro está ativo em um grupo.
 * @param {string} groupId
 * @returns {boolean}
 */
function isSoMembroAtivo(groupId) {
    return !!(stateCache[groupId] && stateCache[groupId].ativo);
}

/**
 * Ativa o modo so-membro em um grupo.
 * @param {string} groupId
 */
function ativarSoMembro(groupId) {
    stateCache[groupId] = {
        ativo: true,
        dataAtivacao: Date.now()
    };
    salvarState();
}

/**
 * Desativa o modo so-membro em um grupo.
 * @param {string} groupId
 */
function desativarSoMembro(groupId) {
    delete stateCache[groupId];
    salvarState();
}

module.exports = {
    isSoMembroAtivo,
    ativarSoMembro,
    desativarSoMembro
};
