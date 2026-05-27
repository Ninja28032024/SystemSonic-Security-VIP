// src/commands/dono/so-dono.js
// Bloqueia todos os comandos no grupo para membros e admins.
// Apenas o dono do bot pode usar os comandos enquanto ativo.
// Apenas o dono do bot pode ativar/desativar.

const path = require('path');
const { isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { isSoDonoAtivo, ativarSoDono, desativarSoDono } = require(path.join(__dirname, '..', '..', 'lib', 'so-dono-state', 'so-dono-state.js'));

module.exports = {
    name: 'so-dono',
    aliases: ['sodono', 'onlydono', 'only-dono'],

    async execute(sock, m, options) {
        const { from, sender, config } = options;

        // ── Só funciona em grupos ──────────────────────────────────────────
        if (!from.endsWith('@g.us')) {
            await sock.sendMessage(from, {
                text: '*ATENÇÃO⚔️*\nEste comando só pode ser usado em grupos.'
            }, { quoted: m });
            return;
        }

        // ── Só o dono pode usar ────────────────────────────────────────────
        const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
        if (!senderIsDono) {
            await sock.sendMessage(from, {
                text: '*ACESSO RESTRITO⚔️*\nApenas o dono do bot pode usar este comando.'
            }, { quoted: m });
            return;
        }

        try {
            const ativo = isSoDonoAtivo(from);

            if (ativo) {
                desativarSoDono(from);
                await sock.sendMessage(from, {
                    text: '*RESTRIÇÃO SO-DONO DESATIVADA COM SUCESSO!⚔️*\n\nTodos podem usar os comandos do bot novamente neste grupo.'
                }, { quoted: m });
            } else {
                ativarSoDono(from);
                await sock.sendMessage(from, {
                    text: '*RESTRIÇÃO SO-DONO ATIVADA COM SUCESSO!⚔️*\n\nO bot responderá apenas ao dono do bot neste grupo.'
                }, { quoted: m });
            }

        } catch (error) {
            console.error('[SO-DONO] Erro:', error.message);
            await sock.sendMessage(from, {
                text: '❌ Erro ao executar o comando so-dono.'
            }, { quoted: m });
        }
    }
};
