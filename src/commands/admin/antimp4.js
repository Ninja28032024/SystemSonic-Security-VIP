// src/commands/admin/antimp4.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { limparEtapaAntimp4, definirEtapaAntimp4, obterConfigAntimp4, desativarAntimp4 } = require(path.join(__dirname, '..', '..', 'lib', 'antimp4-state', 'antimp4-state.js'));

module.exports = {
    name: "antimp4",
    aliases: ["antivideo", "anti-mp4"],
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

            const configAtual = obterConfigAntimp4(from);

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

                const status = `*ANTI MP4 - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti MP4 em documento —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remoção:* ${modoRemocaoTexto}\n\nAnti MP4 - SystemSonic Security`;

                await sock.sendMessage(from, {
                    text: status,
                    footer: "SYSTEM-SONIC - Security Anti MP4",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "DESATIVAR", id: "antimp4_desativar" }) }
                    ]
                }, { quoted: m });
                return;
            }

            limparEtapaAntimp4(from, sender);
            definirEtapaAntimp4(from, sender, 'intro', { configuredBy: sender });

            await sock.sendMessage(from, {
                text: "*OK!* VAMOS CONFIGURAR O ANTI MP4\n\nEste sistema bloqueia o envio de arquivos MP4 em documento neste grupo.\n\nDeseja que o membro que postar o MP4 em documento seja removido?",
                footer: "SYSTEM-SONIC - Security Anti MP4",
                interactiveButtons: [
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "SIM", id: "antimp4_intro_sim" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "NÃO", id: "antimp4_intro_nao" }) }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error("Erro antimp4:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando antimp4." }, { quoted: m });
        }
    }
};
