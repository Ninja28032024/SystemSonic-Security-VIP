// src/commands/admin/stts-antiaudio.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { obterConfigAntiaudio } = require(path.join(__dirname, '..', '..', 'lib', 'antiaudio-state', 'antiaudio-state.js'));

module.exports = {
    name: "stts-antiaudio",
    aliases: ["status-antiaudio"],
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
                await sock.sendMessage(from, { text: "*Ops!* Você não é dono e nem administrador do grupo, se ponha no seu lugar." }, { quoted: m });
                return;
            }

            const configAtual = obterConfigAntiaudio(from);

            if (!configAtual || !configAtual.ativo) {
                await sock.sendMessage(from, {
                    text: "*STATUS ANTI ÁUDIOS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti áudios —\n*Status:* DESATIVADO\n\nAnti áudios - SystemSonic Security",
                    footer: "SYSTEM-SONIC - Security Anti Áudios"
                }, { quoted: m });
                return;
            }

            const deletarMsg = configAtual.deletarMidia ? "SIM" : "NÃO";
            const removerMembro = configAtual.removerMembro ? "SIM" : "NÃO";

            let modoRemocaoTexto = "";
            if (!configAtual.removerMembro) {
                modoRemocaoTexto = "Não se aplica";
            } else if (configAtual.modoRemocao === 'imediato') {
                modoRemocaoTexto = "Imediato";
            } else {
                const plural = configAtual.qtdAdvertencias > 1 ? "advertências" : "advertência";
                modoRemocaoTexto = `${configAtual.qtdAdvertencias} ${plural}`;
            }

            const mensagem = `*STATUS ANTI ÁUDIOS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti áudios —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remoção:* ${modoRemocaoTexto}\n\nAnti áudios - SystemSonic Security`;

            await sock.sendMessage(from, {
                text: mensagem,
                footer: "SYSTEM-SONIC - Security Anti Áudios"
            }, { quoted: m });

        } catch (error) {
            console.error("Erro stts-antiaudio:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando stts-antiaudio." }, { quoted: m });
        }
    }
};
