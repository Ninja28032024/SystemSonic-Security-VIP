// src/commands/admin/config-adv.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { definirEtapa, limparEtapa } = require(path.join(__dirname, '..', '..', 'lib', 'adv-state', 'adv-state.js'));

module.exports = {
    name: "config-adv",
    aliases: ["configurar-adv", "cfg-adv"],
    async execute(sock, m, options) {
        const { from, sender, config } = options;

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

            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
            if (!botIsAdmin) {
                await sock.sendMessage(from, { text: "*Ops!* Não sou admin para usar este sistema. Certifique-se que eu esteja de admin e tente de novo!" }, { quoted: m });
                return;
            }

            limparEtapa(from, sender);
            definirEtapa(from, sender, 'apagar_msgs', {});

            await sock.sendMessage(from, {
                text: "*OK!* VAMOS CONFIGURAR O SISTEMA DE ADVERTÊNCIAS\nMe diga, ao advertir um membro do grupo, deseja que as mensagens que ele postar sejam apagadas?",
                footer: "SYSTEM-SONIC - Sistema de Advertências",
                interactiveButtons: [
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "SIM", id: "adv_apagar_sim" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "NÃO", id: "adv_apagar_nao" }) }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error("Erro config-adv:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando config-adv." }, { quoted: m });
        }
    }
};
