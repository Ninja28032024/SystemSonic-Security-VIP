// src/commands/admin/antiaudio.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { limparEtapaAntiaudio, definirEtapaAntiaudio, obterConfigAntiaudio, desativarAntiaudio } = require(path.join(__dirname, '..', '..', 'lib', 'antiaudio-state', 'antiaudio-state.js'));

module.exports = {
    name: "antiaudio",
    aliases: ["antiaudio"],
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

            const configAtual = obterConfigAntiaudio(from);

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

                const status = `*ANTI ÁUDIOS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti áudios —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remoção:* ${modoRemocaoTexto}\n\nAnti áudios - SystemSonic Security`;

                await sock.sendMessage(from, {
                    text: status,
                    footer: "SYSTEM-SONIC - Security Anti Áudios",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "DESATIVAR", id: "antiaudio_desativar" }) }
                    ]
                }, { quoted: m });
                return;
            }

            limparEtapaAntiaudio(from, sender);
            definirEtapaAntiaudio(from, sender, 'intro', { configuredBy: sender });

            await sock.sendMessage(from, {
                text: "*OK!* VAMOS CONFIGURAR O ANTI ÁUDIOS\n\nDeseja que o membro que postar o áudio seja removido?",
                footer: "SYSTEM-SONIC - Security Anti Áudios",
                interactiveButtons: [
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "SIM", id: "antiaudio_intro_sim" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "NÃO", id: "antiaudio_intro_nao" }) }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error("Erro antiaudio:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando antiaudio." }, { quoted: m });
        }
    }
};
