// src/commands/admin/so-adm.js

const path = require('path');
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const {
    isSoAdmAtivo,
    ativarSoAdm,
    desativarSoAdm
} = require(path.join(__dirname, '..', '..', 'lib', 'so-adm-state', 'so-adm-state.js'));

module.exports = {
    name: 'so-adm',
    aliases: ['soadm', 'onlyadm'],

    async execute(sock, m, options) {
        const { from, sender, config } = options;

        if (!from.endsWith('@g.us')) {
            await sock.sendMessage(from, {
                text: '❌ Este comando só pode ser acessado em grupos.'
            }, { quoted: m });
            return;
        }

        try {
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);

            if (!senderIsDono) {
                await sock.sendMessage(from, {
                    text: '*ACESSO RESTRITO⚔️*\nApenas o dono do bot pode usar este comando.'
                }, { quoted: m });
                return;
            }

            const grupoAtivo = isSoAdmAtivo(from);

            if (grupoAtivo) {
                // ── DESATIVAR ──────────────────────────────────────────────────
                desativarSoAdm(from);

                await sock.sendMessage(from, {
                    text: '*RESTRIÇÃO SO-ADM DESATIVADA COM SUCESSO!⚔️*\n\nTodos os membros podem usar os comandos do bot novamente neste grupo.'
                }, { quoted: m });

            } else {
                // ── ATIVAR ─────────────────────────────────────────────────────
                ativarSoAdm(from);

                await sock.sendMessage(from, {
                    text: '*RESTRIÇÃO SO-ADM ATIVADA COM SUCESSO!⚔️*\n\nO bot responderá apenas admins e o dono do bot neste grupo.'
                }, { quoted: m });
            }

        } catch (error) {
            console.error('Erro so-adm:', error.message);
            await sock.sendMessage(from, {
                text: '❌ Erro ao executar o comando so-adm.'
            }, { quoted: m });
        }
    },
};
