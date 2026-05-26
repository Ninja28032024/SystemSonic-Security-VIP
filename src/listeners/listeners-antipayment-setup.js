// src/listeners/listeners-antipayment-setup.js
const path = require("path");
const { obterEtapaAntipayment, atualizarEtapaAntipayment, limparEtapaAntipayment, salvarConfigAntipayment, desativarAntipayment } = require(path.join(__dirname, '..', 'lib', 'antipayment-state', 'antipayment-state.js'));

async function finalizarConfiguracao(sock, from, sender, dados) {
    const removerMembro = dados.removerMembro ? "SIM" : "NÃO";

    let modoRemocaoTexto = "";
    if (!dados.removerMembro) {
        modoRemocaoTexto = "Não se aplica (remoção desativada)";
    } else if (dados.modoRemocao === 'imediato') {
        modoRemocaoTexto = "Imediato";
    } else {
        const plural = dados.qtdAdvertencias > 1 ? "advertências" : "advertência";
        modoRemocaoTexto = `${dados.qtdAdvertencias} ${plural}`;
    }

    const configParaSalvar = {
        removerMembro: dados.removerMembro,
        modoRemocao: dados.modoRemocao || 'imediato',
        qtdAdvertencias: dados.qtdAdvertencias || 0,
        advertencias: {},
        configuradoPor: sender,
        configuradoEm: new Date().toISOString()
    };

    salvarConfigAntipayment(from, configParaSalvar);
    limparEtapaAntipayment(from, sender);

    const resumo = `*STATUS ANTI PAYMENT - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti mensagens de pagamento —\n*Remover membro?* ${removerMembro}\n*Remoção:* ${modoRemocaoTexto}\n\nAnti Payment - SystemSonic Security`;

    await sock.sendMessage(from, { text: resumo, footer: "SYSTEM-SONIC - Security Anti Payment" });
}

module.exports = {
    name: "antipayment-setup",
    async execute(sock, m, options) {
        const { from, sender } = options;

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

        if (buttonId === 'antipayment_desativar') {
            desativarAntipayment(from);
            await sock.sendMessage(from, {
                text: "*ANTI PAYMENT DESATIVADO*\n\nO sistema de anti mensagens de pagamento foi desativado com sucesso!\n\nAnti Payment - SystemSonic Security",
                footer: "SYSTEM-SONIC - Security Anti Payment"
            });
            return true;
        }

        const etapaAtual = obterEtapaAntipayment(from, sender);
        if (!etapaAtual) return false;

        try {
            if (etapaAtual.etapa === 'intro' && buttonId) {
                const removeMembro = buttonId === 'antipayment_intro_sim';

                if (!removeMembro) {
                    await finalizarConfiguracao(sock, from, sender, { removerMembro: false, modoRemocao: 'imediato', qtdAdvertencias: 0 });
                    return true;
                }

                atualizarEtapaAntipayment(from, sender, 'modo_remocao', { removerMembro: true });
                await sock.sendMessage(from, {
                    text: "*PERFEITO!* VAMOS CONTINUAR CONFIGURANDO\n\nVocê deseja que a pessoa seja removida imediatamente ou por advertências?",
                    footer: "SYSTEM-SONIC - Security Anti Payment",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "IMEDIATAMENTE", id: "antipayment_modo_imediato" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "ADVERTÊNCIAS", id: "antipayment_modo_advertencia" }) }
                    ]
                });
                return true;
            }

            if (etapaAtual.etapa === 'modo_remocao' && buttonId) {
                if (buttonId === 'antipayment_modo_imediato') {
                    const dados = { ...etapaAtual.dados, modoRemocao: 'imediato', qtdAdvertencias: 0 };
                    await finalizarConfiguracao(sock, from, sender, dados);
                    return true;
                } else if (buttonId === 'antipayment_modo_advertencia') {
                    atualizarEtapaAntipayment(from, sender, 'qtd_advertencias', { modoRemocao: 'advertencia' });
                    const botoes = [];
                    for (let i = 1; i <= 8; i++) {
                        botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `${i}`, id: `antipayment_qtd_${i}` }) });
                    }
                    botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PERSONALIZAR", id: "antipayment_qtd_personalizar" }) });
                    await sock.sendMessage(from, {
                        text: "*CERTO!* ESTAMOS NA ETAPA FINAL\n\nQuantas advertências o membro deve ter antes de ser removido?",
                        footer: "SYSTEM-SONIC - Security Anti Payment",
                        interactiveButtons: botoes
                    });
                    return true;
                }
            }

            if (etapaAtual.etapa === 'qtd_advertencias' && buttonId) {
                if (buttonId === 'antipayment_qtd_personalizar') {
                    atualizarEtapaAntipayment(from, sender, 'personalizar_advertencia', {});
                    await sock.sendMessage(from, {
                        text: "*ENTENDI* VAMOS TERMINAR DE CONFIGURAR O SISTEMA DE ANTI PAYMENT\n\nQuantas advertências você deseja que o membro tenha antes de ser removido? Digite um número.",
                        footer: "SYSTEM-SONIC - Security Anti Payment"
                    });
                    return true;
                } else if (buttonId.startsWith('antipayment_qtd_')) {
                    const partes = buttonId.split('_');
                    const qtd = parseInt(partes[partes.length - 1]);
                    const dados = { ...etapaAtual.dados, qtdAdvertencias: qtd };
                    await finalizarConfiguracao(sock, from, sender, dados);
                    return true;
                }
            }

            if (etapaAtual.etapa === 'personalizar_advertencia' && textMessage) {
                const numero = parseInt(textMessage.trim());
                if (isNaN(numero) || numero <= 0) {
                    await sock.sendMessage(from, { text: "Por favor, digite um número válido maior que zero." });
                    return true;
                }
                const dados = { ...etapaAtual.dados, qtdAdvertencias: numero };
                await finalizarConfiguracao(sock, from, sender, dados);
                return true;
            }

        } catch (error) {
            console.error("[ANTIPAYMENT-SETUP] Erro:", error.message);
            limparEtapaAntipayment(from, sender);
            await sock.sendMessage(from, { text: "*Ops!* Erro durante a configuração. Tente novamente." });
            return true;
        }

        return false;
    }
};
