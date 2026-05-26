const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));

/**
 * Função para identificar o tipo de mensagem
 * @param {Object} quotedMessage - A mensagem citada
 * @returns {string} - Tipo da mensagem em português
 */
function getMessageType(quotedMessage) {
    if (!quotedMessage) return "Desconhecido";

    const type = Object.keys(quotedMessage)[0];
    
    const typeMap = {
        'conversation': 'Texto',
        'extendedTextMessage': 'Texto',
        'stickerMessage': 'Figurinha',
        'imageMessage': 'Imagem',
        'videoMessage': 'Vídeo',
        'audioMessage': 'Áudio',
        'documentMessage': 'Documento',
        'locationMessage': 'Localização',
        'contactMessage': 'Contato',
        'templateButtonReplyMessage': 'Botão',
        'buttonsResponseMessage': 'Botão',
        'interactiveResponseMessage': 'Interativo',
        'listResponseMessage': 'Lista',
        'groupInviteMessage': 'Convite de Grupo'
    };

    return typeMap[type] || 'Outro';
}

module.exports = {
    name: "delete",
    aliases: ["del", "apagar"],
    async execute(sock, m, options) {
        const { from, sender, config } = options;

        if (!from.endsWith("@g.us")) {
            await sock.sendMessage(from, { text: "❌ Este comando só pode ser acessado em grupos." }, { quoted: m });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            // Permite que o dono do bot ou um administrador do grupo use o comando
            if (!senderIsDono && !senderIsAdmin) {
                await sock.sendMessage(from, { text: "*ACESSO RESTRITO!*\nApenas um administrador do grupo ou o dono do bot pode usar este comando." }, { quoted: m });
                return;
            }

            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
            if (!botIsAdmin) {
                await sock.sendMessage(from, { text: "❓ CADÊ MEU CARGO DE ADM\nEu não sou administrador deste grupo!" }, { quoted: m });
                return;
            }

            // Verificar se há uma mensagem marcada (quoted)
            if (!m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                await sock.sendMessage(from, { text: "❌ Marque uma mensagem para deletá-la!\n\nExemplo: Responda a uma mensagem com o comando !delete" }, { quoted: m });
                return;
            }

            const quotedMessage = m.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedMessageKey = m.message.extendedTextMessage.contextInfo.stanzaId;
            const messageType = getMessageType(quotedMessage);

            try {
                // Reagir com emoji de lixeira
                await sock.sendMessage(from, {
                    react: {
                        text: "🗑️",
                        key: m.key
                    }
                });
            } catch (e) {
                // Ignorar se a reação falhar
            }

            // Deletar a mensagem para todos
            try {
                await sock.sendMessage(from, {
                    delete: m.message.extendedTextMessage.contextInfo.stanzaId ? 
                        {
                            remoteJid: from,
                            fromMe: false,
                            id: m.message.extendedTextMessage.contextInfo.stanzaId,
                            participant: m.message.extendedTextMessage.contextInfo.participant
                        } : m.message.extendedTextMessage.contextInfo
                });
            } catch (deleteError) {
                // Tentar método alternativo
                try {
                    await sock.sendMessage(from, {
                        delete: {
                            remoteJid: from,
                            fromMe: false,
                            id: m.message.extendedTextMessage.contextInfo.stanzaId,
                            participant: m.message.extendedTextMessage.contextInfo.participant
                        }
                    });
                } catch (e) {
                    // Se ainda falhar, apenas enviar mensagem de erro
                    await sock.sendMessage(from, { 
                        text: "❌ Não consegui deletar a mensagem. Verifique se ela é recente o suficiente." 
                    }, { quoted: m });
                    return;
                }
            }

            // Enviar mensagem de confirmação
            const msgConfirmacao = `*MENSAGEM DELETADA COM SUCESSO🗑️*\nA mensagem ${messageType} foi deletada com sucesso.`;
            
            await sock.sendMessage(from, {
                text: msgConfirmacao
            }, { quoted: m });

        } catch (error) {
            console.error("Erro delete:", error.message);
            await sock.sendMessage(from, { text: "💥 OPS! DEU ERRO\n\nErro ao executar comando delete." }, { quoted: m });
        }
    },
};
