// CAMINHO: src/lib/autosair-state/autosair-state.js
// Gerenciador de estado e persistência do comando autosair

const fs = require('fs');
const path = require('path');

// ============ CONFIGURAÇÃO DE DIRETÓRIO ============
const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'autosair');

// Criar diretório se não existir
if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

const SCHEDULES_FILE = path.join(DATABASE_DIR, 'schedules.json');

// ============ ESTADO GLOBAL EM MEMÓRIA ============
let autosairSchedules = new Map();
const autosairCustomSessions = new Map();

// ============ FUNÇÕES DE PERSISTÊNCIA ============

/**
 * Carrega os agendamentos do arquivo JSON
 */
function loadSchedules() {
    try {
        if (fs.existsSync(SCHEDULES_FILE)) {
            const data = fs.readFileSync(SCHEDULES_FILE, 'utf8');
            const schedules = JSON.parse(data);
            
            // Converter array para Map
            autosairSchedules.clear();
            for (const schedule of schedules) {
                autosairSchedules.set(schedule.groupId, schedule);
            }
            
            return schedules.length;
        }
    } catch (e) {
        console.error('Erro ao carregar agendamentos do autosair:', e.message);
    }
    return 0;
}

/**
 * Salva os agendamentos no arquivo JSON
 */
function saveSchedules() {
    try {
        if (!fs.existsSync(DATABASE_DIR)) {
            fs.mkdirSync(DATABASE_DIR, { recursive: true });
        }
        
        // Converter Map para array
        const schedules = Array.from(autosairSchedules.values());
        fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), 'utf8');
    } catch (e) {
        console.error('Erro ao salvar agendamentos do autosair:', e.message);
    }
}

// ============ FUNÇÕES DE GERENCIAMENTO ============

/**
 * Cria um novo agendamento de saída
 * @param {string} groupId - ID do grupo
 * @param {number} milliseconds - Tempo em milissegundos até a saída
 * @param {string} tipo - Tipo de agendamento (preset ou custom)
 * @returns {object} - Objeto do agendamento criado
 */
function criarAgendamento(groupId, milliseconds, tipo = 'custom') {
    const agora = Date.now();
    const dataRetirada = new Date(agora + milliseconds);
    
    const schedule = {
        groupId,
        criadoEm: agora,
        saidaEm: agora + milliseconds,
        dataRetirada: dataRetirada.toISOString(),
        tipo,
        milliseconds,
        ativo: true
    };
    
    autosairSchedules.set(groupId, schedule);
    saveSchedules();
    
    return schedule;
}

/**
 * Obtém um agendamento existente
 * @param {string} groupId - ID do grupo
 * @returns {object|null} - Agendamento ou null
 */
function obterAgendamento(groupId) {
    return autosairSchedules.get(groupId) || null;
}

/**
 * Remove um agendamento
 * @param {string} groupId - ID do grupo
 * @returns {boolean} - true se removido, false se não existia
 */
function removerAgendamento(groupId) {
    const existia = autosairSchedules.has(groupId);
    autosairSchedules.delete(groupId);
    if (existia) {
        saveSchedules();
    }
    return existia;
}

/**
 * Obtém todos os agendamentos que devem ser executados agora
 * @returns {array} - Array de agendamentos vencidos
 */
function obterAgendamentosVencidos() {
    const agora = Date.now();
    const vencidos = [];
    
    for (const [groupId, schedule] of autosairSchedules.entries()) {
        if (schedule.ativo && schedule.saidaEm <= agora) {
            vencidos.push(schedule);
        }
    }
    
    return vencidos;
}

/**
 * Obtém todos os agendamentos em formato de objeto
 * @returns {object} - Objeto com todos os agendamentos
 */
function obterTodosAgendamentos() {
    const agendamentos = {};
    for (const [groupId, schedule] of autosairSchedules.entries()) {
        agendamentos[groupId] = schedule;
    }
    return agendamentos;
}

/**
 * Formata a data de retirada para exibição
 * @param {number} saidaEm - Timestamp da saída
 * @returns {object} - Objeto com dia e hora formatados
 */
function formatarDataRetirada(saidaEm) {
    const data = new Date(saidaEm);
    
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const horas = String(data.getHours()).padStart(2, '0');
    const minutos = String(data.getMinutes()).padStart(2, '0');
    
    return {
        data: `${dia}/${mes}/${ano}`,
        hora: `${horas}:${minutos}`,
        dataCompleta: `${dia}/${mes}/${ano} as ${horas}:${minutos}`
    };
}

/**
 * Calcula o tempo em milissegundos a partir de uma string como "30d", "2h", "1m" ou "30s"
 * @param {string} tempo - String no formato "XdYhZmWs" (ex: "30d", "2h", "1m", "30s", "5d2h30m")
 * @returns {number|null} - Milissegundos ou null se inválido
 */
function parseTempoCustomizado(tempo) {
    if (!tempo || typeof tempo !== 'string') return null;
    
    tempo = tempo.toLowerCase().trim();
    
    // Regex para capturar dias, horas, minutos e segundos
    const regexDias = /(\d+)\s*d/;
    const regexHoras = /(\d+)\s*h/;
    const regexMinutos = /(\d+)\s*m(?!s)/; // m não seguido de s
    const regexSegundos = /(\d+)\s*s/;
    
    let totalMs = 0;
    
    const matchDias = tempo.match(regexDias);
    if (matchDias) {
        const dias = parseInt(matchDias[1]);
        if (dias > 0 && dias <= 365) { // Máximo de 1 ano
            totalMs += dias * 24 * 60 * 60 * 1000;
        } else {
            return null;
        }
    }
    
    const matchHoras = tempo.match(regexHoras);
    if (matchHoras) {
        const horas = parseInt(matchHoras[1]);
        if (horas > 0 && horas <= 8760) { // Máximo de 1 ano em horas
            totalMs += horas * 60 * 60 * 1000;
        } else {
            return null;
        }
    }
    
    const matchMinutos = tempo.match(regexMinutos);
    if (matchMinutos) {
        const minutos = parseInt(matchMinutos[1]);
        if (minutos > 0 && minutos <= 525600) { // Máximo de 1 ano em minutos
            totalMs += minutos * 60 * 1000;
        } else {
            return null;
        }
    }
    
    const matchSegundos = tempo.match(regexSegundos);
    if (matchSegundos) {
        const segundos = parseInt(matchSegundos[1]);
        if (segundos > 0 && segundos <= 31536000) { // Máximo de 1 ano em segundos
            totalMs += segundos * 1000;
        } else {
            return null;
        }
    }
    
    // Se nenhum padrão foi encontrado ou nenhum tempo foi especificado
    if (totalMs === 0) {
        return null;
    }
    
    return totalMs;
}

function gerarChaveSessao(groupId, sender) {
    return `${groupId}::${sender}`;
}

function iniciarSessaoCustomizada(groupId, sender, ttlMs = 5 * 60 * 1000) {
    autosairCustomSessions.set(gerarChaveSessao(groupId, sender), {
        groupId,
        sender,
        expiresAt: Date.now() + ttlMs
    });
}

function obterSessaoCustomizada(groupId, sender) {
    const chave = gerarChaveSessao(groupId, sender);
    const sessao = autosairCustomSessions.get(chave);

    if (!sessao) {
        return null;
    }

    if (sessao.expiresAt <= Date.now()) {
        autosairCustomSessions.delete(chave);
        return null;
    }

    return sessao;
}

function encerrarSessaoCustomizada(groupId, sender) {
    return autosairCustomSessions.delete(gerarChaveSessao(groupId, sender));
}

function limparSessoesCustomizadasExpiradas() {
    const agora = Date.now();

    for (const [chave, sessao] of autosairCustomSessions.entries()) {
        if (!sessao || sessao.expiresAt <= agora) {
            autosairCustomSessions.delete(chave);
        }
    }
}

function limparSessoesCustomizadasDoGrupo(groupId) {
    for (const [chave, sessao] of autosairCustomSessions.entries()) {
        if (sessao?.groupId === groupId) {
            autosairCustomSessions.delete(chave);
        }
    }
}

// ============ CARREGAR AGENDAMENTOS NA INICIALIZAÇÃO ============
loadSchedules();

module.exports = {
    criarAgendamento,
    obterAgendamento,
    removerAgendamento,
    obterAgendamentosVencidos,
    obterTodosAgendamentos,
    formatarDataRetirada,
    parseTempoCustomizado,
    iniciarSessaoCustomizada,
    obterSessaoCustomizada,
    encerrarSessaoCustomizada,
    limparSessoesCustomizadasExpiradas,
    limparSessoesCustomizadasDoGrupo,
    autosairSchedules
};
