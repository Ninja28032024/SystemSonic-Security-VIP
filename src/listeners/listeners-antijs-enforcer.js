// src/listeners/listeners-antijs-enforcer.js
const path = require("path");
const { obterConfigAntijs, incrementarAdvertenciaAntijs, resetarAdvertenciasAntijs } = require(path.join(__dirname, '..', 'lib', 'antijs-state', 'antijs-state.js'));
const { isUserAdmin } = require(path.join(__dirname, '..', 'utils.js'));

const JS_MIMETYPES = [
    'application/javascript',
    'text/javascript',
    'application/x-javascript',
    'text/ecmascript',
    'application/ecmascript'
];

function isJs(m) {
    const msg = m.message || {};
    const tipo = Object.keys(msg)[0] || '';

    if (tipo === 'documentMessage') {
        const mimetype = msg.documentMessage?.mimetype || '';
        const fileName = (msg.documentMessage?.fileName || '').toLowerCase();
        return JS_MIMETYPES.includes(mimetype) || fileName.endsWith('.js') || fileName.endsWith('.mjs') || fileName.endsWith('.cjs');
    }

    if (tipo === 'documentWithCaptionMessage') {
        const doc = msg.documentWithCaptionMessage?.message?.documentMessage;
        if (doc) {
            const mimetype = doc.mimetype || '';
            const fileName = (doc.fileName || '').toLowerCase();
            return JS_MIMETYPES.includes(mimetype) || fileName.endsWith('.js') || fileName.endsWith('.mjs') || fileName.endsWith('.cjs');
        }
    }

    return false;
}

module.exports = {
    name: "antijs-enforcer",
    async execute(sock, m, options) {
        const { from, sender } = options;
        if (!from.endsWith("@g.us")) return false;

        const config = obterConfigAntijs(from);
        if (!config || !config.ativo) return false;

        if (!isJs(m)) return false;

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);
            const senderIsDono = config.configuradoPor === sender;
            if (senderIsAdmin || senderIsDono) return false;

            if (config.deletarMidia) {
                try {
                    await sock.sendMessage(from, {
                        delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender }
                    });
                } catch (e) {}
            }

            if (!config.removerMembro) return true;

            if (config.modoRemocao === 'imediato') {
                try {
                    await sock.groupParticipantsUpdate(from, [sender], "remove");
                    await sock.sendMessage(from, {
                        text: `*ANTI JS*\n\n@${sender.split('@')[0]} foi removido por enviar arquivo JavaScript (.js).`,
                        mentions: [sender]
                    });
                } catch (e) {}
                return true;
            }

            if (config.modoRemocao === 'advertencia') {
                const qtdAtual = incrementarAdvertenciaAntijs(from, sender);
                const limite = config.qtdAdvertencias;
                if (qtdAtual >= limite) {
                    try {
                        await sock.groupParticipantsUpdate(from, [sender], "remove");
                        await sock.sendMessage(from, {
                            text: `*ANTI JS*\n\n@${sender.split('@')[0]} foi removido por atingir ${limite} advertências por enviar arquivos JavaScript (.js).`,
                            mentions: [sender]
                        });
                        resetarAdvertenciasAntijs(from, sender);
                    } catch (e) {}
                } else {
                    await sock.sendMessage(from, {
                        text: `*ANTI JS*\n\n@${sender.split('@')[0]} você recebeu uma advertência (${qtdAtual}/${limite}) por enviar arquivo JavaScript (.js).${config.deletarMidia ? '\nO arquivo foi deletado.' : ''}`,
                        mentions: [sender]
                    });
                }
            }
            return true;
        } catch (error) {
            console.error("[ANTIJS-ENFORCER] Erro:", error.message);
            return false;
        }
    }
};
