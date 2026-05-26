// src/commands/admin/parceria.js
// Comando para gerenciar sistema de parcerias do grupo

const path = require('path');
const { obterStatusSistema } = require(path.join(__dirname, '..', '..', 'lib', 'parceria-state', 'parceria-state.js'));

const MSG_SISTEMA_DESATIVADO = '*Ops!* O sistema de parcerias está desativado, ative para usar.';

module.exports = {
    name: 'parceria',
    aliases: ['parcerias'],
    description: 'Gerencia o sistema de parcerias do grupo',
    usage: '<prefixo>parceria',

    async execute(sock, m, options) {
        const { from, sender, isGroup, isUserAdmin } = options;

        try {
            if (!isGroup) {
                await sock.sendMessage(from, {
                    text: '*Este comando só pode ser usado em grupos.*'
                }, { quoted: m });
                return;
            }

            const groupMetadata = await sock.groupMetadata(from);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsAdmin) {
                await sock.sendMessage(from, {
                    text: '*Ops! Você não tem permissão de administrador para usar este comando.*'
                }, { quoted: m });
                return;
            }

            // VALIDAR SE O SISTEMA ESTÁ ATIVO
            const sistemaAtivo = obterStatusSistema(from);
            if (!sistemaAtivo) {
                await sock.sendMessage(from, { text: MSG_SISTEMA_DESATIVADO }, { quoted: m });
                return;
            }

            await sock.sendMessage(from, {
                text: '*O QUE DESEJA NO SISTEMA DE PARCERIAS*',
                footer: 'SYSTEM-SONIC | Parcerias',
                interactiveButtons: [
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'VER PARCEIROS',
                            id: 'parceria_ver_parceiros'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'ADD PARCERIA',
                            id: 'parceria_add_parceria'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'RMV PARCERIA',
                            id: 'parceria_rmv_parceria'
                        })
                    }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error('[PARCERIA] Erro ao executar comando:', error.message);
            await sock.sendMessage(from, {
                text: '*❌ Erro ao processar o comando de parcerias.*'
            }, { quoted: m });
        }
    }
};