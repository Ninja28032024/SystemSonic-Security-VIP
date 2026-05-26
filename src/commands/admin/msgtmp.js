// src/commands/admin/msgtmp.js
// Comando para gerenciar mensagens temporárias no grupo

module.exports = {
    name: 'msg-tmp',
    aliases: ['msgtmp', 'msgtemp', 'disappearing'],
    description: 'Ativa ou desativa as mensagens temporárias do grupo',
    usage: 'Use o comando para abrir o menu',

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

            // Verificar permissões do usuário
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsOwner = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsOwner && !senderIsAdmin) {
                await sock.sendMessage(from, {
                    text: '*Ops! Você precisa ser administrador ou dono do bot para usar este comando.*'
                }, { quoted: m });
                return;
            }

            // Verificar se bot é admin (necessário para ler e alterar a configuração)
            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
            if (!botIsAdmin) {
                await sock.sendMessage(from, {
                    text: '*Ops! Eu preciso ser administrador do grupo para gerenciar as mensagens temporárias.*'
                }, { quoted: m });
                return;
            }

            // Verificar o estado atual (toggle)
            const ephemeralDuration = groupMetadata.ephemeralDuration;

            if (ephemeralDuration && ephemeralDuration > 0) {
                // Sistema está ATIVADO, mostrar opção de desativar
                await sock.sendMessage(from, {
                    text: '*O SISTEMA DE MENSAGENS TEMPORÁRIAS ESTÁ ATIVADO NESTE GRUPO*\n\n' +
                          'Clique no botão abaixo para desativar.',
                    interactiveButtons: [{
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'DESATIVAR',
                            id: 'msgtmp_disable'
                        })
                    }]
                }, { quoted: m });

            } else {
                // Sistema está DESATIVADO, mostrar opções de ativar
                await sock.sendMessage(from, {
                    text: '*OK, DEFINE O TEMPO NOS BOTÕES ABAIXO*\n\n' +
                          'Clique no botão com o período em que deseja que as mensagens sejam expiradas.',
                    interactiveButtons: [
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '24 HORAS',
                                id: 'msgtmp_set_24h'
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '7 DIAS',
                                id: 'msgtmp_set_7d'
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '90 DIAS',
                                id: 'msgtmp_set_90d'
                            })
                        }
                    ]
                }, { quoted: m });
            }

        } catch (error) {
            console.error('[MSG-TMP] Erro no comando:', error.message);
            await sock.sendMessage(from, {
                text: '*Erro ao gerenciar mensagens temporárias!*\n\nTente novamente mais tarde.'
            }, { quoted: m });
        }
    }
};