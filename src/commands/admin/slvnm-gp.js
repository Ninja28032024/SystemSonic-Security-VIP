// src/commands/admin/slvnm-gp.js
// Comando para salvar o nome atual do grupo

const path = require('path');
const {
    salvarNomeGrupo
} = require(path.join(__dirname, '..', '..', 'lib', 'slvnm-gp-state', 'slvnm-gp-state.js'));

module.exports = {
    name: 'slvnm-gp',
    aliases: ['salvarnome', 'savename'],
    description: 'Salva o nome atual do grupo',
    usage: 'Use o comando no grupo',

    async execute(sock, m, options) {
        const { from, sender, isGroup, config, isUserAdmin, isOwner, prefixoAtual } = options;

        try {
            // Verificar se é grupo
            if (!isGroup) {
                await sock.sendMessage(from, {
                    text: '*Ops! Este comando só funciona em grupos.*'
                }, { quoted: m });
                return;
            }

            // Verificar permissões
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsOwner = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsOwner && !senderIsAdmin) {
                await sock.sendMessage(from, {
                    text: '*Ops! Você precisa ser administrador ou dono do bot para usar este comando.*'
                }, { quoted: m });
                return;
            }

            // Obter nome atual do grupo
            const groupName = groupMetadata.subject || 'Sem nome';

            // Salvar nome
            salvarNomeGrupo(from, groupName, sender);

            await sock.sendMessage(from, {
                text: `*PRONTINHO! O NOME DO GRUPO FOI SALVO COM SUCESSO.*\n\n` +
                      `O nome deste grupo foi salvo no meu banco de dados, para restaurar use ${prefixoAtual}rstrnm-gp.`
            }, { quoted: m });

        } catch (error) {
            console.error('[SLVNM-GP] Erro no comando:', error.message);
            await sock.sendMessage(from, {
                text: '*Erro ao salvar nome do grupo!*\n\nTente novamente mais tarde.'
            }, { quoted: m });
        }
    }
};