// src/commands/dono/modoaluguel.js
const path = require('path');
const { isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const {
    grupoTemModoAluguel,
    ativarModoAluguel,
    desativarModoAluguel
} = require(path.join(__dirname, '..', '..', 'lib', 'aluguel-state', 'aluguel-state.js'));

module.exports = {
    name: 'modoaluguel',
    aliases: ['modo-aluguel'],
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

            const ativo = grupoTemModoAluguel(from);

            if (ativo) {
                desativarModoAluguel(from);
                await sock.sendMessage(from, {
                    text: '*Entendido!* O sistema de aluguel dinâmico foi desativado neste grupo com sucesso!',
                    footer: 'SYSTEM-SONIC - Modo Aluguel'
                }, { quoted: m });
            } else {
                ativarModoAluguel(from);
                await sock.sendMessage(from, {
                    text: `*Perfeito!* Sistema de aluguel dinâmico ativado neste grupo com sucesso!\n\nUse o comando \`${prefixoAtual}config-aluguel\` para configurar com suas preferências.`,
                    footer: 'SYSTEM-SONIC - Modo Aluguel'
                }, { quoted: m });
            }

        } catch (error) {
            console.error('[MODOALUGUEL] Erro:', error.message);
            await sock.sendMessage(from, { text: '*Ops!* Erro ao executar comando modoaluguel.' }, { quoted: m });
        }
    }
};
