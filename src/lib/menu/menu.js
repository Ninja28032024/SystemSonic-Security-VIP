// src/lib/menu/menu.js
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'settings', 'config.json');
const COMMANDS_DIR = path.join(__dirname, '..', '..', 'commands');

let botName = "SYSTEM-SONIC";
if (fs.existsSync(CONFIG_PATH)) {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        if (config.botName) botName = config.botName;
    } catch (e) {
        console.error("Erro ao ler config.json no menu.js:", e.message);
    }
}

const CATEGORIAS = [
    {
        chave: 'membros',
        titulo: 'MEMBROS',
        pastas: ['membros'],
        icone: '👥',
        excluir: ['menu'],
        manuais: [
            { nome: 'consultelid', sintaxe: 'consultelid @marcar' },
            { nome: 's', sintaxe: 's/f' },
        ],
        ordemManual: false
    },
    {
        chave: 'brincadeiras',
        titulo: 'BRINCADEIRAS',
        pastas: ['brincadeiras'],
        icone: '🎮',
        manuais: [
            { nome: 'velha', sintaxe: 'velha @marcar' },
            { nome: 'cancelarvelha', sintaxe: 'cancelarvelha' },
        ]
    },
    {
        chave: 'downloads',
        titulo: 'DOWNLOADS',
        pastas: [],
        icone: '⬇️',
        manuais: [
            { nome: 'spotify', sintaxe: 'spotify' },
            { nome: 'play', sintaxe: 'play' },
        ]
    },
    {
        chave: 'admin',
        titulo: 'ADMIN',
        pastas: ['admin'],
        icone: '🛡️',
        excluir: [],
        manuais: [],
        ordemManual: false
    },
    {
        chave: 'dono',
        titulo: 'DONO',
        pastas: ['dono'],
        icone: '👑',
        excluir: ['copilot-ai'],
        manuais: [],
        ordemManual: false
    },
    {
        chave: 'ia',
        titulo: "IA's",
        pastas: ['inteligencia-artificial'],
        icone: '🤖',
        manuais: [
            { nome: 'copilot-ai', sintaxe: 'copilot-ai' },
        ]
    },
];

function lerComandosDaPasta(nomePasta) {
    const pastaPath = path.join(COMMANDS_DIR, nomePasta);
    if (!fs.existsSync(pastaPath)) return [];
    return fs.readdirSync(pastaPath)
        .filter(f => f.endsWith('.js'))
        .map(f => path.basename(f, '.js'));
}

function montarSecao(categoria, prefix) {
    const excluir = new Set(categoria.excluir || []);

    const dinamicos = [];
    for (const pasta of (categoria.pastas || [])) {
        const cmds = lerComandosDaPasta(pasta);
        for (const cmd of cmds) {
            if (!excluir.has(cmd)) dinamicos.push(cmd);
        }
    }

    const nomesManuais = new Set((categoria.manuais || []).map(m => m.nome));
    const dinamicosFiltrados = dinamicos.filter(cmd => !nomesManuais.has(cmd));

    const linhasManuais = (categoria.manuais || []).map(m =>
        `│ ִ ࣪𖤐➳ ${prefix}${m.sintaxe || m.nome}`
    );
    const linhasDinamicas = dinamicosFiltrados.map(cmd =>
        `│ ִ ࣪𖤐➳ ${prefix}${cmd}`
    );

    const linhas = categoria.ordemManual
        ? [...linhasManuais, ...linhasDinamicas]
        : [...linhasDinamicas, ...linhasManuais];

    if (linhas.length === 0) return null;

    const cabecalho = `┏── *『 ${categoria.titulo} 』* ──`;
    const rodape = `┗──────────────────`;

    return [cabecalho, ...linhas, rodape].join('\n');
}

function montarCabecalho(prefix, senderName, senderId, ownerNumber) {
    const limit = (str, max) => {
        if (!str) return '';
        const clean = str.split('@')[0];
        return clean.length > max ? clean.substring(0, max - 3) + '...' : clean;
    };

    return `┏── *『 ${botName} 』* ─
│ ִ ࣪𖤐➳ *Bot:* ${botName}
│ ִ ࣪𖤐➳ *Prefixo:* [ ${prefix} ]
│ ִ ࣪𖤐➳ *Solicitante:* ${limit(senderName, 8)}
│ ִ ࣪𖤐➳ *Dono:* ${limit(ownerNumber, 12)}
│ ִ ࣪𖤐➳ *ID:* ${limit(senderId, 12)}
│ ִ ࣪𖤐➳ *Status:* Online 
┗──────────────────`;
}

const menu = (prefix, senderName, senderId, ownerNumber, botId) => {
    const cabecalhoPrincipal = montarCabecalho(prefix, senderName, senderId, ownerNumber);

    const secoes = CATEGORIAS
        .map(cat => montarSecao(cat, prefix))
        .filter(Boolean)
        .join('\n');

    return `${cabecalhoPrincipal}\n${secoes}`;
};

const menuCategoria = (chave, prefix, senderName, senderId, ownerNumber) => {
    const categoria = CATEGORIAS.find(c => c.chave === chave);
    if (!categoria) return null;

    const cabecalhoPrincipal = montarCabecalho(prefix, senderName, senderId, ownerNumber);
    const secao = montarSecao(categoria, prefix);
    if (!secao) return null;

    return `${cabecalhoPrincipal}\n${secao}`;
};

module.exports = { menu, menuCategoria };
