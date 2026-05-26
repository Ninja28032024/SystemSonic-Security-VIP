// src/commands/admin/antidoc.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { limparEtapaAntidoc, definirEtapaAntidoc, obterConfigAntidoc, desativarAntidoc } = require(path.join(__dirname, '..', '..', 'lib', 'antidoc-state', 'antidoc-state.js'));

module.exports = {
    name: "antidoc",
    aliases: ["antidocumento"],
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

            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
            if (!botIsAdmin) {
                await sock.sendMessage(from, { text: "*Ops!* Não sou admin para iniciar este sistema. Certifique-se que eu esteja de admin e tente de novo!" }, { quoted: m });
                return;
            }

            const configAtual = obterConfigAntidoc(from);

            if (configAtual && configAtual.ativo) {
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

                const status = `*ANTI DOCUMENTOS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti documentos —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remocao:* ${modoRemocaoTexto}\n\nAnti documentos - SystemSonic Security`;

                await sock.sendMessage(from, {
                    text: status,
                    footer: "SYSTEM-SONIC - Security Anti Documentos",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "DESATIVAR", id: "antidoc_desativar" }) }
                    ]
                }, { quoted: m });
                return;
            }

            limparEtapaAntidoc(from, sender);
            definirEtapaAntidoc(from, sender, 'intro', { configuredBy: sender });

            await sock.sendMessage(from, {
                text: "*OK!* VAMOS CONFIGURAR O ANTI DOCUMENTOS\n\nDeseja que o membro que postar o documento seja removido?",
                footer: "SYSTEM-SONIC - Security Anti Documentos",
                interactiveButtons: [
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "SIM", id: "antidoc_intro_sim" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "NAO", id: "antidoc_intro_nao" }) }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error("Erro antidoc:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando antidoc." }, { quoted: m });
        }
    }
};
