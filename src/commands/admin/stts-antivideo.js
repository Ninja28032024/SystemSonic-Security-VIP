// src/commands/admin/stts-antivideo.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { obterConfigAntivideo } = require(path.join(__dirname, '..', '..', 'lib', 'antivideo-state', 'antivideo-state.js'));

module.exports = {
    name: "stts-antivideo",
    aliases: ["status-antivideo"],
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

            const configAtual = obterConfigAntivideo(from);

            if (!configAtual || !configAtual.ativo) {
                await sock.sendMessage(from, {
                    text: "*STATUS ANTI VÍDEOS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti vídeos —\n*Status:* DESATIVADO\n\nAnti vídeos - SystemSonic Security",
                    footer: "SYSTEM-SONIC - Security Anti Vídeos"
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

            const mensagem = `*STATUS ANTI VÍDEOS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti vídeos —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remoção:* ${modoRemocaoTexto}\n\nAnti vídeos - SystemSonic Security`;

            await sock.sendMessage(from, {
                text: mensagem,
                footer: "SYSTEM-SONIC - Security Anti Vídeos"
            }, { quoted: m });

        } catch (error) {
            console.error("Erro stts-antivideo:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando stts-antivideo." }, { quoted: m });
        }
    }
};
