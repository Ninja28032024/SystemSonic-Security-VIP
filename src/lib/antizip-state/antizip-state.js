// src/lib/antizip-state/antizip-state.js
const path = require("path");
const fs = require("fs");

const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'antizip');
const CONFIG_FILE = path.join(DATABASE_DIR, 'configs.json');
const ETAPAS_FILE = path.join(DATABASE_DIR, 'etapas.json');

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

function carregarConfigs() {
    try {
        if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) { console.error('[ANTIZIP-STATE] Erro ao carregar configs:', e.message); }
    return {};
}

function salvarConfigs(data) {
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch (e) { console.error('[ANTIZIP-STATE] Erro ao salvar configs:', e.message); }
}

function carregarEtapas() {
    try {
        if (fs.existsSync(ETAPAS_FILE)) return JSON.parse(fs.readFileSync(ETAPAS_FILE, 'utf8'));
    } catch (e) { console.error('[ANTIZIP-STATE] Erro ao carregar etapas:', e.message); }
    return {};
}

function salvarEtapas(data) {
    try { fs.writeFileSync(ETAPAS_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch (e) { console.error('[ANTIZIP-STATE] Erro ao salvar etapas:', e.message); }
}

function obterConfigAntizip(groupId) {
    const configs = carregarConfigs();
    return configs[groupId] || null;
}

function salvarConfigAntizip(groupId, config) {
    const configs = carregarConfigs();
    configs[groupId] = { ...config, ativo: true, atualizadoEm: new Date().toISOString() };
    salvarConfigs(configs);
}

function desativarAntizip(groupId) {
    const configs = carregarConfigs();
    if (configs[groupId]) {
        delete configs[groupId];
        salvarConfigs(configs);
        return true;
    }
    return false;
}

function definirEtapaAntizip(groupId, userId, etapa, dados = {}) {
    const etapas = carregarEtapas();
    const chave = `${groupId}_${userId}`;
    etapas[chave] = { etapa, dados, iniciadoEm: Date.now(), expiresAt: Date.now() + (5 * 60 * 1000) };
    salvarEtapas(etapas);
}

function obterEtapaAntizip(groupId, userId) {
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

function atualizarEtapaAntizip(groupId, userId, etapa, dados) {
    const etapas = carregarEtapas();
    const chave = `${groupId}_${userId}`;
    if (etapas[chave]) {
        etapas[chave] = { ...etapas[chave], etapa, dados: { ...etapas[chave].dados, ...dados } };
        salvarEtapas(etapas);
        return true;
    }
    return false;
}

function limparEtapaAntizip(groupId, userId) {
    const etapas = carregarEtapas();
    const chave = `${groupId}_${userId}`;
    if (etapas[chave]) {
        delete etapas[chave];
        salvarEtapas(etapas);
        return true;
    }
    return false;
}

function incrementarAdvertenciaAntizip(groupId, userId) {
    const configs = carregarConfigs();
    if (!configs[groupId]) return null;
    if (!configs[groupId].advertencias) configs[groupId].advertencias = {};
    if (!configs[groupId].advertencias[userId]) configs[groupId].advertencias[userId] = 0;
    configs[groupId].advertencias[userId]++;
    salvarConfigs(configs);
    return configs[groupId].advertencias[userId];
}

function resetarAdvertenciasAntizip(groupId, userId) {
    const configs = carregarConfigs();
    if (configs[groupId] && configs[groupId].advertencias) {
        delete configs[groupId].advertencias[userId];
        salvarConfigs(configs);
    }
}

module.exports = {
    obterConfigAntizip,
    salvarConfigAntizip,
    desativarAntizip,
    definirEtapaAntizip,
    obterEtapaAntizip,
    atualizarEtapaAntizip,
    limparEtapaAntizip,
    incrementarAdvertenciaAntizip,
    resetarAdvertenciasAntizip
};
