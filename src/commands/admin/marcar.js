// src/commands/admin/marcar.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: "marcar",
    aliases: ["mention", "tagall"],
    async execute(sock, m, options) {
        const { from, sender, args, config } = options;

        if (!from.endsWith("@g.us")) {
            await sock.sendMessage(from, { text: "Este comando só pode ser usado em grupos." }, { quoted: m });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsDono && !senderIsAdmin) {
                await sock.sendMessage(from, { text: "*ACESSO RESTRITO!*\nApenas um administrador do grupo ou o dono do bot pode usar este comando." }, { quoted: m });
                return;
            }

            const mensagemTexto = args.length > 0 ? args.join(" ") : "sem mensagem";

            const participantes = groupMetadata.participants.map(p => p.id);

            let lista = "";
            participantes.forEach((jid, index) => {
                lista += `${index + 1} - @${jid.split('@')[0]}\n`;
            });

            const mensagem = `*MARCANDO TODOS OS MEMBROS DESTE GRUPO*\n\n*Mensagem:* ${mensagemTexto}\n\n— Membros —\n${lista}\nMarcar - SystemSonic Security`;

            await sock.sendMessage(from, {
                text: mensagem,
                mentions: participantes
            }, { quoted: m });

        } catch (error) {
            console.error("Erro marcar:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando marcar." }, { quoted: m });
        }
    }
};
