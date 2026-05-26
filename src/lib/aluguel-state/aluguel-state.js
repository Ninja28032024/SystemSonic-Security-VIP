// src/lib/aluguel-state/aluguel-state.js
const path = require('path');
const fs = require('fs');

const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'aluguel');
const CONFIG_FILE = path.join(DATABASE_DIR, 'config.json');
const GRUPOS_FILE = path.join(DATABASE_DIR, 'grupos.json');
const SETUP_FILE = path.join(DATABASE_DIR, 'setup.json');

if (!fs.existsSync(DATABASE_DIR)) fs.mkdirSync(DATABASE_DIR, { recursive: true });

function lerArquivo(file) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        console.error('[ALUGUEL-STATE] Erro ao ler:', file, e.message);
    }
    return {};
}

function salvarArquivo(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('[ALUGUEL-STATE] Erro ao salvar:', file, e.message);
    }
}

// ── CONFIG GLOBAL (token, preço base, modo global) ──

function obterConfigGlobal() {
    return lerArquivo(CONFIG_FILE);
}

function salvarConfigGlobal(data) {
    const atual = lerArquivo(CONFIG_FILE);
    salvarArquivo(CONFIG_FILE, { ...atual, ...data });
}

function obterToken() {
    return obterConfigGlobal().token || null;
}

function salvarToken(token) {
    salvarConfigGlobal({ token });
}

function obterPreco30Dias() {
    return obterConfigGlobal().preco30dias || null;
}

function salvarPreco30Dias(valor) {
    salvarConfigGlobal({ preco30dias: valor });
}

function calcularPrecos() {
    const base = obterPreco30Dias();
    if (!base) return null;
    const periodos = [5, 10, 15, 20, 25, 30];
    const precos = {};
    for (const dias of periodos) {
        precos[dias] = parseFloat(((base / 30) * dias).toFixed(2));
    }
    return precos;
}

function formatarReais(valor) {
    return `R$${valor.toFixed(2).replace('.', ',')}`;
}

// ── MODO ALUGUEL POR GRUPO ──

function obterGrupos() {
    return lerArquivo(GRUPOS_FILE);
}

function obterStatusGrupo(groupId) {
    const grupos = obterGrupos();
    return grupos[groupId] || null;
}

function ativarModoAluguel(groupId) {
    const grupos = obterGrupos();
    if (!grupos[groupId]) grupos[groupId] = {};
    grupos[groupId].modoAluguel = true;
    grupos[groupId].atualizadoEm = new Date().toISOString();
    salvarArquivo(GRUPOS_FILE, grupos);
}

function desativarModoAluguel(groupId) {
    const grupos = obterGrupos();
    if (!grupos[groupId]) grupos[groupId] = {};
    grupos[groupId].modoAluguel = false;
    grupos[groupId].atualizadoEm = new Date().toISOString();
    salvarArquivo(GRUPOS_FILE, grupos);
}

function grupoEstaAtivo(groupId) {
    const grupos = obterGrupos();
    const g = grupos[groupId];
    if (!g || !g.modoAluguel) return false;
    if (!g.aluguelAtivo) return false;
    if (!g.expiracaoEm) return false;
    return Date.now() < g.expiracaoEm;
}

function grupoTemModoAluguel(groupId) {
    const grupos = obterGrupos();
    return !!(grupos[groupId] && grupos[groupId].modoAluguel);
}

function registrarAluguel(groupId, dias, valor) {
    const grupos = obterGrupos();
    if (!grupos[groupId]) grupos[groupId] = { modoAluguel: true };
    const agora = Date.now();
    const expiracao = agora + (dias * 24 * 60 * 60 * 1000);
    grupos[groupId].aluguelAtivo = true;
    grupos[groupId].diasContratados = dias;
    grupos[groupId].valorPago = valor;
    grupos[groupId].inicioEm = agora;
    grupos[groupId].expiracaoEm = expiracao;
    grupos[groupId].atualizadoEm = new Date().toISOString();
    salvarArquivo(GRUPOS_FILE, grupos);
    return grupos[groupId];
}

function obterInfoAluguel(groupId) {
    const grupos = obterGrupos();
    return grupos[groupId] || null;
}

// ── SETUP (etapas de configuração) ──

function obterSetup(groupId, userId) {
    const setups = lerArquivo(SETUP_FILE);
    const chave = `${groupId}_${userId}`;
    const s = setups[chave];
    if (s && s.expiresAt && Date.now() > s.expiresAt) {
        delete setups[chave];
        salvarArquivo(SETUP_FILE, setups);
        return null;
    }
    return s || null;
}

function definirSetup(groupId, userId, etapa, dados = {}) {
    const setups = lerArquivo(SETUP_FILE);
    const chave = `${groupId}_${userId}`;
    setups[chave] = {
        etapa,
        dados,
        expiresAt: Date.now() + (10 * 60 * 1000)
    };
    salvarArquivo(SETUP_FILE, setups);
}

function atualizarSetup(groupId, userId, etapa, dados = {}) {
    const setups = lerArquivo(SETUP_FILE);
    const chave = `${groupId}_${userId}`;
    if (!setups[chave]) return;
    setups[chave].etapa = etapa;
    setups[chave].dados = { ...setups[chave].dados, ...dados };
    salvarArquivo(SETUP_FILE, setups);
}

function limparSetup(groupId, userId) {
    const setups = lerArquivo(SETUP_FILE);
    const chave = `${groupId}_${userId}`;
    delete setups[chave];
    salvarArquivo(SETUP_FILE, setups);
}

// ── PAGAMENTOS PENDENTES ──

function registrarPagamentoPendente(paymentId, groupId, adminJid, dias, valor) {
    const config = lerArquivo(CONFIG_FILE);
    if (!config.pagamentosPendentes) config.pagamentosPendentes = {};
    config.pagamentosPendentes[paymentId] = {
        groupId,
        adminJid,
        dias,
        valor,
        criadoEm: Date.now()
    };
    salvarArquivo(CONFIG_FILE, config);
}

function obterPagamentoPendente(paymentId) {
    const config = lerArquivo(CONFIG_FILE);
    return config.pagamentosPendentes?.[paymentId] || null;
}

function removerPagamentoPendente(paymentId) {
    const config = lerArquivo(CONFIG_FILE);
    if (config.pagamentosPendentes?.[paymentId]) {
        delete config.pagamentosPendentes[paymentId];
        salvarArquivo(CONFIG_FILE, config);
    }
}

function formatarDataHora(timestamp) {
    const d = new Date(timestamp);
    const brasilia = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (-3 * 3600000));
    const dd = String(brasilia.getDate()).padStart(2, '0');
    const mm = String(brasilia.getMonth() + 1).padStart(2, '0');
    const yyyy = brasilia.getFullYear();
    const hh = String(brasilia.getHours()).padStart(2, '0');
    const min = String(brasilia.getMinutes()).padStart(2, '0');
    return { data: `${dd}/${mm}/${yyyy}`, hora: `${hh}:${min}` };
}

module.exports = {
    obterConfigGlobal,
    salvarConfigGlobal,
    obterToken,
    salvarToken,
    obterPreco30Dias,
    salvarPreco30Dias,
    calcularPrecos,
    formatarReais,
    ativarModoAluguel,
    desativarModoAluguel,
    grupoEstaAtivo,
    grupoTemModoAluguel,
    registrarAluguel,
    obterInfoAluguel,
    obterStatusGrupo,
    obterSetup,
    definirSetup,
    atualizarSetup,
    limparSetup,
    registrarPagamentoPendente,
    obterPagamentoPendente,
    removerPagamentoPendente,
    formatarDataHora
};
