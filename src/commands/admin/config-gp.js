// src/commands/admin/config-gp.js
// Comando para configurar dados do grupo (nome, foto, descrição, permissões, mensagens temporárias)

module.exports = {
    name: 'config-gp',
    aliases: ['configurar-gp', 'cfg-gp', 'configgp'],
    description: 'Abre o menu de configuração do grupo',
    usage: 'Use o comando para abrir o menu de configurações do grupo',

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

            // Verificar se bot é admin
            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
            if (!botIsAdmin) {
                await sock.sendMessage(from, {
                    text: '*Ops! Eu preciso ser administrador do grupo para configurar o grupo.*'
                }, { quoted: m });
                return;
            }

            // Enviar menu principal de configuração do grupo
            await sock.sendMessage(from, {
                text: '*PERFEITO!* VAMOS CONFIGURAR O GRUPO, ALTERANDO DADOS IMPORTANTES\n\n' +
                      'Quais destes dados gostaria de alterar? O botão nome para editar o nome, ' +
                      'o botão foto para alterar a foto, o botão dscr para alterar a descrição, ' +
                      'o botão atrz-mnb para mudar a configuração de ter que autorizar entrada de membros, ' +
                      'edt-dados para alternar entre permitir a edição de dados do grupo por membros ou deixar para apenas admin, ' +
                      'e o botão atrz-add-mnb para autorizar se um membro pode adicionar novos membros, ' +
                      'e o TMP-GP para definir mensagens temporárias.',
                interactiveButtons: [
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'NOME',
                            id: 'configgp_nome'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'FOTO',
                            id: 'configgp_foto'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'DSCR',
                            id: 'configgp_dscr'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'ATRZ-MNB',
                            id: 'configgp_atrz_mnb'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'EDT-DADOS',
                            id: 'configgp_edt_dados'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'ATRZ-ADD-MNB',
                            id: 'configgp_atrz_add_mnb'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'TMP-GP',
                            id: 'configgp_tmp_gp'
                        })
                    }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error('[CONFIG-GP] Erro no comando:', error.message);
            await sock.sendMessage(from, {
                text: '*Erro ao abrir menu de configuração do grupo!*\n\nTente novamente mais tarde.'
            }, { quoted: m });
        }
    }
};
