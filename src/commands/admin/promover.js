const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: "promover",
    aliases: [],
    async execute(sock, m, options) {
        const { from, sender, senderName, config } = options;

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

            let targetJid = null;
            if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                targetJid = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
            } else if (m.message?.conversation?.includes("@")) {
                // Tentar extrair menção do texto da conversa
                const mencoes = m.message.conversation.match(/@(\d+)/g);
                if (mencoes && mencoes.length > 0) {
                    const numero = mencoes[0].substring(1);
                    targetJid = numero + "@s.whatsapp.net";
                }
            }

            if (!targetJid) {
                await sock.sendMessage(from, { text: "❓ ALVO NÃO IDENTIFICADO\nMencione alguém para promover!" }, { quoted: m });
                return;
            }

            const targetName = targetJid.split('@')[0];
            const senderNumber = sender.split('@')[0];

            // Verificar se o alvo já é administrador
            const targetIsAdmin = await isUserAdmin(targetJid, groupMetadata, sock);
            if (targetIsAdmin) {
                await sock.sendMessage(from, { 
                    text: `❌ O membro @${targetName} já é administrador deste grupo!`,
                    mentions: [targetJid]
                }, { quoted: m });
                return;
            }

            // Enviar primeira mensagem informando que está promovendo
            const msgPromovendo = `*PROMOVENDO MEMBRO PARA ADMINISTRADOR⚖️*\nO membro @${targetName} está sendo promovido por ordem de @${senderNumber} neste grupo.`;
            
            await sock.sendMessage(from, {
                text: msgPromovendo,
                mentions: [targetJid, sender]
            }, { quoted: m });

            // Executar a promoção
            await sock.groupParticipantsUpdate(from, [targetJid], "promote");

            // Enviar segunda mensagem confirmando a promoção
            const msgPromovido = `*MEMBRO PROMOVIDO A ADMINISTRADOR⚔️*\nO membro @${targetName} foi promovido por ordem de @${senderNumber} com sucesso!`;
            
            await sock.sendMessage(from, {
                text: msgPromovido,
                mentions: [targetJid, sender]
            }, { quoted: m });

        } catch (error) {
            console.error("Erro promover:", error.message);
            await sock.sendMessage(from, { text: "💥 OPS! DEU ERRO\n\nErro ao executar comando promover." }, { quoted: m });
        }
    },
};
