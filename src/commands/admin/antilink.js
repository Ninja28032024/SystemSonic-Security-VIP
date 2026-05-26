const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const {
    definirEtapaSetup,
    limparSetup,
    obterConfiguracao,
    desativarAntilink,
    formatarResumoAntilink
} = require(path.join(__dirname, '..', '..', 'lib', 'antilink-state', 'antilink-state.js'));

module.exports = {
    name: "antilink",
    aliases: [],
    async execute(sock, m, options) {
        const { from, sender, config } = options;

        if (!from.endsWith("@g.us")) {
            await sock.sendMessage(from, {
                text: "❌ Este comando só pode ser acessado em grupos."
            }, { quoted: m });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsDono && !senderIsAdmin) {
                await sock.sendMessage(from, {
                    text: "*ACESSO RESTRITO!*\nApenas um administrador do grupo ou o dono do bot pode usar este comando."
                }, { quoted: m });
                return;
            }

            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
            if (!botIsAdmin) {
                await sock.sendMessage(from, {
                    text: "*Ops!* Não sou admin para iniciar este sistema. Certifique-se que eu esteja de admin e tente de novo!"
                }, { quoted: m });
                return;
            }

            const configuracaoAtual = obterConfiguracao(from);

            if (configuracaoAtual.ativo) {
                limparSetup(from);
                const configDesativada = desativarAntilink(from, sender);
                const resumoDesativado = formatarResumoAntilink(configDesativada);

                await sock.sendMessage(from, {
                    text: `*SYSTEM - SECURITY ANTILINK LEVELS*\nO sistema de antilink já estava ativo neste grupo e foi desativado com sucesso.\n\n${resumoDesativado}\n\n*Sistema de antilink desativado com sucesso!*`,
                    footer: "SYSTEM-SONIC - Security Antilink"
                }, { quoted: m });
                return;
            }

            limparSetup(from);
            definirEtapaSetup(from, sender, 'intro', { configuredBy: sender });

            const mensagem = `*SYSTEM - SECURITY ANTILINK LEVELS*\nEste é o sistema de antilinks, siga as intruções para saber como funciona e como ativar o sistema conforme suas preferências.\n\nPara ativar o sistema de antilink do seu jeito, siga as atapas lendo e clicando nos botões para deixar o sistema do seu jeito, você pode escolher se vai querer que o ban seja sem deletar a mensagem, deletando a mensagem, ou sem ban mas deletando a mensagem, ou se você quer o ban com advertências. OK? Clique em prosseguir se entendeu como funciona.`;

            await sock.sendMessage(from, {
                text: mensagem,
                footer: "SYSTEM-SONIC - Security Antilink",
                interactiveButtons: [
                    {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "Prosseguir",
                            id: "antilink_start"
                        })
                    }
                ]
            }, { quoted: m });
        } catch (error) {
            console.error("Erro antilink:", error.message);
            await sock.sendMessage(from, {
                text: "💥 OPS! DEU ERRO\n\nErro ao executar comando antilink."
            }, { quoted: m });
        }
    },
};
