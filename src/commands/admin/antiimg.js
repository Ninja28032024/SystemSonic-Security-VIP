// src/commands/admin/antiimg.js
// Comando para configurar sistema anti-imagens

const path = require('path');
const {
    obterConfiguracao,
    desativarAntiimg,
    definirEtapaSetup,
    limparSetup
} = require(path.join(__dirname, '..', '..', 'lib', 'antiimg-state', 'antiimg-state.js'));

module.exports = {
    name: 'antiimg',
    aliases: ['antiimagem', 'antifoto'],
    description: 'Configura o sistema anti-imagens do grupo',
    usage: 'Use o comando para ativar/desativar',

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

            // Verificar se já está configurado (toggle)
            const configuracaoAtual = obterConfiguracao(from);

            if (configuracaoAtual) {
                // Desativar
                desativarAntiimg(from);
                limparSetup(from);

                await sock.sendMessage(from, {
                    text: '*Sistema de antiimg desativado com sucesso!!*\n\nSystemSonic Security - Anti imagens'
                }, { quoted: m });
                return;
            }

            // Iniciar configuração
            definirEtapaSetup(from, sender, 'await_delete_image', {});

            await sock.sendMessage(from, {
                text: '*CERTO! ENTENDI QUE DESEJA DEFINIR UM ANTI IMAGENS NESTE GRUPO*\n' +
                      'Mas antes, que tal me informar mais detalhes? Deseja que a imagem seja apagada para todos ao ser detectada?',
                interactiveButtons: [
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'SIM',
                            id: 'antiimg_delete_yes'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'NÃO',
                            id: 'antiimg_delete_no'
                        })
                    }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error('[ANTIIMG] Erro no comando:', error.message);
            await sock.sendMessage(from, {
                text: '*Erro ao processar comando!*\n\nTente novamente mais tarde.'
            }, { quoted: m });
        }
    }
};