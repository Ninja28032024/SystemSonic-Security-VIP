// src/commands/admin/rstrnm-gp.js
// Comando para restaurar o nome salvo do grupo

const path = require('path');
const {
    obterNomeSalvo
} = require(path.join(__dirname, '..', '..', 'lib', 'slvnm-gp-state', 'slvnm-gp-state.js'));

module.exports = {
    name: 'rstrnm-gp',
    aliases: ['restaurarnome', 'restorename'],
    description: 'Restaura o nome salvo do grupo',
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

            // Verificar se bot é admin
            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
            if (!botIsAdmin) {
                await sock.sendMessage(from, {
                    text: '*Ops! Eu preciso ser administrador do grupo para alterar o nome.*'
                }, { quoted: m });
                return;
            }

            // Obter nome salvo
            const nomeSalvo = obterNomeSalvo(from);

            if (!nomeSalvo) {
                await sock.sendMessage(from, {
                    text: `*Ops! Nenhum nome salvo encontrado para este grupo.*\n\n` +
                          `Use ${prefixoAtual}slvnm-gp para salvar o nome atual primeiro.`
                }, { quoted: m });
                return;
            }

            // Restaurar nome do grupo
            await sock.groupUpdateSubject(from, nomeSalvo.groupName);

            await sock.sendMessage(from, {
                text: '*RESTAUREI O NOME DO GRUPO*\n\n' +
                      'Agora o grupo tem o mesmo nome de antes.'
            }, { quoted: m });

        } catch (error) {
            console.error('[RSTRNM-GP] Erro no comando:', error.message);
            await sock.sendMessage(from, {
                text: '*Erro ao restaurar nome do grupo!*\n\nTente novamente mais tarde.'
            }, { quoted: m });
        }
    }
};