// src/commands/admin/stts-antidoc.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { obterConfigAntidoc } = require(path.join(__dirname, '..', '..', 'lib', 'antidoc-state', 'antidoc-state.js'));

module.exports = {
    name: "stts-antidoc",
    aliases: ["status-antidoc"],
    async execute(sock, m, options) {
        const { from, sender, config } = options;

        if (!from.endsWith("@g.us")) {
            await sock.sendMessage(from, { text: "Este comando so pode ser usado em grupos." }, { quoted: m });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsDono && !senderIsAdmin) {
                await sock.sendMessage(from, { text: "*Ops!* Voce nao e dono e nem administrador do grupo, se ponha no seu lugar." }, { quoted: m });
                return;
            }

            const configAtual = obterConfigAntidoc(from);

            if (!configAtual || !configAtual.ativo) {
                await sock.sendMessage(from, {
                    text: "*STATUS ANTI DOCUMENTOS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti documentos —\n*Status:* DESATIVADO\n\nAnti documentos - SystemSonic Security",
                    footer: "SYSTEM-SONIC - Security Anti Documentos"
                }, { quoted: m });
                return;
            }

            const deletarMsg = configAtual.deletarMidia ? "SIM" : "NAO";
            const removerMembro = configAtual.removerMembro ? "SIM" : "NAO";

            let modoRemocaoTexto = "";
            if (!configAtual.removerMembro) {
                modoRemocaoTexto = "Nao se aplica";
            } else if (configAtual.modoRemocao === 'imediato') {
                modoRemocaoTexto = "Imediato";
            } else {
                const plural = configAtual.qtdAdvertencias > 1 ? "advertencias" : "advertencia";
                modoRemocaoTexto = `${configAtual.qtdAdvertencias} ${plural}`;
            }

            const mensagem = `*STATUS ANTI DOCUMENTOS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti documentos —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remocao:* ${modoRemocaoTexto}\n\nAnti documentos - SystemSonic Security`;

            await sock.sendMessage(from, {
                text: mensagem,
                footer: "SYSTEM-SONIC - Security Anti Documentos"
            }, { quoted: m });

        } catch (error) {
            console.error("Erro stts-antidoc:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando stts-antidoc." }, { quoted: m });
        }
    }
};
