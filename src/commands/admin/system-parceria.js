// src/commands/admin/system-parceria.js
// Comando para ativar/desativar o sistema de parcerias

const path = require('path');
const { obterStatusSistema, ativarSistema, desativarSistema } = require(path.join(__dirname, '..', '..', 'lib', 'parceria-state', 'parceria-state.js'));

module.exports = {
    name: 'system-parceria',
    aliases: ['systemparceria'],
    description: 'Ativa ou desativa o sistema de parcerias do grupo',
    usage: '<prefixo>system-parceria',

    async execute(sock, m, options) {
        const { from, sender, isGroup, isUserAdmin } = options;

        try {
            // Verificar se é um grupo
            if (!isGroup) {
                await sock.sendMessage(from, {
                    text: '*Este comando só pode ser usado em grupos.*'
                }, { quoted: m });
                return;
            }

            // Verificar se o usuário é administrador
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsAdmin) {
                await sock.sendMessage(from, {
                        text: '*Ops! Você não é dono do Bot e nem administrador do grupo, se ponha no seu lugar.*'
                }, { quoted: m });
                return;
            }

            // Verificar status atual do sistema
            const sistemaAtivo = obterStatusSistema(from);

            // Montar botão baseado no status
            const buttonText = sistemaAtivo ? 'DESATIVAR' : 'ATIVAR';
            const buttonId = sistemaAtivo ? 'parceria_system_desativar' : 'parceria_system_ativar';

            await sock.sendMessage(from, {
                text: '*SYSTEMSONIC - PARCERIAS*',
                footer: `Sistema atualmente: ${sistemaAtivo ? 'ATIVO' : 'DESATIVADO'}`,
                interactiveButtons: [
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: buttonText,
                            id: buttonId
                        })
                    }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error('[SYSTEM-PARCERIA] Erro ao executar comando:', error.message);
            await sock.sendMessage(from, {
                text: '*❌ Erro ao processar o comando.*'
            }, { quoted: m });
        }
    }
};