// src/commands/dono/alugar.js
const path = require('path');
const { isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const {
    grupoTemModoAluguel,
    calcularPrecos,
    formatarReais,
    definirSetup,
    limparSetup
} = require(path.join(__dirname, '..', '..', 'lib', 'aluguel-state', 'aluguel-state.js'));

module.exports = {
    name: 'alugar',
    aliases: [],
    async execute(sock, m, options) {
        const { from, sender, config } = options;

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
                    text: '*Ops!* O modo aluguel não está ativado neste grupo.',
                    footer: 'SYSTEM-SONIC - Modo Aluguel'
                }, { quoted: m });
                return;
            }

            const precos = calcularPrecos();
            if (!precos) {
                await sock.sendMessage(from, {
                    text: '*Ops!* Nenhum preço configurado. Use !config-aluguel para definir os valores.',
                    footer: 'SYSTEM-SONIC - Modo Aluguel'
                }, { quoted: m });
                return;
            }

            limparSetup(from, sender);
            definirSetup(from, sender, 'alugar_manual');

            const botoes = [5, 10, 15, 20, 25, 30].map(dias => ({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: `${dias} dias | ${formatarReais(precos[dias])}`,
                    id: `alugar_manual_${dias}`
                })
            }));

            await sock.sendMessage(from, {
                text: '*POR QUAL PERÍODO DESEJA ALUGAR?*',
                footer: 'SYSTEM-SONIC - Modo Aluguel',
                interactiveButtons: botoes
            }, { quoted: m });

        } catch (error) {
            console.error('[ALUGAR] Erro:', error.message);
            await sock.sendMessage(from, { text: '*Ops!* Erro ao executar comando alugar.' }, { quoted: m });
        }
    }
};
