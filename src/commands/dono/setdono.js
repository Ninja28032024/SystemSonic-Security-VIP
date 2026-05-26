// src/commands/dono/setdono.js
// Comando para transferir (ou recuperar) o acesso de dono do Bot.

const path   = require('path');
const { obterConfig, saveConfig } = require(path.join(__dirname, '..', '..', '..', 'settings', 'config.js'));
const { isOwner, getLIDFromPN, resolveToJID } = require(path.join(__dirname, '..', '..', 'utils.js'));
const {
    registrarTransferencia,
    obterRegistroPorPn,
    validarToken,
    removerRegistro,
} = require(path.join(__dirname, '..', '..', 'lib', 'dono-transfer-state', 'dono-transfer-state.js'));

// ────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────

/** Extrai número puro de qualquer JID */
function extrairNumero(jid) {
    return jid.split('@')[0].split(':')[0];
}

/**
 * Formata um timestamp ISO para exibição amigável.
 * Retorna { dia, mes, hora } onde hora já inclui milissegundos.
 */
function formatarData(iso) {
    const d = new Date(iso);

    const pad = (n, s = 2) => String(n).padStart(s, '0');

    const dia  = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const mes  = pad(d.getMonth() + 1);
    const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;

    return { dia, mes, hora, diaNum: pad(d.getDate()) };
}

// ────────────────────────────────────────────────
//  Extração de ID de botão (mesmo padrão do bot)
// ────────────────────────────────────────────────

/**
 * Extrai o id do botão clicado ou o texto digitado.
 * Segue exatamente o padrão de listeners-correcao-button.js do bot.
 */
function extrairRespostaMsg(msg) {
    // Botão template
    if (msg?.message?.templateButtonReplyMessage?.selectedId) {
        return msg.message.templateButtonReplyMessage.selectedId;
    }
    // Botão simples
    if (msg?.message?.buttonsResponseMessage?.selectedButtonId) {
        return msg.message.buttonsResponseMessage.selectedButtonId;
    }
    // Botão interativo (quick_reply / cta_*)
    if (msg?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
        try {
            const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
            return params.id || params.display_text || null;
        } catch (_) {}
    }
    // Texto digitado manualmente
    return (
        msg?.message?.conversation ||
        msg?.message?.extendedTextMessage?.text ||
        null
    );
}

// ────────────────────────────────────────────────
//  Estados em memória (aguardando digitação)
// ────────────────────────────────────────────────
// Mapa: listenerId → { etapa: 'aguardando_numero' | 'aguardando_token' }
const estadosPendentes = new Map();

// ────────────────────────────────────────────────
//  Módulo
// ────────────────────────────────────────────────

module.exports = {
    name: 'setdono',
    aliases: [],

    async execute(sock, m, options) {
        const { from, sender, registerListener, removeListener } = options;

        // Lê config fresco a cada execução
        const config = obterConfig();

        const senderPn  = extrairNumero(sender);
        const ownerPn   = extrairNumero(config.ownerNumber || '');
        const isDono    = await isOwner(sender, config.ownerNumber, sock);

        // ── Caso 1: É o dono atual ──────────────────────────────────────────
        if (isDono) {
            await sock.sendMessage(from, {
                text: '*Deseja passar o dono para outra pessoa?*',
                footer: 'SYSTEM-SONIC - Transferência de Dono',
                interactiveButtons: [
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'SIM', id: 'setdono_sim' }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'NÃO', id: 'setdono_nao' }) },
                ],
            }, { quoted: m });

            const listenerId = `${from}_${sender}`;
            estadosPendentes.set(listenerId, { etapa: 'aguardando_confirmacao_dono' });

            registerListener(listenerId, async (msg) => {
                removeListener(listenerId);
                estadosPendentes.delete(listenerId);

                const idBotao = (extrairRespostaMsg(msg) || '').trim().toLowerCase();

                // Resposta NÃO
                if (idBotao === 'setdono_nao' || idBotao === 'não' || idBotao === 'nao' || idBotao === 'n') {
                    await sock.sendMessage(from, {
                        text: 'Ok! Você continua sendo o dono do Bot.',
                        footer: 'SYSTEM-SONIC - Transferência de Dono',
                    }, { quoted: msg });
                    return;
                }

                // Resposta SIM
                if (idBotao === 'setdono_sim' || idBotao === 'sim' || idBotao === 's') {
                    await sock.sendMessage(from, {
                        text: '*OK!* ME DIGA O SEGUINTE\nPara que número deseja que eu altere o dono no config.json?',
                        footer: 'SYSTEM-SONIC - Transferência de Dono',
                    }, { quoted: msg });

                    const lidId2 = `${from}_${sender}`;
                    estadosPendentes.set(lidId2, { etapa: 'aguardando_numero' });

                    registerListener(lidId2, async (msg2) => {
                        removeListener(lidId2);
                        estadosPendentes.delete(lidId2);

                        const novoNumero = (
                            msg2?.message?.conversation ||
                            msg2?.message?.extendedTextMessage?.text ||
                            ''
                        ).trim();

                        if (!novoNumero || !/^\d+$/.test(novoNumero)) {
                            await sock.sendMessage(from, {
                                text: '❌ Número inválido. Use apenas dígitos (ex: 5511999...).',
                                footer: 'SYSTEM-SONIC - Transferência de Dono',
                            }, { quoted: msg2 });
                            return;
                        }

                        // Obtém LID do ex-dono se possível
                        let anteriorLid = null;
                        try {
                            anteriorLid = await getLIDFromPN(sender, sock);
                        } catch (_) {}

                        // Registra transferência e gera token
                        const { token, dataHora } = registrarTransferencia(senderPn, anteriorLid, novoNumero);

                        // Atualiza config.json com o número exato digitado
                        const configAtual = obterConfig();
                        configAtual.ownerNumber = novoNumero;
                        saveConfig(configAtual);

                        // Mensagem no chat
                        await sock.sendMessage(from, {
                            text:
                                '*PERFEITO!* O NÚMERO DE DONO FOI ALTERADO COM SUCESSO!\n' +
                                'Foi enviado no seu privado um token de acesso, que servirá como senha para caso você deseje alterar seu número para dono novamente. ' +
                                '∆ Lembre-se, não dê acesso a dono a terceiro no qual você não conhece e não confia.',
                            footer: 'SYSTEM-SONIC - Transferência de Dono',
                        }, { quoted: msg2 });

                        // Formata data/hora para a mensagem privada
                        const dt = formatarData(dataHora);

                        // Monta a mensagem privada com o token e botão de copiar
                        // resolveToJID converte LID → PN corretamente se necessário
                        const privadoJid = await resolveToJID(sender, sock);
                        await sock.sendMessage(privadoJid, {
                            text:
                                `*🔐 TOKEN DE RECUPERAÇÃO DE DONO*\n\n` +
                                `Você transferiu o acesso de dono para *${novoNumero}* em *${dt.dia}* às *${dt.hora}*.\n\n` +
                                `Guarde este token com segurança — ele é sua senha para recuperar o acesso de dono:\n\n` +
                                `\`\`\`${token}\`\`\`\n\n` +
                                `∆ Não compartilhe este token com ninguém!`,
                            footer: 'SYSTEM-SONIC - Token de Recuperação',
                            interactiveButtons: [
                                {
                                    name: 'cta_copy',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: 'Copiar Token',
                                        copy_code: token,
                                    }),
                                },
                            ],
                        });
                    }, 120000); // 2 min para digitar o número
                    return;
                }

                // Resposta inválida
                await sock.sendMessage(from, {
                    text: '❌ Resposta não reconhecida. Use os botões ou digite SIM / NÃO.',
                    footer: 'SYSTEM-SONIC - Transferência de Dono',
                }, { quoted: msg });
            }, 60000); // 1 min para responder sim/não

            return;
        }

        // ── Caso 2: Não é dono, mas já foi dono antes (está no histórico) ──
        const registro = obterRegistroPorPn(senderPn);

        if (registro) {
            const dt = formatarData(registro.dataHora);

            await sock.sendMessage(from, {
                text:
                    `*Ok!* Vejo seu id salvo no banco de dados, você passou o acesso de dono para *${registro.novoDonoPn}* ` +
                    `no dia *${dt.diaNum}* do mês *${dt.mes}* às *${dt.hora}*, ` +
                    `digite sua senha para que você possa voltar a ser o dono do Bot novamente:`,
                footer: 'SYSTEM-SONIC - Recuperação de Dono',
            }, { quoted: m });

            const listenerId = `${from}_${sender}`;
            estadosPendentes.set(listenerId, { etapa: 'aguardando_token' });

            registerListener(listenerId, async (msg) => {
                removeListener(listenerId);
                estadosPendentes.delete(listenerId);

                const tokenDigitado = (
                    msg?.message?.conversation ||
                    msg?.message?.extendedTextMessage?.text ||
                    ''
                ).trim();

                if (validarToken(senderPn, tokenDigitado)) {
                    // Token válido — restaura o dono
                    // Resolve LID → PN para salvar o número correto no config
                    const jidReal = await resolveToJID(sender, sock);
                    const pnReal  = extrairNumero(jidReal || sender);

                    const configAtual = obterConfig();
                    configAtual.ownerNumber = pnReal;
                    saveConfig(configAtual);

                    // Remove o registro (ele volta a ser dono ativo)
                    removerRegistro(senderPn);

                    await sock.sendMessage(from, {
                        text: '*Token válido* Você agora é dono do Bot novamente!',
                        footer: 'SYSTEM-SONIC - Recuperação de Dono',
                    }, { quoted: msg });
                } else {
                    // Token inválido
                    const dtReg = formatarData(registro.dataHora);
                    await sock.sendMessage(from, {
                        text:
                            `*Ops!* Token inválido, verifique seu token gerado no dia *${dtReg.dia}* às *${dtReg.hora}* e tente novamente!`,
                        footer: 'SYSTEM-SONIC - Recuperação de Dono',
                    }, { quoted: msg });
                }
            }, 180000); // 3 min para digitar o token

            return;
        }

        // ── Caso 3: Nunca foi dono ──────────────────────────────────────────
        await sock.sendMessage(from, {
            text: '*ACESSO RESTRITO AO MEU DONO🛡️*\nEste comando é exclusivo para o dono do Bot. Você não tem permissão para usá-lo.',
            footer: 'SYSTEM-SONIC - Transferência de Dono',
        }, { quoted: m });
    },
};
