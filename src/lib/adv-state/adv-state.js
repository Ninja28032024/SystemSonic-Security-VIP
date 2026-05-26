// src/lib/adv-state/adv-state.js
const path = require("path");
const fs = require("fs");

const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'adv');
const CONFIG_FILE = path.join(DATABASE_DIR, 'configs.json');
const MEMBROS_FILE = path.join(DATABASE_DIR, 'membros.json');
const ETAPAS_FILE = path.join(DATABASE_DIR, 'etapas.json');

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

// ========== CONFIGS ==========

function carregarConfigs() {
    try {
        if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) { console.error('[ADV-STATE] Erro ao carregar configs:', e.message); }
    return {};
}

function salvarConfigs(data) {
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch (e) { console.error('[ADV-STATE] Erro ao salvar configs:', e.message); }
}

function obterConfigAdv(groupId) {
    const configs = carregarConfigs();
    return configs[groupId] || null;
}

function salvarConfigAdv(groupId, config) {
    const configs = carregarConfigs();
    configs[groupId] = { ...config, atualizadoEm: new Date().toISOString() };
    salvarConfigs(configs);
}

// ========== MEMBROS ADVERTIDOS ==========

function carregarMembros() {
    try {
        if (fs.existsSync(MEMBROS_FILE)) return JSON.parse(fs.readFileSync(MEMBROS_FILE, 'utf8'));
    } catch (e) { console.error('[ADV-STATE] Erro ao carregar membros:', e.message); }
    return {};
}

function salvarMembros(data) {
    try { fs.writeFileSync(MEMBROS_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch (e) { console.error('[ADV-STATE] Erro ao salvar membros:', e.message); }
}

function obterMembrosGrupo(groupId) {
    const membros = carregarMembros();
    return membros[groupId] || {};
}

function obterMembroAdv(groupId, userId) {
    const membros = obterMembrosGrupo(groupId);
    return membros[userId] || null;
}

function advertirMembro(groupId, userId) {
    const membros = carregarMembros();
    if (!membros[groupId]) membros[groupId] = {};
    if (!membros[groupId][userId]) {
        membros[groupId][userId] = { quantidade: 0, ultimaAdv: null };
    }
    membros[groupId][userId].quantidade++;
    membros[groupId][userId].ultimaAdv = new Date().toISOString();
    salvarMembros(membros);
    return membros[groupId][userId].quantidade;
}

function removerAdvertencias(groupId, userId, quantidade) {
    const membros = carregarMembros();
    if (!membros[groupId] || !membros[groupId][userId]) return false;
    membros[groupId][userId].quantidade -= quantidade;
    if (membros[groupId][userId].quantidade <= 0) {
        delete membros[groupId][userId];
    }
    salvarMembros(membros);
    return true;
}

// ========== ETAPAS ==========

function carregarEtapas() {
    try {
        if (fs.existsSync(ETAPAS_FILE)) return JSON.parse(fs.readFileSync(ETAPAS_FILE, 'utf8'));
    } catch (e) { console.error('[ADV-STATE] Erro ao carregar etapas:', e.message); }
    return {};
}

function salvarEtapas(data) {
    try { fs.writeFileSync(ETAPAS_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch (e) { console.error('[ADV-STATE] Erro ao salvar etapas:', e.message); }
}

function definirEtapa(groupId, userId, etapa, dados = {}) {
    const etapas = carregarEtapas();
    const chave = `${groupId}_${userId}`;
    etapas[chave] = { etapa, dados, expiresAt: Date.now() + (5 * 60 * 1000) };
    salvarEtapas(etapas);
}

function obterEtapa(groupId, userId) {
    const etapas = carregarEtapas();
    const chave = `${groupId}_${userId}`;
    const etapa = etapas[chave];
    if (etapa && Date.now() > etapa.expiresAt) {
        delete etapas[chave];
        salvarEtapas(etapas);
        return null;
    }
    return etapa || null;
}

function atualizarEtapa(groupId, userId, etapa, dados) {
    const etapas = carregarEtapas();
    const chave = `${groupId}_${userId}`;
    if (etapas[chave]) {
        etapas[chave] = {
            ...etapas[chave],
            etapa,
            dados: { ...etapas[chave].dados, ...dados }
        };
        salvarEtapas(etapas);
        return true;
    }
    return false;
}

function limparEtapa(groupId, userId) {
    const etapas = carregarEtapas();
    const chave = `${groupId}_${userId}`;
    if (etapas[chave]) {
        delete etapas[chave];
        salvarEtapas(etapas);
        return true;
    }
    return false;
}

function formatarData(isoString) {
    const d = new Date(isoString);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

module.exports = {
    obterConfigAdv,
    salvarConfigAdv,
    obterMembrosGrupo,
    obterMembroAdv,
    advertirMembro,
    removerAdvertencias,
    definirEtapa,
    obterEtapa,
    atualizarEtapa,
    limparEtapa,
    formatarData
};
