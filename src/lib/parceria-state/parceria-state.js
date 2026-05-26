// src/lib/parceria-state/parceria-state.js
// Gerenciada estado e persistência do sistema de parcerias

const fs = require('fs');
const path = require('path');

const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'parcerias');
const PARCERIAS_FILE = path.join(DATABASE_DIR, 'parcerias.json');
const SETUP_FILE = path.join(DATABASE_DIR, 'setup-state.json');
const SYSTEM_FILE = path.join(DATABASE_DIR, 'system-status.json');

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

// Usa global para sobreviver ao hot-reload sem perder estado em andamento
if (!global.__parceriasCache)      global.__parceriasCache      = {};
if (!global.__parceriasSetup)      global.__parceriasSetup      = {};
if (!global.__parceriasSystem)     global.__parceriasSystem     = {};

let parceriasCache    = global.__parceriasCache;
let setupCache        = global.__parceriasSetup;
let systemStatusCache = global.__parceriasSystem;

// ============ FUNÇÕES DE LEITURA/ESCRITA SEGURA ============

function safeReadJSON(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw || !raw.trim()) return fallback;
        return JSON.parse(raw);
    } catch (error) {
        console.error(`[PARCERIA] Erro ao ler ${path.basename(filePath)}:`, error.message);
        return fallback;
    }
}

function safeWriteJSON(filePath, data) {
    try {
        if (!fs.existsSync(DATABASE_DIR)) fs.mkdirSync(DATABASE_DIR, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`[PARCERIA] Erro ao salvar ${path.basename(filePath)}:`, error.message);
        return false;
    }
}

function loadAll() {
    // Mescla disco → global sem sobrescrever entradas já existentes em memória
    Object.assign(global.__parceriasCache,  safeReadJSON(PARCERIAS_FILE, {}));
    Object.assign(global.__parceriasSetup,  safeReadJSON(SETUP_FILE, {}));
    Object.assign(global.__parceriasSystem, safeReadJSON(SYSTEM_FILE, {}));
}

function saveParcerias()    { return safeWriteJSON(PARCERIAS_FILE, parceriasCache); }
function saveSetup()        { return safeWriteJSON(SETUP_FILE, setupCache); }
function saveSystemStatus() { return safeWriteJSON(SYSTEM_FILE, systemStatusCache); }

// ============ FUNÇÕES DE GERENCIAMENTO DO SISTEMA ============

function obterStatusSistema(groupId) {
    return systemStatusCache[groupId]?.ativo || false;
}

function ativarSistema(groupId, activatedBy = null) {
    systemStatusCache[groupId] = { ativo: true, activatedBy, activatedAt: Date.now() };
    saveSystemStatus();
    return systemStatusCache[groupId];
}

function desativarSistema(groupId, deactivatedBy = null) {
    systemStatusCache[groupId] = { ativo: false, deactivatedBy, deactivatedAt: Date.now() };
    saveSystemStatus();
    return systemStatusCache[groupId];
}

// ============ FUNÇÕES DE GERENCIAMENTO DE PARCERIAS ============

function obterParceriasGrupo(groupId) {
    if (!parceriasCache[groupId]) parceriasCache[groupId] = [];
    return parceriasCache[groupId];
}

function adicionarParceria(groupId, partnerJid, maxLinks, horasIntervalo) {
    if (!parceriasCache[groupId]) parceriasCache[groupId] = [];

    const parceria = {
        partnerJid,
        maxLinks: parseInt(maxLinks),
        horasIntervalo: parseInt(horasIntervalo),
        linksPostados: 0,
        adicionadoEm: Date.now(),
        ultimoLinkEm: null
    };

    parceriasCache[groupId].push(parceria);
    saveParcerias();
    return parceria;
}

function removerParceria(groupId, index) {
    if (!parceriasCache[groupId] || index < 0 || index >= parceriasCache[groupId].length) return null;
    const removido = parceriasCache[groupId].splice(index, 1)[0];
    saveParcerias();
    return removido;
}

function obterParceriaPorJid(groupId, partnerJid) {
    return obterParceriasGrupo(groupId).find(p => p.partnerJid === partnerJid) || null;
}

function atualizarLinkPostado(groupId, partnerJid) {
    const parceria = obterParceriasGrupo(groupId).find(p => p.partnerJid === partnerJid);
    if (!parceria) return null;
    parceria.linksPostados += 1;
    parceria.ultimoLinkEm = Date.now();
    saveParcerias();
    return parceria;
}

function resetarLinksPostados(groupId, partnerJid) {
    const parceria = obterParceriasGrupo(groupId).find(p => p.partnerJid === partnerJid);
    if (!parceria) return null;
    parceria.linksPostados = 0;
    saveParcerias();
    return parceria;
}

function verificarLimiteExcedido(groupId, partnerJid) {
    const parceria = obterParceriaPorJid(groupId, partnerJid);
    if (!parceria) return { excedido: false, motivo: 'nao_e_parceiro' };

    if (parceria.linksPostados >= parceria.maxLinks) {
        const horasEmMs = parceria.horasIntervalo * 60 * 60 * 1000;
        const tempoDecorrido = Date.now() - (parceria.ultimoLinkEm || parceria.adicionadoEm);
        if (tempoDecorrido >= horasEmMs) {
            resetarLinksPostados(groupId, partnerJid);
            return { excedido: false, resetado: true };
        }
        return { excedido: true, atual: parceria.linksPostados, limite: parceria.maxLinks };
    }

    return { excedido: false };
}

// ============ FUNÇÕES DE SETUP ============

function definirEtapaParceria(groupId, sender, step, data = {}, timeoutMs = 5 * 60 * 1000) {
    setupCache[groupId] = {
        groupId, sender, step, data,
        createdAt: Date.now(),
        expiresAt: Date.now() + timeoutMs
    };
    saveSetup();
    return setupCache[groupId];
}

function obterEtapaParceria(groupId) {
    const setup = setupCache[groupId] || null;
    if (!setup) return null;
    if (setup.expiresAt && Date.now() > setup.expiresAt) {
        delete setupCache[groupId];
        saveSetup();
        return null;
    }
    return setup;
}

function atualizarEtapaParceria(groupId, partialData = {}) {
    const atual = obterEtapaParceria(groupId);
    if (!atual) return null;
    setupCache[groupId] = {
        ...atual,
        data: { ...(atual.data || {}), ...partialData },
        updatedAt: Date.now()
    };
    saveSetup();
    return setupCache[groupId];
}

function limparEtapaParceria(groupId) {
    const existia = !!setupCache[groupId];
    delete setupCache[groupId];
    if (existia) saveSetup();
    return existia;
}

// ============ FUNÇÕES UTILITÁRIAS ============

function formatarData(timestamp) {
    const data = new Date(timestamp);
    const dia  = String(data.getDate()).padStart(2, '0');
    const mes  = String(data.getMonth() + 1).padStart(2, '0');
    const ano  = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

loadAll();

module.exports = {
    obterParceriasGrupo,
    adicionarParceria,
    removerParceria,
    obterParceriaPorJid,
    atualizarLinkPostado,
    resetarLinksPostados,
    verificarLimiteExcedido,
    definirEtapaParceria,
    obterEtapaParceria,
    atualizarEtapaParceria,
    limparEtapaParceria,
    formatarData,
    obterStatusSistema,
    ativarSistema,
    desativarSistema
};
