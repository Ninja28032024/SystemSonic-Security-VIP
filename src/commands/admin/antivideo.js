// src/commands/admin/antivideo.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { limparEtapaAntivideo, definirEtapaAntivideo, obterConfigAntivideo, desativarAntivideo } = require(path.join(__dirname, '..', '..', 'lib', 'antivideo-state', 'antivideo-state.js'));

module.exports = {
    name: "antivideo",
    aliases: ["antivideos"],
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

            const configAtual = obterConfigAntivideo(from);

            if (configAtual && configAtual.ativo) {
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

                const status = `*ANTI VÍDEOS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti vídeos —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remoção:* ${modoRemocaoTexto}\n\nAnti vídeos - SystemSonic Security`;

                await sock.sendMessage(from, {
                    text: status,
                    footer: "SYSTEM-SONIC - Security Anti Vídeos",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "DESATIVAR", id: "antivideo_desativar" }) }
                    ]
                }, { quoted: m });
                return;
            }

            limparEtapaAntivideo(from, sender);
            definirEtapaAntivideo(from, sender, 'intro', { configuredBy: sender });

            await sock.sendMessage(from, {
                text: "*OK!* VAMOS CONFIGURAR O ANTI VÍDEOS\n\nDeseja que o membro que postar o vídeo seja removido?",
                footer: "SYSTEM-SONIC - Security Anti Vídeos",
                interactiveButtons: [
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "SIM", id: "antivideo_intro_sim" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "NÃO", id: "antivideo_intro_nao" }) }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error("Erro antivideo:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando antivideo." }, { quoted: m });
        }
    }
};
