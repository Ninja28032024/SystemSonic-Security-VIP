// src/lib/bemvindo-state/bemvindo-state.js
const path = require('path');
const fs = require('fs');

const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'bemvindo');
const CONFIG_FILE = path.join(DATABASE_DIR, 'configs.json');

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

function carregarConfigs() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[BEMVINDO-STATE] Erro ao carregar configs:', e.message);
    }
    return {};
}

function salvarConfigs(data) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('[BEMVINDO-STATE] Erro ao salvar configs:', e.message);
    }
}

function obterConfigBemvindo(groupId) {
    const configs = carregarConfigs();
    return configs[groupId] || null;
}

function salvarConfigBemvindo(groupId, config) {
    const configs = carregarConfigs();
    configs[groupId] = { ...config, atualizadoEm: new Date().toISOString() };
    salvarConfigs(configs);
}

function ativarBemvindo(groupId) {
    const configs = carregarConfigs();
    if (!configs[groupId]) {
        configs[groupId] = {
            ativo: true,
            legenda: 'Bem-vindo ao grupo @grupo, @user! Você é o membro de número @membros.'
        };
    } else {
        configs[groupId].ativo = true;
    }
    configs[groupId].atualizadoEm = new Date().toISOString();
    salvarConfigs(configs);
    return configs[groupId];
}

function desativarBemvindo(groupId) {
    const configs = carregarConfigs();
    if (!configs[groupId]) return null;
    configs[groupId].ativo = false;
    configs[groupId].atualizadoEm = new Date().toISOString();
    salvarConfigs(configs);
    return configs[groupId];
}

function definirLegenda(groupId, legenda) {
    const configs = carregarConfigs();
    if (!configs[groupId]) {
        configs[groupId] = {
            ativo: false,
            legenda
        };
    } else {
        configs[groupId].legenda = legenda;
    }
    configs[groupId].atualizadoEm = new Date().toISOString();
    salvarConfigs(configs);
    return configs[groupId];
}

function formatarMensagemBemvindo(mensagem, novoMemberId, nomeGrupo, numeroUsuario, lidReal, descricaoGrupo, totalMembros, temFoto) {
    const agora = new Date();
    const agoraBrasilia = new Date(agora.getTime() + (agora.getTimezoneOffset() * 60000) + (-3 * 3600000));
    const hora = String(agoraBrasilia.getHours()).padStart(2, '0') + ':' + String(agoraBrasilia.getMinutes()).padStart(2, '0');
    const dia = String(agoraBrasilia.getDate()).padStart(2, '0');
    const mes = String(agoraBrasilia.getMonth() + 1).padStart(2, '0');
    const ano = agoraBrasilia.getFullYear();
    const data = `${dia}/${mes}/${ano}`;
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemana = dias[agoraBrasilia.getDay()];
    const statusFoto = temFoto ? 'perfil com foto' : 'perfil sem foto';

    return mensagem
        .replace(/@user/g, `@${numeroUsuario}`)
        .replace(/@grupo/g, nomeGrupo)
        .replace(/@hora/g, hora)
        .replace(/@data/g, data)
        .replace(/@dia/g, diaSemana)
        .replace(/@numerouser/g, numeroUsuario)
        .replace(/@lid/g, lidReal)
        .replace(/@desc/g, descricaoGrupo || 'Sem descrição')
        .replace(/@membros/g, totalMembros)
        .replace(/@stts-profile/g, statusFoto);
}

module.exports = {
    obterConfigBemvindo,
    salvarConfigBemvindo,
    ativarBemvindo,
    desativarBemvindo,
    definirLegenda,
    formatarMensagemBemvindo
};
