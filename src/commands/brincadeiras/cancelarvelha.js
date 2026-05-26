// CAMINHO: src/commands/brincadeiras/cancelarvelha.js

const path = require("path");
const { velhaGames, encontrarJogoAtivoNoGrupo } = require(path.join(__dirname, '..', '..', 'lib', 'velha-state', 'velha-state.js'));
const { isSameUser } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: "cancelarvelha",
    aliases: ["cancelar_velha", "parar_velha"],

    async execute(sock, m, options) {
        const { from, sender, config } = options;

        if (!from.endsWith("@g.us")) {
            await sock.sendMessage(from, { text: "❌ Este comando só pode ser acessado em grupos." }, { quoted: m });
            return;
        }

        try {
            // ── Busca usando a mesma função do velha.js (groupId === from) ──────
            const jogo = encontrarJogoAtivoNoGrupo(from);

            if (!jogo) {
                await sock.sendMessage(from, { text: "❌ Não há nenhum jogo da velha ativo neste grupo!" }, { quoted: m });
                return;
            }

            // ── Verifica se quem cancela é um dos jogadores (tolerante a LID/PN) ─
            const isPlayer1 = await isSameUser(sender, jogo.player1.jid, sock);
            const isPlayer2 = await isSameUser(sender, jogo.player2.jid, sock);

            if (!isPlayer1 && !isPlayer2) {
                await sock.sendMessage(from, { text: "❌ Apenas os jogadores podem cancelar o jogo!" }, { quoted: m });
                return;
            }

            velhaGames.delete(jogo.gameId);

            const prefixoAtual = config.prefix || "/";
            await sock.sendMessage(from, {
                text:
                    `*O JOGO DA VELHA FOI CANCELADO!* 🎳\n\n` +
                    `${jogo.player1.name} vs ${jogo.player2.name}\n\n` +
                    `Para voltar a jogar use ${prefixoAtual}velha @marcar`,
                mentions: [jogo.player1.jid, jogo.player2.jid]
            }, { quoted: m });

        } catch (error) {
            console.error("Erro ao cancelar jogo:", error.message);
            await sock.sendMessage(from, { text: "❌ Erro ao cancelar o jogo!" }, { quoted: m });
        }
    },
};
