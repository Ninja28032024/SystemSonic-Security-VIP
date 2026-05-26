// src/commands/admin/redefinir-link.js
// Comando para redefinir o link de convite do grupo

const path = require('path');
const {
    criarPendencia
} = require(path.join(__dirname, '..', '..', 'lib', 'redefinir-link-state', 'redefinir-link-state.js'));

module.exports = {
    name: 'redefinir-link',
    aliases: ['resetlink', 'revokelink', 'novolink'],
    description: 'Redefine o link de convite do grupo',
    usage: 'Use o comando no grupo',

    async execute(sock, m, options) {
        const { from, sender, isGroup, config, isUserAdmin, isOwner } = options;

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
                    text: '*Ops! Eu preciso ser administrador do grupo para redefinir o link.*'
                }, { quoted: m });
                return;
            }

            // Revogar link atual (isso gera um novo automaticamente)
            await sock.groupRevokeInvite(from);

            // Obter o novo código de convite
            const newInviteCode = await sock.groupInviteCode(from);

            // Criar pendência para revelar o link
            criarPendencia(from, sender, newInviteCode);

            // Enviar mensagem com botões
            await sock.sendMessage(from, {
                text: '*LINK DO GRUPO REDEFINIDO COM SUCESSO!*\n\n' +
                      'Deseja revelar o link do grupo para os membros?',
                interactiveButtons: [
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'SIM',
                            id: 'redefinir_link_reveal_yes'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'NÃO',
                            id: 'redefinir_link_reveal_no'
                        })
                    }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error('[REDEFINIR-LINK] Erro no comando:', error.message);
            
            if (error.message.includes('not-authorized')) {
                await sock.sendMessage(from, {
                    text: '*Ops! Eu preciso ser administrador do grupo para redefinir o link.*'
                }, { quoted: m });
            } else {
                await sock.sendMessage(from, {
                    text: '*Erro ao redefinir link do grupo!*\n\nTente novamente mais tarde.'
                }, { quoted: m });
            }
        }
    }
};