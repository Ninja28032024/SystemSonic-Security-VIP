// CAMINHO: src/commands/brincadeiras/velha.js

const path = require("path");
const { jidNormalizedUser, generateWAMessageFromContent } = require("@systemzero/baileys");
const { isSameUser } = require(path.join(__dirname, '..', '..', 'utils.js'));
const {
    velhaGames,
    renderizarTabuleiro,
    encontrarJogoAtivoNoGrupo,
    escolherEmojiAleatorio
} = require(path.join(__dirname, '..', '..', 'lib', 'velha-state', 'velha-state.js'));

const desafioTimeouts = new Map();

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

module.exports = {
    name: "velha",
    aliases: ["jv"],

    async execute(sock, m, options) {
        const { from, sender, senderName, config, registerListener, removeListener } = options;

        try {
            if (!from.endsWith("@g.us")) {
                await sock.sendMessage(from, {
                    text: "❌ Este comando só pode ser usado em grupos.",
                    footer: "SYSTEM-SONIC - Jogo da Velha"
                }, { quoted: m });
                return;
            }

            const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

            if (mentions.length === 0) {
                if (encontrarJogoAtivoNoGrupo(from)) {
                    await sock.sendMessage(from, {
                        text: "⏳ Já existe um jogo em andamento neste grupo!",
                        footer: "SYSTEM-SONIC - Jogo da Velha"
                    }, { quoted: m });
                    return;
                }

                await sock.sendMessage(from, {
                    text: "*BOA! PARA INICIAR O JOGO DA VELHA MENCIONE ALGUÉM*\n\nAo mencionar alguém o jogo será iniciado, mencione quem deseja desafiar!",
                    footer: "SYSTEM-SONIC - Jogo da Velha"
                }, { quoted: m });

                const listenerId = `${from}_${sender}`;
                if (registerListener) {
                    registerListener(listenerId, async (novaMsg) => {
                        try {
                            const novasMencoes = novaMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                            if (novasMencoes.length === 0) return;
                            if (removeListener) removeListener(listenerId);

                            const targetJid  = novasMencoes[0];
                            const senderNorm = jidNormalizedUser(sender);

                            if (await isSameUser(targetJid, senderNorm, sock)) {
                                await sock.sendMessage(from, {
                                    text: "❌ Você não pode desafiar a si mesmo!",
                                    footer: "SYSTEM-SONIC - Jogo da Velha"
                                }, { quoted: novaMsg });
                                return;
                            }
                            if (encontrarJogoAtivoNoGrupo(from)) {
                                await sock.sendMessage(from, {
                                    text: "⏳ Já existe um jogo em andamento neste grupo!",
                                    footer: "SYSTEM-SONIC - Jogo da Velha"
                                }, { quoted: novaMsg });
                                return;
                            }

                            const targetName = novaMsg.message?.extendedTextMessage?.contextInfo?.pushName || targetJid.split('@')[0];
                            await iniciarJogo(sock, from, senderNorm, senderName, targetJid, targetName, config, novaMsg);
                        } catch (error) {
                            console.error('[VELHA] Erro ao processar menção:', error);
                        }
                    }, 300000);
                }
                return;
            }

            const targetJid  = mentions[0];
            const senderNorm = jidNormalizedUser(sender);

            if (await isSameUser(targetJid, senderNorm, sock)) {
                await sock.sendMessage(from, {
                    text: "❌ Você não pode desafiar a si mesmo!",
                    footer: "SYSTEM-SONIC - Jogo da Velha"
                }, { quoted: m });
                return;
            }
            if (encontrarJogoAtivoNoGrupo(from)) {
                await sock.sendMessage(from, {
                    text: "⏳ Já existe um jogo em andamento neste grupo!",
                    footer: "SYSTEM-SONIC - Jogo da Velha"
                }, { quoted: m });
                return;
            }

            const targetName = m.message?.extendedTextMessage?.contextInfo?.pushName || targetJid.split('@')[0];
            await iniciarJogo(sock, from, senderNorm, senderName, targetJid, targetName, config, m);

        } catch (error) {
            console.error('[VELHA] Erro execute:', error);
            await sock.sendMessage(from, { text: '❌ Erro ao iniciar o jogo.' }, { quoted: m });
        }
    },
};

async function iniciarJogo(sock, from, sender, senderName, targetJid, targetName, config, m) {
    const timestamp    = Date.now();
    const gameId       = `velha_${from}_${timestamp}`;
    const senderNumber = sender.split('@')[0];
    const targetNumber = targetJid.split('@')[0];
    const prefixo      = config?.prefix || '!';

    const jogo = {
        gameId,
        groupId: from,
        player1: { id: sender,    name: senderName, symbol: 'X', jid: sender    },
        player2: { id: targetJid, name: targetName,  symbol: 'O', jid: targetJid },
        board: [[null, null, null], [null, null, null], [null, null, null]],
        currentPlayer: 'player1',
        status: 'waiting',
        winner: null,
        moves: [],
        createdAt: Date.now(),
        timeout: 300000,
        type: 'multiplayer',
        transferLocked: false
    };

    velhaGames.set(gameId, jogo);

    const boardText = renderizarTabuleiro(jogo.board);

    await enviarInterativaComMencao(
        sock, from,
        `*DESAFIO DE JOGO DA VELHA* ${escolherEmojiAleatorio()}\n\n` +
        `${boardText}\n\n` +
        `@${senderNumber} desafiou @${targetNumber}!\n\n` +
        `@${targetNumber}, aceite ou recuse abaixo:\n\n` +
        `⏳ Tempo para aceitar: 5 minutos\n\n` +
        `💡 Para cancelar: ${prefixo}cancelarvelha`,
        "SYSTEM-SONIC - Jogo da Velha",
        [sender, targetJid],
        [
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "✅ Aceitar", id: `velha_aceitar_${gameId}` }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "❌ Recusar", id: `velha_recusar_${gameId}` }) }
        ],
        m
    );

    const timeoutId = setTimeout(() => {
        const jogoAtual = velhaGames.get(gameId);
        if (jogoAtual?.status === 'waiting') {
            velhaGames.delete(gameId);
            sock.sendMessage(from, {
                text: `⏰ O desafio de @${senderNumber} expirou! Ninguém aceitou a tempo.`,
                mentions: [sender],
                footer: "SYSTEM-SONIC - Jogo da Velha"
            }).catch(() => {});
        }
        desafioTimeouts.delete(gameId);
    }, 300000);

    desafioTimeouts.set(gameId, timeoutId);
}
