// src/listeners/listeners-antipython-setup.js
const path = require("path");
const { obterEtapaAntipython, atualizarEtapaAntipython, limparEtapaAntipython, salvarConfigAntipython, desativarAntipython } = require(path.join(__dirname, '..', 'lib', 'antipython-state', 'antipython-state.js'));

async function finalizarConfiguracao(sock, from, sender, dados) {
    const deletarMsg = dados.deletarMidia ? "SIM" : "NÃO";
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
        deletarMidia: dados.deletarMidia,
        modoRemocao: dados.modoRemocao || 'imediato',
        qtdAdvertencias: dados.qtdAdvertencias || 0,
        advertencias: {},
        configuradoPor: sender,
        configuradoEm: new Date().toISOString()
    };

    salvarConfigAntipython(from, configParaSalvar);
    limparEtapaAntipython(from, sender);

    const resumo = `*STATUS ANTI PYTHON - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti Python (.py) —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remoção:* ${modoRemocaoTexto}\n\nAnti Python - SystemSonic Security`;

    await sock.sendMessage(from, { text: resumo, footer: "SYSTEM-SONIC - Security Anti Python" });
}

module.exports = {
    name: "antipython-setup",
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

        if (buttonId === 'antipython_desativar') {
            desativarAntipython(from);
            await sock.sendMessage(from, {
                text: "*ANTI PYTHON DESATIVADO*\n\nO sistema de anti Python foi desativado com sucesso!\n\nAnti Python - SystemSonic Security",
                footer: "SYSTEM-SONIC - Security Anti Python"
            });
            return true;
        }

        const etapaAtual = obterEtapaAntipython(from, sender);
        if (!etapaAtual) return false;

        try {
            if (etapaAtual.etapa === 'intro' && buttonId) {
                const removeMembro = buttonId === 'antipython_intro_sim';
                atualizarEtapaAntipython(from, sender, 'deletar_midia', { removerMembro: removeMembro });
                await sock.sendMessage(from, {
                    text: "*PERFEITO!* VAMOS CONTINUAR CONFIGURANDO\n\nVocê deseja que o arquivo .py postado seja deletado para todos?",
                    footer: "SYSTEM-SONIC - Security Anti Python",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "SIM", id: "antipython_deletar_sim" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "NÃO", id: "antipython_deletar_nao" }) }
                    ]
                });
                return true;
            }

            if (etapaAtual.etapa === 'deletar_midia' && buttonId) {
                const deletarMidia = buttonId === 'antipython_deletar_sim';

                if (!etapaAtual.dados.removerMembro) {
                    const dadosFinais = { ...etapaAtual.dados, deletarMidia, modoRemocao: 'imediato', qtdAdvertencias: 0 };
                    await finalizarConfiguracao(sock, from, sender, dadosFinais);
                    return true;
                }

                atualizarEtapaAntipython(from, sender, 'modo_remocao', { deletarMidia });
                await sock.sendMessage(from, {
                    text: "*EXCELENTE!* QUASE LÁ. VAMOS TERMINAR DE CONFIGURAR\n\nVocê deseja que a pessoa seja removida imediatamente ou por advertências?",
                    footer: "SYSTEM-SONIC - Security Anti Python",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "IMEDIATAMENTE", id: "antipython_modo_imediato" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "ADVERTÊNCIAS", id: "antipython_modo_advertencia" }) }
                    ]
                });
                return true;
            }

            if (etapaAtual.etapa === 'modo_remocao' && buttonId) {
                if (buttonId === 'antipython_modo_imediato') {
                    const dados = { ...etapaAtual.dados, modoRemocao: 'imediato', qtdAdvertencias: 0 };
                    await finalizarConfiguracao(sock, from, sender, dados);
                    return true;
                } else if (buttonId === 'antipython_modo_advertencia') {
                    atualizarEtapaAntipython(from, sender, 'qtd_advertencias', { modoRemocao: 'advertencia' });
                    const botoes = [];
                    for (let i = 1; i <= 8; i++) {
                        botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `${i}`, id: `antipython_qtd_${i}` }) });
                    }
                    botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PERSONALIZAR", id: "antipython_qtd_personalizar" }) });
                    await sock.sendMessage(from, {
                        text: "*CERTO!* ESTAMOS NA ETAPA FINAL\n\nQuantas advertências o membro deve ter antes de ser removido?",
                        footer: "SYSTEM-SONIC - Security Anti Python",
                        interactiveButtons: botoes
                    });
                    return true;
                }
            }

            if (etapaAtual.etapa === 'qtd_advertencias' && buttonId) {
                if (buttonId === 'antipython_qtd_personalizar') {
                    atualizarEtapaAntipython(from, sender, 'personalizar_advertencia', {});
                    await sock.sendMessage(from, {
                        text: "*ENTENDI* VAMOS TERMINAR DE CONFIGURAR O SISTEMA DE ANTI PYTHON\n\nQuantas advertências você deseja que o membro tenha antes de ser removido? Digite um número.",
                        footer: "SYSTEM-SONIC - Security Anti Python"
                    });
                    return true;
                } else if (buttonId.startsWith('antipython_qtd_')) {
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
            console.error("[ANTIPYTHON-SETUP] Erro:", error.message);
            limparEtapaAntipython(from, sender);
            await sock.sendMessage(from, { text: "*Ops!* Erro durante a configuração. Tente novamente." });
            return true;
        }

        return false;
    }
};
