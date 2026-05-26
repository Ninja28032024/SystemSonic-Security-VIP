// src/commands/admin/stts-antiimg.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { obterConfiguracao } = require(path.join(__dirname, '..', '..', 'lib', 'antiimg-state', 'antiimg-state.js'));

module.exports = {
    name: "stts-antiimg",
    aliases: ["status-antiimg", "stts-antiimagem"],
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

            const configAtual = obterConfiguracao(from);

            if (!configAtual || !configAtual.ativo) {
                await sock.sendMessage(from, {
                    text: "*STATUS ANTI IMAGENS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti imagens —\n*Status:* DESATIVADO\n\nAnti Imagens - SystemSonic Security",
                    footer: "SYSTEM-SONIC - Security Anti Imagens"
                }, { quoted: m });
                return;
            }

            const deletarMsg = configAtual.deleteImage ? "SIM" : "NÃO";
            const removerMembro = configAtual.removeParticipant ? "SIM" : "NÃO";

            let modoRemocaoTexto = "";
            if (!configAtual.removeParticipant) {
                modoRemocaoTexto = "Não se aplica";
            } else if (configAtual.removeImmediately) {
                modoRemocaoTexto = "Imediato";
            } else {
                const plural = configAtual.warningLimit > 1 ? "advertências" : "advertência";
                modoRemocaoTexto = `${configAtual.warningLimit} ${plural}`;
            }

            const mensagem = `*STATUS ANTI IMAGENS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti imagens —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remoção:* ${modoRemocaoTexto}\n\nAnti Imagens - SystemSonic Security`;

            await sock.sendMessage(from, {
                text: mensagem,
                footer: "SYSTEM-SONIC - Security Anti Imagens"
            }, { quoted: m });

        } catch (error) {
            console.error("Erro stts-antiimg:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando stts-antiimg." }, { quoted: m });
        }
    }
};
