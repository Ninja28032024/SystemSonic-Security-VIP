// src/commands/membros/consultelid.js
// Comando para consultar LID e número real (PN) do usuário

const path = require("path");
const { getLIDFromPN, getPNFromLID, isSameUser, extractNumber } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: "consultelid",
    aliases: ["lid", "minhalid", "getlid"],
    async execute(sock, m, options) {
        const { from, sender } = options;

        try {
            let targetJid = sender;
            const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            
            if (mentioned && mentioned.length > 0) {
                targetJid = mentioned[0];
            }

            let lidDisplay = null;
            let numeroTarget = null;

            if (targetJid.includes("@lid")) {
                lidDisplay = extractNumber(targetJid);
                const pnResolved = await getPNFromLID(targetJid, sock);
                numeroTarget = pnResolved ? extractNumber(pnResolved) : extractNumber(targetJid);
            } else {
                numeroTarget = extractNumber(targetJid);
                const lidResolved = await getLIDFromPN(targetJid, sock);
                lidDisplay = lidResolved ? extractNumber(lidResolved) : "Não disponível";
            }

            const isSelf = await isSameUser(targetJid, sender, sock);
            
            let texto = "";

            if (isSelf) {
                // Usando concatenação simples com crases para garantir o formato
                texto = "*AQUI ESTÁ A SUA LID*\n\n*Sua Lid:* " + lidDisplay + "@lid\n*Sua Jid:* " + numeroTarget + "\n\nSystemSonic - Security";
            } else {
                // Para outros: título com menção + campos em negrito
                // Importante: A menção (@numero) fica FORA dos asteriscos do título para não quebrar o markdown
                const titulo = "*AQUI ESTÁ A LID DO MEMBRO* @" + numeroTarget + "\n\n";
                const campo1 = "*Lid da pessoa:* " + lidDisplay + "@lid\n";
                const campo2 = "*Jid da pessoa:* " + numeroTarget + "\n\n";
                const rodape = "SystemSonic - Security";
                
                texto = titulo + campo1 + campo2 + rodape;
            }

            await sock.sendMessage(from, {
                text: texto,
                mentions: isSelf ? [] : [targetJid],
                footer: "SystemSonic - Security",
                interactiveButtons: [
                    {
                        name: "cta_copy",
                        buttonParamsJson: JSON.stringify({
                            display_text: "COPIAR LID",
                            id: "copy_lid_user",
                            copy_code: lidDisplay + "@lid"
                        })
                    }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error("[CONSULTELID] Erro:", error.message);
            await sock.sendMessage(from, {
                text: "❌ Não foi possível consultar a LID.",
                footer: "SystemSonic - Security"
            }, { quoted: m });
        }
    }
};