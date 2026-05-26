// CAMINHO: src/lib/mute-hooks/mute-hooks.js
// Centraliza os hooks do sistema de mute que precisam agir no nível do sock:
//   1. Intercepta sock.sendMessage para injetar botão "X MEMBRO MUTADO"
//   2. setInterval que notifica desmutes expirados

const path = require('path');
const { isOwner, isUserAdmin } = require(path.join(__dirname, '..', '..', 'utils.js'));
const {
    obterQuantidadeMutadosAtivos,
    processarMutadosExpirados
} = require(path.join(__dirname, '..', 'mute-state', 'mute-state.js'));

let muteNotificationInterval = null;

function iniciarMuteHooks(sock, config) {
    // ── 1. Interceptação do sendMessage ───────────────────────────────────────
    // Injeta o botão "X MEMBRO MUTADO" em mensagens enviadas pelo bot
    // quando o destinatário for admin/dono e houver mutados no grupo.
    const originalSendMessage = sock.sendMessage.bind(sock);
    sock.sendMessage = async function (jid, content, options) {
        try {
            const isGroup = typeof jid === 'string' && jid.endsWith('@g.us');
            if (options?.quoted?.message && isGroup) {
                const quotedSender = options.quoted.key?.participant || options.quoted.key?.remoteJid;
                const metadata = await sock.groupMetadata(jid);
                const qOwner = await isOwner(quotedSender, config.ownerNumber, sock);
                const qAdmin = await isUserAdmin(quotedSender, metadata, sock);
                const qMutados = obterQuantidadeMutadosAtivos(jid);
                if ((qOwner || qAdmin) && qMutados > 0) {
                    if (!Array.isArray(content.interactiveButtons)) content.interactiveButtons = [];
                    content.interactiveButtons.push({
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: `${qMutados} MEMBRO MUTADO`,
                            id: 'mute_show_muted'
                        })
                    });
                }
            }
        } catch (e) {}
        return originalSendMessage(jid, content, options);
    };

    // ── 2. Notificação de desmutes expirados ──────────────────────────────────
    // Verifica a cada 15s se algum mute expirou e avisa no grupo.
    if (muteNotificationInterval) clearInterval(muteNotificationInterval);
    muteNotificationInterval = setInterval(async () => {
        const exp = processarMutadosExpirados();
        if (Array.isArray(exp)) {
            for (const r of exp) {
                try {
                    await sock.sendMessage(r.groupId, {
                        text: `*O MEMBRO @${r.targetJid.split('@')[0]} FOI DESMUTADO*`,
                        mentions: [r.targetJid]
                    });
                } catch (e) {}
            }
        }
    }, 15000);
}

module.exports = { iniciarMuteHooks };
