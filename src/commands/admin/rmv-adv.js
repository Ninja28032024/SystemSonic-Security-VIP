// src/commands/admin/rmv-adv.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { obterMembroAdv, removerAdvertencias, definirEtapa, limparEtapa } = require(path.join(__dirname, '..', '..', 'lib', 'adv-state', 'adv-state.js'));

module.exports = {
    name: "rmv-adv",
    aliases: ["remover-adv", "rmadv"],
    async execute(sock, m, options) {
        const { from, sender, config, registerListener, removeListener } = options;

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

            limparEtapa(from, sender);
            definirEtapa(from, sender, 'aguardar_mencao_rmv', {});

            await sock.sendMessage(from, {
                text: "*MARQUE A PESSOA QUE DESEJA REMOVER A ADVERTÊNCIA*",
                footer: "SYSTEM-SONIC - Sistema de Advertências"
            }, { quoted: m });

        } catch (error) {
            console.error("Erro rmv-adv:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando rmv-adv." }, { quoted: m });
        }
    }
};
