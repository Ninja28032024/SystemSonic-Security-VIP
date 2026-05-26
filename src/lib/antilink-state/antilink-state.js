const fs = require('fs');
const path = require('path');

const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'antilink');
const SETTINGS_FILE = path.join(DATABASE_DIR, 'settings.json');
const SETUP_FILE = path.join(DATABASE_DIR, 'setup-state.json');
const WARNINGS_FILE = path.join(DATABASE_DIR, 'warnings.json');

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

let settingsCache = {};
let setupCache = {};
let warningsCache = {};

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
        console.error(`[ANTILINK] Erro ao ler ${path.basename(filePath)}:`, error.message);
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
        console.error(`[ANTILINK] Erro ao salvar ${path.basename(filePath)}:`, error.message);
        return false;
    }
}

function loadAll() {
    settingsCache = safeReadJSON(SETTINGS_FILE, {});
    setupCache = safeReadJSON(SETUP_FILE, {});
    warningsCache = safeReadJSON(WARNINGS_FILE, {});
}

function saveSettings() {
    return safeWriteJSON(SETTINGS_FILE, settingsCache);
}

function saveSetupState() {
    return safeWriteJSON(SETUP_FILE, setupCache);
}

function saveWarnings() {
    return safeWriteJSON(WARNINGS_FILE, warningsCache);
}

function criarConfiguracaoPadrao(groupId, configuredBy = null) {
    return {
        groupId,
        ativo: false,
        deleteMessage: false,
        removeParticipant: false,
        removeImmediately: false,
        warningMode: false,
        warningLimit: 0,
        configuredBy,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

function obterConfiguracao(groupId) {
    if (!settingsCache[groupId]) {
        settingsCache[groupId] = criarConfiguracaoPadrao(groupId);
        saveSettings();
    }

    return settingsCache[groupId];
}

function salvarConfiguracao(groupId, partialData = {}) {
    const atual = obterConfiguracao(groupId);
    settingsCache[groupId] = {
        ...atual,
        ...partialData,
        groupId,
        updatedAt: Date.now()
    };

    saveSettings();
    return settingsCache[groupId];
}

function desativarAntilink(groupId, configuredBy = null) {
    const atual = obterConfiguracao(groupId);

    settingsCache[groupId] = {
        ...atual,
        ativo: false,
        configuredBy,
        updatedAt: Date.now()
    };

    saveSettings();
    return settingsCache[groupId];
}

function definirEtapaSetup(groupId, sender, step, partialData = {}) {
    setupCache[groupId] = {
        groupId,
        sender,
        step,
        data: {
            ...(setupCache[groupId]?.data || {}),
            ...partialData
        },
        updatedAt: Date.now()
    };

    saveSetupState();
    return setupCache[groupId];
}

function obterSetup(groupId) {
    return setupCache[groupId] || null;
}

function limparSetup(groupId) {
    const existia = !!setupCache[groupId];
    delete setupCache[groupId];
    if (existia) {
        saveSetupState();
    }
    return existia;
}

function atualizarDadosSetup(groupId, partialData = {}) {
    if (!setupCache[groupId]) {
        return null;
    }

    setupCache[groupId].data = {
        ...(setupCache[groupId].data || {}),
        ...partialData
    };
    setupCache[groupId].updatedAt = Date.now();
    saveSetupState();
    return setupCache[groupId];
}

function obterAdvertenciasGrupo(groupId) {
    if (!warningsCache[groupId]) {
        warningsCache[groupId] = {};
        saveWarnings();
    }

    return warningsCache[groupId];
}

function obterAdvertenciasUsuario(groupId, userId) {
    const grupo = obterAdvertenciasGrupo(groupId);
    return grupo[userId] || 0;
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
    if (existia) {
        saveWarnings();
    }
    return existia;
}

function formatarResumoAntilink(config) {
    const deletar = config.deleteMessage ? 'Deletar' : 'Não deletar';
    const remover = config.removeParticipant ? 'Remover' : 'Não remover';
    const imediato = config.removeImmediately ? 'Sim' : 'Não';
    const porAdvertencia = config.warningMode
        ? `Sim, ${config.warningLimit} advertências`
        : 'Não';

    return `*Dados do antilink:*

*Deletar mensagem do link:* ${deletar}
*Remover participante:* ${remover}
*Remover imediatamente:* ${imediato}
*Remover por advertência:* ${porAdvertencia}`;
}

loadAll();

module.exports = {
    DATABASE_DIR,
    SETTINGS_FILE,
    SETUP_FILE,
    WARNINGS_FILE,
    obterConfiguracao,
    salvarConfiguracao,
    desativarAntilink,
    definirEtapaSetup,
    obterSetup,
    limparSetup,
    atualizarDadosSetup,
    obterAdvertenciasGrupo,
    obterAdvertenciasUsuario,
    adicionarAdvertencia,
    zerarAdvertenciasUsuario,
    limparAdvertenciasGrupo,
    formatarResumoAntilink
};
