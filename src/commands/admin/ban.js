const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: "ban",
    aliases: [],
    async execute(sock, m, options) {
        const { from, sender, args, config } = options;
        const useMention = true;

        if (!from.endsWith("@g.us")) {
            await sock.sendMessage(from, { text: "❌Este comando só pode ser acessado em grupos. *Esteja em um grupo com o Bot e poderá usar este comando.*" }, { quoted: m });
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
            } else if (args[0]) {
                const numberArg = args[0].replace(/[^0-9]/g, "");
                targetJid = numberArg + "@s.whatsapp.net";
            }

            if (!targetJid) {
                await sock.sendMessage(from, { text: "❓ ALVO NÃO IDENTIFICADO\nMencione alguém ou forneça um número!" }, { quoted: m });
                return;
            }

            const targetName = targetJid.split('@')[0];
            const targetMention = useMention ? `@${targetName}` : targetName;
            const msgAlvoEncontrado = `*ALVO ENCONTRADO🏹*\n\nO alvo ${targetMention} foi encontrado com sucesso! Aplicando expulsão...`;

            const msgAlvoOptions = useMention ? 
                { text: msgAlvoEncontrado, mentions: [targetJid] } : 
                { text: msgAlvoEncontrado };
            
            await sock.sendMessage(from, msgAlvoOptions, { quoted: m });

            // Executa o banimento real
            await sock.groupParticipantsUpdate(from, [targetJid], "remove");

            const msgMissao = `*ALVO REMOVIDO COM SUCESSO!🔥*\n\nO alvo ${targetMention} foi removido deste grupo por motivos justos.`;
            const msgMissaoOptions = useMention ? 
                { text: msgMissao, mentions: [targetJid] } : 
                { text: msgMissao };
            
            await sock.sendMessage(from, msgMissaoOptions, { quoted: m });

        } catch (error) {
            console.error("Erro ban:", error.message);
            await sock.sendMessage(from, { text: "💥 OPS! DEU ERRO\n\nErro ao executar comando ban." }, { quoted: m });
        }
    },
};
