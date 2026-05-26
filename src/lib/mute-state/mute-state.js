const fs = require('fs');
const path = require('path');

const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'mute');
const PREFERENCES_FILE = path.join(DATABASE_DIR, 'preferences.json');
const SETUP_FILE = path.join(DATABASE_DIR, 'setup-state.json');
const MUTED_FILE = path.join(DATABASE_DIR, 'muted-members.json');

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

let preferencesCache = {};
let setupCache = {};
let mutedCache = {};

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
        console.error(`[MUTE] Erro ao ler ${path.basename(filePath)}:`, error.message);
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
        console.error(`[MUTE] Erro ao salvar ${path.basename(filePath)}:`, error.message);
        return false;
    }
}

function loadAll() {
    preferencesCache = safeReadJSON(PREFERENCES_FILE, {});
    setupCache = safeReadJSON(SETUP_FILE, {});
    mutedCache = safeReadJSON(MUTED_FILE, {});
}

function savePreferences() {
    return safeWriteJSON(PREFERENCES_FILE, preferencesCache);
}

function saveSetup() {
    return safeWriteJSON(SETUP_FILE, setupCache);
}

function saveMuted() {
    return safeWriteJSON(MUTED_FILE, mutedCache);
}

function obterPreferenciaGrupo(groupId) {
    return preferencesCache[groupId] || null;
}

function salvarPreferenciaGrupo(groupId, accessMode, configuredBy = null) {
    preferencesCache[groupId] = {
        groupId,
        accessMode,
        configuredBy,
        updatedAt: Date.now()
    };

    savePreferences();
    return preferencesCache[groupId];
}

function definirEtapaMute(groupId, sender, step, data = {}, timeoutMs = null) {
    setupCache[groupId] = {
        groupId,
        sender,
        step,
        data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: timeoutMs ? Date.now() + timeoutMs : null
    };

    saveSetup();
    return setupCache[groupId];
}

function obterEtapaMute(groupId) {
    const setup = setupCache[groupId] || null;

    if (!setup) {
        return null;
    }

    if (setup.expiresAt && Date.now() > setup.expiresAt) {
        delete setupCache[groupId];
        saveSetup();
        return null;
    }

    return setup;
}

function atualizarEtapaMute(groupId, partialData = {}) {
    const atual = obterEtapaMute(groupId);
    if (!atual) {
        return null;
    }

    setupCache[groupId] = {
        ...atual,
        data: {
            ...(atual.data || {}),
            ...partialData
        },
        updatedAt: Date.now()
    };

    saveSetup();
    return setupCache[groupId];
}

function limparEtapaMute(groupId) {
    const existia = !!setupCache[groupId];
    delete setupCache[groupId];
    if (existia) {
        saveSetup();
    }
    return existia;
}

function obterMutadosExpirados(groupId = null) {
    const agora = Date.now();
    const expirados = [];
    const grupos = groupId ? [groupId] : Object.keys(mutedCache);

    for (const gid of grupos) {
        const grupo = mutedCache[gid];
        if (!grupo || typeof grupo !== 'object') {
            continue;
        }

        for (const userId of Object.keys(grupo)) {
            const registro = grupo[userId];
            if (!registro || !registro.endsAt || registro.endsAt <= agora) {
                expirados.push({
                    groupId: gid,
                    targetJid: userId,
                    ...(registro || {})
                });
            }
        }
    }

    return expirados;
}

function processarMutadosExpirados(groupId = null) {
    const expirados = obterMutadosExpirados(groupId);
    let alterou = false;

    for (const registro of expirados) {
        const gid = registro.groupId;
        const userId = registro.targetJid;

        if (mutedCache[gid] && mutedCache[gid][userId]) {
            delete mutedCache[gid][userId];
            alterou = true;
        }

        if (mutedCache[gid] && Object.keys(mutedCache[gid]).length === 0) {
            delete mutedCache[gid];
            alterou = true;
        }
    }

    if (alterou) {
        saveMuted();
    }

    return expirados;
}

function limparMutadosExpirados(groupId = null) {
    const expirados = processarMutadosExpirados(groupId);
    return expirados.length > 0;
}

function adicionarMute(groupId, targetJid, durationMs, mutedBy = null) {
    limparMutadosExpirados(groupId);

    if (!mutedCache[groupId]) {
        mutedCache[groupId] = {};
    }

    const agora = Date.now();
    mutedCache[groupId][targetJid] = {
        groupId,
        targetJid,
        mutedBy,
        startedAt: agora,
        endsAt: agora + durationMs,
        durationMs,
        updatedAt: agora
    };

    saveMuted();
    return mutedCache[groupId][targetJid];
}

function obterMutadosAtivos(groupId) {
    const agora = Date.now();
    const grupo = mutedCache[groupId] || {};

    return Object.values(grupo).filter((registro) => {
        return registro && registro.endsAt && registro.endsAt > agora;
    });
}

function obterQuantidadeMutadosAtivos(groupId) {
    return obterMutadosAtivos(groupId).length;
}

function obterRegistroMute(groupId, targetJid) {
    const ativos = obterMutadosAtivos(groupId);
    return ativos.find((item) => item.targetJid === targetJid) || null;
}

function removerMute(groupId, targetJid) {
    if (!mutedCache[groupId] || !mutedCache[groupId][targetJid]) {
        return false;
    }

    delete mutedCache[groupId][targetJid];
    if (Object.keys(mutedCache[groupId]).length === 0) {
        delete mutedCache[groupId];
    }

    saveMuted();
    return true;
}

function desmutarTodos(groupId) {
    const total = obterQuantidadeMutadosAtivos(groupId);
    if (mutedCache[groupId]) {
        delete mutedCache[groupId];
        saveMuted();
    }
    return total;
}

function parseTempoMuteCustomizado(texto) {
    if (!texto || typeof texto !== 'string') {
        return null;
    }

    const normalizado = texto.toLowerCase().trim();
    const match = normalizado.match(/^(\d{1,4})\s*(segundo|segundos|minuto|minutos|hora|horas|dia|dias)$/i);

    if (!match) {
        return null;
    }

    const quantidade = parseInt(match[1], 10);
    const unidade = match[2].toLowerCase();

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
        return null;
    }

    if (unidade === 'segundo' || unidade === 'segundos') {
        return quantidade * 1000;
    }

    if (unidade === 'minuto' || unidade === 'minutos') {
        return quantidade * 60 * 1000;
    }

    if (unidade === 'hora' || unidade === 'horas') {
        return quantidade * 60 * 60 * 1000;
    }

    if (unidade === 'dia' || unidade === 'dias') {
        return quantidade * 24 * 60 * 60 * 1000;
    }

    return null;
}

loadAll();

module.exports = {
    DATABASE_DIR,
    PREFERENCES_FILE,
    SETUP_FILE,
    MUTED_FILE,
    obterPreferenciaGrupo,
    salvarPreferenciaGrupo,
    definirEtapaMute,
    obterEtapaMute,
    atualizarEtapaMute,
    limparEtapaMute,
    obterMutadosExpirados,
    processarMutadosExpirados,
    limparMutadosExpirados,
    adicionarMute,
    obterMutadosAtivos,
    obterQuantidadeMutadosAtivos,
    obterRegistroMute,
    removerMute,
    desmutarTodos,
    parseTempoMuteCustomizado
};
