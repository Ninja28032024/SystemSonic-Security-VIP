// src/commands/dono/so-membro.js
// Restringe os comandos do bot apenas para membros comuns do grupo
// (exclui admins NÃO — membros comuns SIM, admins SIM, só bloqueia não-membros/externos).
// Na prática: bloqueia quem não faz parte do grupo de usar os comandos do bot.
// Apenas o dono do bot pode ativar/desativar.

const path = require('path');
const { isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const {
    isSoMembroAtivo,
    ativarSoMembro,
    desativarSoMembro
} = require(path.join(__dirname, '..', '..', 'lib', 'so-membro-state', 'so-membro-state.js'));

module.exports = {
    name: 'so-membro',
    aliases: ['somembro', 'onlymembro', 'only-membro'],

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
            const ativo = isSoMembroAtivo(from);

            if (ativo) {
                // ── DESATIVAR ──────────────────────────────────────────────
                desativarSoMembro(from);

                await sock.sendMessage(from, {
                    text: '*RESTRIÇÃO SO-MEMBRO DESATIVADA COM SUCESSO!⚔️*\n\nTodos podem usar os comandos do bot novamente neste grupo.'
                }, { quoted: m });

            } else {
                // ── ATIVAR ─────────────────────────────────────────────────
                ativarSoMembro(from);

                await sock.sendMessage(from, {
                    text: '*RESTRIÇÃO SO-MEMBRO ATIVADA COM SUCESSO!⚔️*\n\nO bot responderá apenas membros do grupo e o dono do bot.'
                }, { quoted: m });
            }

        } catch (error) {
            console.error('[SO-MEMBRO] Erro:', error.message);
            await sock.sendMessage(from, {
                text: '❌ Erro ao executar o comando so-membro.'
            }, { quoted: m });
        }
    }
};
