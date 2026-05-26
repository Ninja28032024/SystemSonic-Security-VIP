// CAMINHO: src/listeners/listeners-velha.js

const path = require("path");
const { generateWAMessageFromContent } = require("@systemzero/baileys");
const { isSameUser } = require(path.join(__dirname, '..', 'utils.js'));

const processedMessages = new Set();
function isMessageAlreadyProcessed(messageId) {
    if (processedMessages.has(messageId)) return true;
    processedMessages.add(messageId);
    setTimeout(() => processedMessages.delete(messageId), 3000);
    return false;
}

const {
    velhaGames,
    renderizarTabuleiro,
    verificarVencedor,
    verificarEmpate,
    fazerMovimento,
    escolherEmojiAleatorio
} = require(path.join(__dirname, '..', 'lib', 'velha-state', 'velha-state.js'));

function extrairButtonId(m) {
    if (m.message?.templateButtonReplyMessage?.selectedId)
        return m.message.templateButtonReplyMessage.selectedId;
    if (m.message?.buttonsResponseMessage?.selectedButtonId)
        return m.message.buttonsResponseMessage.selectedButtonId;
    if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
        try {
            const params = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
            return params.id || null;
        } catch (_) { return null; }
    }
    return null;
}

async function enviarInterativaComMencao(sock, from, texto, footer, mencoes, botoes, quotedMsg) {
    const msg = generateWAMessageFromContent(from, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    header: { hasMediaAttachment: false },
                    body: { text: texto },
                    footer: { text: footer },
                    contextInfo: { mentionedJid: mencoes },
                    nativeFlowMessage: { buttons: botoes }
                }
            }
        }
    }, { quoted: quotedMsg });
    await sock.relayMessage(from, msg.message, { messageId: msg.key.id });
}

async function listenerVelha(sock, m, from, sender, options = {}) {
    if (isMessageAlreadyProcessed(m.key.id)) return false;

    const buttonId = extrairButtonId(m);
    if (!buttonId || !buttonId.startsWith("velha_")) return false;

    const senderReal = m.key.participant || sender;
    const parts      = buttonId.split("_");
    const action     = parts[1];

    let gameId;
    let subAction = null;

    if (action === 'jogada') {
        gameId = parts.slice(2, -1).join("_");
    } else if (action === 'transferir') {
        subAction = parts[2];
        gameId    = parts.slice(3, 6).join("_");
    } else {
        gameId = parts.slice(2).join("_");
    }

    const jogo = velhaGames.get(gameId);
    if (!jogo) return true;

    const m1 = `@${jogo.player1.jid.split('@')[0]}`;
    const m2 = `@${jogo.player2.jid.split('@')[0]}`;

    // ── ACEITAR ───────────────────────────────────────────────────────────────
    if (action === "aceitar") {
        const ehPlayer2 = await isSameUser(senderReal, jogo.player2.jid, sock);

        if (!ehPlayer2) {
            const mNovo = `@${senderReal.split('@')[0]}`;
            await enviarInterativaComMencao(
                sock, from,
                `*SOLICITAÇÃO DE TRANSFERÊNCIA DO GAME!🎭*\n\n` +
                `${m1}, ${mNovo} está pedindo para entrar no game.\n` +
                `Deseja transferir o game para ${mNovo}?`,
                "SYSTEM-SONIC - Transferência de Jogo",
                [jogo.player1.jid, senderReal],
                [
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "✅ Sim, Transferir", id: `velha_transferir_sim_${gameId}_${senderReal}` }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "❌ Não Transferir",  id: `velha_transferir_nao_${gameId}` }) }
                ],
                m
            );
            return true;
        }

        if (jogo.status === "active") {
            await sock.sendMessage(from, { text: "*Ops!* O jogo já está em andamento." }, { quoted: m });
            return true;
        }

        jogo.status = "active";
        velhaGames.set(gameId, jogo);

        const botoes = [];
        for (let i = 1; i <= 9; i++) {
            botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `${i}`, id: `velha_jogada_${gameId}_${i}` }) });
        }

        await enviarInterativaComMencao(
            sock, from,
            `*JOGO DA VELHA* ${escolherEmojiAleatorio()}\n\n` +
            `${renderizarTabuleiro(jogo.board)}\n\n` +
            `❌ ${m1}\n⭕ ${m2}\n\n` +
            `*Turno:* ${m1}\n\nClique no número da posição para jogar:`,
            "SYSTEM-SONIC - Jogo da Velha",
            [jogo.player1.jid, jogo.player2.jid],
            botoes, m
        );
        return true;
    }

    // ── RECUSAR ───────────────────────────────────────────────────────────────
    if (action === "recusar") {
        const ehPlayer1 = await isSameUser(senderReal, jogo.player1.jid, sock);
        const ehPlayer2 = await isSameUser(senderReal, jogo.player2.jid, sock);

        if (ehPlayer1 || ehPlayer2) {
            velhaGames.delete(gameId);
            await sock.sendMessage(from, {
                text: `*DESAFIO RECUSADO!* ${escolherEmojiAleatorio()}\n\n${m2} recusou o desafio de ${m1}!`,
                mentions: [jogo.player1.jid, jogo.player2.jid]
            }, { quoted: m });
        }
        return true;
    }

    // ── TRANSFERIR SIM ────────────────────────────────────────────────────────
    if (action === "transferir" && subAction === "sim") {
        const ehPlayer1 = await isSameUser(senderReal, jogo.player1.jid, sock);
        if (!ehPlayer1) {
            await sock.sendMessage(from, { text: "❌ Apenas o desafiante pode aceitar a transferência!" }, { quoted: m });
            return true;
        }

        const novoJid = parts[parts.length - 1];
        jogo.player2 = { id: novoJid, name: novoJid.split('@')[0], symbol: 'O', jid: novoJid };
        jogo.status        = "active";
        jogo.currentPlayer = 'player1';
        velhaGames.set(gameId, jogo);

        const m2novo = `@${jogo.player2.jid.split('@')[0]}`;
        const botoes = [];
        for (let i = 1; i <= 9; i++) {
            botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `${i}`, id: `velha_jogada_${gameId}_${i}` }) });
        }

        await enviarInterativaComMencao(
            sock, from,
            `*JOGO DA VELHA* ${escolherEmojiAleatorio()}\n\n` +
            `${renderizarTabuleiro(jogo.board)}\n\n` +
            `❌ ${m1}\n⭕ ${m2novo}\n\n` +
            `*Turno:* ${m1}\n\nClique no número da posição para jogar:`,
            "SYSTEM-SONIC - Jogo da Velha",
            [jogo.player1.jid, jogo.player2.jid],
            botoes, m
        );
        return true;
    }

    // ── TRANSFERIR NÃO ────────────────────────────────────────────────────────
    if (action === "transferir" && subAction === "nao") {
        const ehPlayer1 = await isSameUser(senderReal, jogo.player1.jid, sock);
        if (!ehPlayer1) {
            await sock.sendMessage(from, { text: "❌ Apenas o desafiante pode rejeitar a transferência!" }, { quoted: m });
            return true;
        }

        await sock.sendMessage(from, {
            text:
                `❌ *TRANSFERÊNCIA REJEITADA!*\n\n` +
                `${m1} rejeitou a transferência.\n` +
                `O desafio continua com ${m2}.`,
            mentions: [jogo.player1.jid, jogo.player2.jid]
        }, { quoted: m });
        return true;
    }

    // ── JOGADA ────────────────────────────────────────────────────────────────
    if (action === "jogada") {
        if (jogo.status !== "active") return true;

        const currentPlayer = jogo.currentPlayer === 'player1' ? jogo.player1 : jogo.player2;
        const ehVezDele     = await isSameUser(senderReal, currentPlayer.jid, sock);

        if (!ehVezDele) {
            await sock.sendMessage(from, { text: "❌ Não é sua vez de jogar!" }, { quoted: m });
            return true;
        }

        const posicao = parseInt(parts[parts.length - 1]);
        if (!fazerMovimento(jogo.board, posicao, currentPlayer.symbol)) {
            await sock.sendMessage(from, { text: "❌ Posição inválida ou já ocupada!" }, { quoted: m });
            return true;
        }

        const vencedor = verificarVencedor(jogo.board);
        if (vencedor) {
            const jogVencedor = vencedor === 'X' ? jogo.player1 : jogo.player2;
            const mVenc = `@${jogVencedor.jid.split('@')[0]}`;
            velhaGames.delete(gameId);
            await sock.sendMessage(from, {
                text:
                    `*JOGO FINALIZADO!* ${escolherEmojiAleatorio()}\n\n` +
                    `${renderizarTabuleiro(jogo.board)}\n\n` +
                    `🏆 ${mVenc} venceu!`,
                mentions: [jogo.player1.jid, jogo.player2.jid]
            }, { quoted: m });
            return true;
        }

        if (verificarEmpate(jogo.board)) {
            velhaGames.delete(gameId);
            await sock.sendMessage(from, {
                text:
                    `*JOGO FINALIZADO!* ${escolherEmojiAleatorio()}\n\n` +
                    `${renderizarTabuleiro(jogo.board)}\n\n` +
                    `✨ Empate! Nenhum vencedor.`,
                mentions: [jogo.player1.jid, jogo.player2.jid]
            }, { quoted: m });
            return true;
        }

        jogo.currentPlayer = jogo.currentPlayer === 'player1' ? 'player2' : 'player1';
        const proximo      = jogo.currentPlayer === 'player1' ? jogo.player1 : jogo.player2;
        const mProximo     = `@${proximo.jid.split('@')[0]}`;

        const botoesDisponiveis = [];
        for (let i = 1; i <= 9; i++) {
            const linha  = Math.floor((i - 1) / 3);
            const coluna = (i - 1) % 3;
            if (jogo.board[linha][coluna] === null) {
                botoesDisponiveis.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `${i}`, id: `velha_jogada_${gameId}_${i}` }) });
            }
        }

        await enviarInterativaComMencao(
            sock, from,
            `*JOGO DA VELHA* ${escolherEmojiAleatorio()}\n\n` +
            `${renderizarTabuleiro(jogo.board)}\n\n` +
            `🎯 Vez de: ${mProximo}\n\nClique no número da posição para jogar:`,
            "SYSTEM-SONIC - Jogo da Velha",
            [jogo.player1.jid, jogo.player2.jid],
            botoesDisponiveis, m
        );
        return true;
    }

    return false;
}

module.exports = listenerVelha;
