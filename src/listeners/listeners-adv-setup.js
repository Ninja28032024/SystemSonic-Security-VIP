// src/listeners/listeners-adv-setup.js
const path = require("path");
const {
    obterEtapa, atualizarEtapa, limparEtapa, definirEtapa,
    salvarConfigAdv, obterConfigAdv,
    obterMembroAdv, removerAdvertencias
} = require(path.join(__dirname, '..', 'lib', 'adv-state', 'adv-state.js'));

function parsearTempo(texto) {
    const t = texto.trim().toLowerCase();
    const match = t.match(/^(\d+)\s*(segundo|segundos|minuto|minutos)$/);
    if (!match) return null;
    const valor = parseInt(match[1]);
    const unidade = match[2];
    if (unidade === 'segundo' || unidade === 'segundos') return { ms: valor * 1000, texto: `${valor} ${valor === 1 ? 'segundo' : 'segundos'}` };
    if (unidade === 'minuto' || unidade === 'minutos') return { ms: valor * 60 * 1000, texto: `${valor} ${valor === 1 ? 'minuto' : 'minutos'}` };
    return null;
}

async function finalizarConfigAdv(sock, from, sender, dados) {
    const apagarTexto = dados.apagarMensagens ? "SIM" : "NÃO";
    const tempoTexto = dados.apagarMensagens ? dados.tempoTexto : "Não se aplica";

    const configParaSalvar = {
        apagarMensagens: dados.apagarMensagens,
        tempoApagarMs: dados.tempoApagarMs || 0,
        tempoTexto: tempoTexto,
        limiteAdvertencias: dados.limiteAdvertencias,
        configuradoPor: sender,
        configuradoEm: new Date().toISOString()
    };

    salvarConfigAdv(from, configParaSalvar);
    limparEtapa(from, sender);

    const resumo = `*STATUS CONFIG ADV - SYSTEMSONIC SECURITY*\n\n*Apagar as mensagens?* ${apagarTexto}\n*Por quanto tempo?* ${tempoTexto}\n*Limite de advertências:* ${dados.limiteAdvertencias}\n\nConfig adv - SystemSonic Security`;

    await sock.sendMessage(from, {
        text: resumo,
        footer: "SYSTEM-SONIC - Sistema de Advertências"
    });
}

module.exports = {
    name: "adv-setup",
    async execute(sock, m, options) {
        const { from, sender } = options;
        if (!from.endsWith("@g.us")) return false;

        let buttonId = null;
        let textMessage = null;

        if (m.message?.buttonsResponseMessage?.selectedButtonId) {
            buttonId = m.message.buttonsResponseMessage.selectedButtonId;
        } else if (m.message?.interactiveResponseMessage) {
            const nativeFlow = m.message.interactiveResponseMessage?.nativeFlowResponseMessage;
            if (nativeFlow?.paramsJson) {
                try { const parsed = JSON.parse(nativeFlow.paramsJson); buttonId = parsed.id; } catch (e) {}
            }
            if (!buttonId) {
                const buttonReply = m.message.interactiveResponseMessage?.response?.buttonReply;
                if (buttonReply?.id) buttonId = buttonReply.id;
            }
            if (!buttonId) {
                const body = m.message.interactiveResponseMessage?.body?.text;
                if (body) buttonId = body;
            }
        } else if (m.message?.templateButtonReplyMessage?.selectedId) {
            buttonId = m.message.templateButtonReplyMessage.selectedId;
        } else if (m.message?.listResponseMessage?.selectedButtonId) {
            buttonId = m.message.listResponseMessage.selectedButtonId;
        }

        if (m.message?.conversation) {
            textMessage = m.message.conversation;
        } else if (m.message?.extendedTextMessage?.text) {
            textMessage = m.message.extendedTextMessage.text;
        }

        const etapaAtual = obterEtapa(from, sender);
        if (!etapaAtual) return false;

        try {
            // ========== FLUXO CONFIG-ADV ==========

            if (etapaAtual.etapa === 'apagar_msgs' && buttonId) {
                const apagarMensagens = buttonId === 'adv_apagar_sim';
                atualizarEtapa(from, sender, 'limite_adv', { apagarMensagens });

                const botoes = [];
                for (let i = 1; i <= 8; i++) {
                    botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `${i}`, id: `adv_limite_${i}` }) });
                }
                botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PERSONALIZAR", id: "adv_limite_personalizar" }) });

                await sock.sendMessage(from, {
                    text: "*EXCELENTE!* QUASE LÁ. PRECISO SÓ DE MAIS UM DETALHE, PARA FECHAR COM CHAVE DE OURO\nQuantas advertências o membro deve tomar até ser removido?",
                    footer: "SYSTEM-SONIC - Sistema de Advertências",
                    interactiveButtons: botoes
                });
                return true;
            }

            if (etapaAtual.etapa === 'limite_adv' && buttonId) {
                if (buttonId === 'adv_limite_personalizar') {
                    atualizarEtapa(from, sender, 'limite_adv_personalizar', {});
                    await sock.sendMessage(from, {
                        text: "*ÓTIMO!* AGORA PRECISO QUE ME DIGA EM NÚMERO\nQuantas advertências o membro deve tomar até ser removido?",
                        footer: "SYSTEM-SONIC - Sistema de Advertências"
                    });
                    return true;
                } else if (buttonId.startsWith('adv_limite_')) {
                    const partes = buttonId.split('_');
                    const limite = parseInt(partes[partes.length - 1]);
                    atualizarEtapa(from, sender, etapaAtual.dados.apagarMensagens ? 'tempo_apagar' : 'finalizar_sem_tempo', { limiteAdvertencias: limite });

                    if (!etapaAtual.dados.apagarMensagens) {
                        await finalizarConfigAdv(sock, from, sender, { ...etapaAtual.dados, limiteAdvertencias: limite, apagarMensagens: false, tempoTexto: 'Não se aplica', tempoApagarMs: 0 });
                        return true;
                    }

                    await sock.sendMessage(from, {
                        text: "*CERTO!* VAMOS TERMINAR DE CONFIGURAR\nDeseja que as mensagens dele seja apagada durante quanto tempo?",
                        footer: "SYSTEM-SONIC - Sistema de Advertências",
                        interactiveButtons: [
                            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "30 segundos", id: "adv_tempo_30s" }) },
                            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "1 minuto", id: "adv_tempo_1m" }) },
                            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "5 minutos", id: "adv_tempo_5m" }) },
                            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "10 minutos", id: "adv_tempo_10m" }) },
                            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PERSONALIZAR", id: "adv_tempo_personalizar" }) }
                        ]
                    });
                    return true;
                }
            }

            if (etapaAtual.etapa === 'limite_adv_personalizar' && textMessage) {
                const numero = parseInt(textMessage.trim());
                if (isNaN(numero) || numero <= 0) {
                    await sock.sendMessage(from, { text: "Por favor, digite um número válido maior que zero." });
                    return true;
                }
                atualizarEtapa(from, sender, etapaAtual.dados.apagarMensagens ? 'tempo_apagar' : 'finalizar_sem_tempo', { limiteAdvertencias: numero });

                if (!etapaAtual.dados.apagarMensagens) {
                    await finalizarConfigAdv(sock, from, sender, { ...etapaAtual.dados, limiteAdvertencias: numero, apagarMensagens: false, tempoTexto: 'Não se aplica', tempoApagarMs: 0 });
                    return true;
                }

                await sock.sendMessage(from, {
                    text: "*CERTO!* VAMOS TERMINAR DE CONFIGURAR\nDeseja que as mensagens dele seja apagada durante quanto tempo?",
                    footer: "SYSTEM-SONIC - Sistema de Advertências",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "30 segundos", id: "adv_tempo_30s" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "1 minuto", id: "adv_tempo_1m" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "5 minutos", id: "adv_tempo_5m" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "10 minutos", id: "adv_tempo_10m" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PERSONALIZAR", id: "adv_tempo_personalizar" }) }
                    ]
                });
                return true;
            }

            if (etapaAtual.etapa === 'tempo_apagar' && buttonId) {
                const tempoMap = {
                    'adv_tempo_30s': { ms: 30 * 1000, texto: '30 segundos' },
                    'adv_tempo_1m': { ms: 60 * 1000, texto: '1 minuto' },
                    'adv_tempo_5m': { ms: 5 * 60 * 1000, texto: '5 minutos' },
                    'adv_tempo_10m': { ms: 10 * 60 * 1000, texto: '10 minutos' }
                };

                if (buttonId === 'adv_tempo_personalizar') {
                    atualizarEtapa(from, sender, 'tempo_apagar_personalizar', {});
                    await sock.sendMessage(from, {
                        text: "*EXCELENTE!* CONTINUANDO COM A CONFIGURAÇÃO\nMe diga exatamente por quanto tempo eu devo apagar as mensagens do membro advertido. Diga usando \"segundos\" após o número para período em segundos ou \"minutos\" para períodos em minutos (ex: *1 segundo* ou com plural *segundos* ou *1 minuto* ou com plural *minutos*).",
                        footer: "SYSTEM-SONIC - Sistema de Advertências"
                    });
                    return true;
                }

                if (tempoMap[buttonId]) {
                    const tempo = tempoMap[buttonId];
                    const dados = { ...etapaAtual.dados, tempoApagarMs: tempo.ms, tempoTexto: tempo.texto };
                    await finalizarConfigAdv(sock, from, sender, dados);
                    return true;
                }
            }

            if (etapaAtual.etapa === 'tempo_apagar_personalizar' && textMessage) {
                const tempo = parsearTempo(textMessage);
                if (!tempo) {
                    await sock.sendMessage(from, { text: "Não entendi o tempo. Use o formato correto, ex: *30 segundos* ou *5 minutos*." });
                    return true;
                }
                const dados = { ...etapaAtual.dados, tempoApagarMs: tempo.ms, tempoTexto: tempo.texto };
                await finalizarConfigAdv(sock, from, sender, dados);
                return true;
            }

            // ========== FLUXO RMV-ADV ==========

            if (etapaAtual.etapa === 'aguardar_mencao_rmv') {
                const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentions.length === 0) return false;

                const targetJid = mentions[0];
                const membroAdv = obterMembroAdv(from, targetJid);
                const targetName = `@${targetJid.split('@')[0]}`;

                if (!membroAdv || membroAdv.quantidade <= 0) {
                    limparEtapa(from, sender);
                    await sock.sendMessage(from, {
                        text: `*Ops!* Verifiquei que este membro não está na lista de membros advertidos. Verifique o membro correto e tente novamente!`,
                        mentions: [targetJid]
                    });
                    return true;
                }

                if (membroAdv.quantidade === 1) {
                    removerAdvertencias(from, targetJid, 1);
                    limparEtapa(from, sender);
                    await sock.sendMessage(from, {
                        text: `*RETIREI A ADVERTÊNCIA DO MEMBRO ${targetName}*\n${targetName} sua advertência foi retirada.`,
                        mentions: [targetJid]
                    });
                    return true;
                }

                atualizarEtapa(from, sender, 'qtd_rmv_adv', { targetJid });

                const botoes = [];
                const max = Math.min(membroAdv.quantidade, 8);
                for (let i = 1; i <= max; i++) {
                    botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `${i}`, id: `adv_rmv_qtd_${i}` }) });
                }
                if (membroAdv.quantidade > 8) {
                    botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PERSONALIZAR", id: "adv_rmv_qtd_personalizar" }) });
                }

                await sock.sendMessage(from, {
                    text: `*PERFEITO!* SÓ ME DIGA UMA COISA\nQuantas advertências quer retirar deste membro?`,
                    footer: "SYSTEM-SONIC - Sistema de Advertências",
                    interactiveButtons: botoes,
                    mentions: [targetJid]
                });
                return true;
            }

            if (etapaAtual.etapa === 'qtd_rmv_adv' && buttonId) {
                const targetJid = etapaAtual.dados.targetJid;
                const targetName = `@${targetJid.split('@')[0]}`;

                if (buttonId === 'adv_rmv_qtd_personalizar') {
                    atualizarEtapa(from, sender, 'qtd_rmv_adv_personalizar', {});
                    await sock.sendMessage(from, {
                        text: "*OK!* AGORA ME DIGA\nQuantas advertências quer retirar deste membro?",
                        footer: "SYSTEM-SONIC - Sistema de Advertências"
                    });
                    return true;
                }

                if (buttonId.startsWith('adv_rmv_qtd_')) {
                    const partes = buttonId.split('_');
                    const qtd = parseInt(partes[partes.length - 1]);
                    removerAdvertencias(from, targetJid, qtd);
                    limparEtapa(from, sender);
                    const plural = qtd > 1 ? "advertências" : "advertência";
                    await sock.sendMessage(from, {
                        text: `*RETIREI A ADVERTÊNCIA DO MEMBRO ${targetName}*\n${targetName} ${qtd} ${plural} foi retirada.`,
                        mentions: [targetJid]
                    });
                    return true;
                }
            }

            if (etapaAtual.etapa === 'qtd_rmv_adv_personalizar' && textMessage) {
                const targetJid = etapaAtual.dados.targetJid;
                const targetName = `@${targetJid.split('@')[0]}`;
                const numero = parseInt(textMessage.trim());

                if (isNaN(numero) || numero <= 0) {
                    await sock.sendMessage(from, { text: "Por favor, digite um número válido maior que zero." });
                    return true;
                }

                removerAdvertencias(from, targetJid, numero);
                limparEtapa(from, sender);
                const plural = numero > 1 ? "advertências" : "advertência";
                await sock.sendMessage(from, {
                    text: `*RETIREI A ADVERTÊNCIA DO MEMBRO ${targetName}*\n${targetName} ${numero} ${plural} foi retirada.`,
                    mentions: [targetJid]
                });
                return true;
            }

        } catch (error) {
            console.error("[ADV-SETUP] Erro:", error.message);
            limparEtapa(from, sender);
            await sock.sendMessage(from, { text: "*Ops!* Erro durante a configuração. Tente novamente." });
            return true;
        }

        return false;
    }
};
