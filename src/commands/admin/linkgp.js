const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: "linkgp",
    aliases: ["link", "convite"],
    async execute(sock, m, options) {
        const { from, sender, config } = options;

        try {
            // Verificar se é um grupo
            if (!from.endsWith("@g.us")) {
                await sock.sendMessage(from, {
                    text: "❌ Este comando só pode ser usado em grupos."
                }, { quoted: m });
                return;
            }

            const groupMetadata = await sock.groupMetadata(from);
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            // Permite que o dono do bot ou um administrador do grupo use o comando
            if (!senderIsDono && !senderIsAdmin) {
                await sock.sendMessage(from, { text: "*ACESSO RESTRITO!*\nApenas um administrador do grupo ou o dono do bot pode usar este comando." }, { quoted: m });
                return;
            }

            // Gerar o link de convite do grupo
            const linkGrupo = await sock.groupInviteCode(from);

            if (!linkGrupo) {
                await sock.sendMessage(from, {
                    text: "❌ Não consegui gerar o link de convite do grupo.\n\nVerifique se o bot é administrador."
                }, { quoted: m });
                return;
            }

            // Construir a URL completa do link
            const urlCompleta = `https://chat.whatsapp.com/${linkGrupo}`;

            // Enviar a mensagem com o link
            const mensagem = `*AQUI ESTÁ O LINK DE CONVITE DESTE GRUPO🔗*\n\n${urlCompleta} é o link de convite deste grupo.`;

            await sock.sendMessage(from, {
                text: mensagem
            }, { quoted: m });

        } catch (error) {
            console.error("Erro linkgp:", error.message);
            await sock.sendMessage(from, {
                text: "💥 OPS! DEU ERRO\n\nErro ao executar comando linkgp."
            }, { quoted: m });
        }
    },
};
