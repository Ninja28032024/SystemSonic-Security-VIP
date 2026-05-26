// src/commands/dono/config-aluguel.js
const path = require('path');
const { isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const {
    grupoTemModoAluguel,
    definirSetup,
    limparSetup,
    obterToken
} = require(path.join(__dirname, '..', '..', 'lib', 'aluguel-state', 'aluguel-state.js'));

module.exports = {
    name: 'config-aluguel',
    aliases: ['configurar-aluguel'],
    async execute(sock, m, options) {
        const { from, sender, prefixoAtual, config } = options;

        if (!from.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: '*Ops!* Este comando só pode ser usado em grupos.' }, { quoted: m });
            return;
        }

        try {
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
            if (!senderIsDono) {
                await sock.sendMessage(from, { text: '*Ops!* Apenas o dono do bot pode usar este comando.' }, { quoted: m });
                return;
            }

            if (!grupoTemModoAluguel(from)) {
                await sock.sendMessage(from, {
                    text: `*Ops!* O modo aluguel não está ativado neste grupo.\n\nAtive primeiro com ${prefixoAtual}modoaluguel e tente novamente.`,
                    footer: 'SYSTEM-SONIC - Modo Aluguel'
                }, { quoted: m });
                return;
            }

            limparSetup(from, sender);
            definirSetup(from, sender, 'escopo');

            await sock.sendMessage(from, {
                text: '*OK!* VAMOS CONFIGURAR O SISTEMA DE MODO ALUGUEL NESTE GRUPO\n\nO sistema deve ser ativo e cobrado apenas neste grupo?',
                footer: 'SYSTEM-SONIC - Modo Aluguel',
                interactiveButtons: [
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'SIM', id: 'aluguel_escopo_sim' }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'NÃO', id: 'aluguel_escopo_nao' }) }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error('[CONFIG-ALUGUEL] Erro:', error.message);
            await sock.sendMessage(from, { text: '*Ops!* Erro ao executar comando config-aluguel.' }, { quoted: m });
        }
    }
};
