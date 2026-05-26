// src/commands/admin/adv.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { advertirMembro, obterConfigAdv, removerAdvertencias } = require(path.join(__dirname, '..', '..', 'lib', 'adv-state', 'adv-state.js'));

module.exports = {
    name: "adv",
    aliases: ["advertir"],
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
                await sock.sendMessage(from, { text: "*ACESSO RESTRITO!*\nApenas um administrador do grupo ou o dono do bot pode usar este comando." }, { quoted: m });
                return;
            }

            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
            if (!botIsAdmin) {
                await sock.sendMessage(from, { text: "*Ops!* Não sou admin para usar este sistema. Certifique-se que eu esteja de admin e tente de novo!" }, { quoted: m });
                return;
            }

            const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length === 0) {
                await sock.sendMessage(from, { text: "❓ Mencione um membro para adverti-lo!\n\nExemplo: !adv @membro" }, { quoted: m });
                return;
            }

            const targetJid = mentions[0];
            const targetName = `@${targetJid.split('@')[0]}`;

            const targetIsAdmin = await isUserAdmin(targetJid, groupMetadata, sock);
            if (targetIsAdmin && !senderIsDono) {
                await sock.sendMessage(from, { text: "*Ops!* Não posso advertir um administrador do grupo." }, { quoted: m });
                return;
            }

            const configAdv = obterConfigAdv(from);
            const limite = configAdv ? configAdv.limiteAdvertencias : null;

            const qtdAtual = advertirMembro(from, targetJid);
            const plural = qtdAtual > 1 ? "advertências" : "advertência";
            const limiteTexto = limite ? `/${limite}` : '';

            const mensagem = `*MEMBRO ${targetName} ADVERTIDO*\n${targetName} você levou ${qtdAtual}${limiteTexto} ${plural}, cuidado, você pode ser automaticamente removido caso atinja o limite de advertências permitidas.`;

            await sock.sendMessage(from, {
                text: mensagem,
                mentions: [targetJid]
            }, { quoted: m });

            // Iniciar timer de apagar mensagens se configurado
            if (configAdv && configAdv.apagarMensagens && configAdv.tempoApagarMs) {
                try {
                    const { iniciarTimerApagar } = require(path.join(__dirname, '..', '..', 'listeners', 'listeners-adv-enforcer.js'));
                    iniciarTimerApagar(from, targetJid, configAdv.tempoApagarMs);
                } catch (e) {
                    console.error("[ADV] Erro ao iniciar timer:", e.message);
                }
            }

            // Verificar se atingiu o limite para remover
            if (limite && qtdAtual >= limite) {
                try {
                    await sock.groupParticipantsUpdate(from, [targetJid], "remove");
                    // Limpar advertências ao remover
                    removerAdvertencias(from, targetJid, qtdAtual);
                    await sock.sendMessage(from, {
                        text: `*LIMITE DE ADVERTÊNCIAS ATINGIDO*\n${targetName} foi removido do grupo por atingir o limite de ${limite} advertências.\n\nAs advertências foram resetadas.`,
                        mentions: [targetJid]
                    });
                } catch (e) {
                    console.error("[ADV] Erro ao remover membro:", e.message);
                }
            }

        } catch (error) {
            console.error("Erro adv:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando adv." }, { quoted: m });
        }
    }
};
