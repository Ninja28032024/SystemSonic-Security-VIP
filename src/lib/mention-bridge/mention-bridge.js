// CAMINHO: src/lib/mention-bridge/mention-bridge.js
//
// Intercepta sock.sendMessage quando há mentions + interactiveButtons juntos
// e converte automaticamente para generateWAMessageFromContent + viewOnceMessage,
// que é a única estrutura que renderiza menções clicáveis com botões neste Baileys.
// Todos os outros arquivos continuam usando sock.sendMessage normalmente — sem mudanças.

const { generateWAMessageFromContent } = require('@systemzero/baileys');

function aplicarMentionBridge(sock) {
    const sendMessageOriginal = sock.sendMessage.bind(sock);

    sock.sendMessage = async function mentionBridge(jid, content, options = {}) {
        // Só intercepta se tiver mentions E interactiveButtons ao mesmo tempo
        if (
            Array.isArray(content?.mentions) &&
            content.mentions.length > 0 &&
            Array.isArray(content?.interactiveButtons) &&
            content.interactiveButtons.length > 0
        ) {
            const texto   = content.text   || '';
            const footer  = content.footer || '';
            const mencoes = content.mentions;
            const botoes  = content.interactiveButtons;
            const quoted  = options?.quoted || undefined;

            const msg = generateWAMessageFromContent(jid, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            header: { hasMediaAttachment: false },
                            body:   { text: texto },
                            footer: { text: footer },
                            contextInfo: { mentionedJid: mencoes },
                            nativeFlowMessage: { buttons: botoes }
                        }
                    }
                }
            }, { quoted });

            return await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
        }

        // Qualquer outra chamada passa direto sem alteração
        return sendMessageOriginal(jid, content, options);
    };

    return sock;
}

module.exports = { aplicarMentionBridge };
