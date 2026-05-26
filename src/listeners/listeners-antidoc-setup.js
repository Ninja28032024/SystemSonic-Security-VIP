// src/listeners/listeners-antidoc-setup.js
const path = require("path");
const { obterEtapaAntidoc, atualizarEtapaAntidoc, limparEtapaAntidoc, salvarConfigAntidoc, desativarAntidoc } = require(path.join(__dirname, '..', 'lib', 'antidoc-state', 'antidoc-state.js'));

async function finalizarConfiguracao(sock, from, sender, dados) {
    const deletarMsg = dados.deletarMidia ? "SIM" : "NAO";
    const removerMembro = dados.removerMembro ? "SIM" : "NAO";

    let modoRemocaoTexto = "";
    if (!dados.removerMembro) {
        modoRemocaoTexto = "Nao se aplica (remocao desativada)";
    } else if (dados.modoRemocao === 'imediato') {
        modoRemocaoTexto = "Imediato";
    } else {
        const plural = dados.qtdAdvertencias > 1 ? "advertencias" : "advertencia";
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

    salvarConfigAntidoc(from, configParaSalvar);
    limparEtapaAntidoc(from, sender);

    const resumo = `*STATUS ANTI DOCUMENTOS - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti documentos —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remocao:* ${modoRemocaoTexto}\n\nAnti documentos - SystemSonic Security`;

    await sock.sendMessage(from, { text: resumo, footer: "SYSTEM-SONIC - Security Anti Documentos" });
}

module.exports = {
    name: "antidoc-setup",
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

        if (buttonId === 'antidoc_desativar') {
            desativarAntidoc(from);
            await sock.sendMessage(from, {
                text: "*ANTI DOCUMENTOS DESATIVADO*\n\nO sistema de anti documentos foi desativado com sucesso!\n\nAnti documentos - SystemSonic Security",
                footer: "SYSTEM-SONIC - Security Anti Documentos"
            });
            return true;
        }

        const etapaAtual = obterEtapaAntidoc(from, sender);
        if (!etapaAtual) return false;

        try {
            if (etapaAtual.etapa === 'intro' && buttonId) {
                const removeMembro = buttonId === 'antidoc_intro_sim';
                atualizarEtapaAntidoc(from, sender, 'deletar_midia', { removerMembro: removeMembro });
                await sock.sendMessage(from, {
                    text: "*PERFEITO!* VAMOS CONTINUAR CONFIGURANDO\n\nVoce deseja que o documento postado seja deletado para todos?",
                    footer: "SYSTEM-SONIC - Security Anti Documentos",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "SIM", id: "antidoc_deletar_sim" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "NAO", id: "antidoc_deletar_nao" }) }
                    ]
                });
                return true;
            }

            if (etapaAtual.etapa === 'deletar_midia' && buttonId) {
                const deletarMidia = buttonId === 'antidoc_deletar_sim';

                if (!etapaAtual.dados.removerMembro) {
                    const dadosFinais = { ...etapaAtual.dados, deletarMidia, modoRemocao: 'imediato', qtdAdvertencias: 0 };
                    await finalizarConfiguracao(sock, from, sender, dadosFinais);
                    return true;
                }

                atualizarEtapaAntidoc(from, sender, 'modo_remocao', { deletarMidia });
                await sock.sendMessage(from, {
                    text: "*EXCELENTE!* QUASE LA. VAMOS TERMINAR DE CONFIGURAR\n\nVoce deseja que a pessoa seja removida imediatamente ou por advertencias?",
                    footer: "SYSTEM-SONIC - Security Anti Documentos",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "IMEDIATAMENTE", id: "antidoc_modo_imediato" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "ADVERTENCIAS", id: "antidoc_modo_advertencia" }) }
                    ]
                });
                return true;
            }

            if (etapaAtual.etapa === 'modo_remocao' && buttonId) {
                if (buttonId === 'antidoc_modo_imediato') {
                    const dados = { ...etapaAtual.dados, modoRemocao: 'imediato', qtdAdvertencias: 0 };
                    await finalizarConfiguracao(sock, from, sender, dados);
                    return true;
                } else if (buttonId === 'antidoc_modo_advertencia') {
                    atualizarEtapaAntidoc(from, sender, 'qtd_advertencias', { modoRemocao: 'advertencia' });
                    const botoes = [];
                    for (let i = 1; i <= 8; i++) {
                        botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `${i}`, id: `antidoc_qtd_${i}` }) });
                    }
                    botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PERSONALIZAR", id: "antidoc_qtd_personalizar" }) });
                    await sock.sendMessage(from, {
                        text: "*CERTO!* ESTAMOS NA ETAPA FINAL\n\nQuantas advertencias o membro deve ter antes de ser removido?",
                        footer: "SYSTEM-SONIC - Security Anti Documentos",
                        interactiveButtons: botoes
                    });
                    return true;
                }
            }

            if (etapaAtual.etapa === 'qtd_advertencias' && buttonId) {
                if (buttonId === 'antidoc_qtd_personalizar') {
                    atualizarEtapaAntidoc(from, sender, 'personalizar_advertencia', {});
                    await sock.sendMessage(from, {
                        text: "*ENTENDI* VAMOS TERMINAR DE CONFIGURAR O SISTEMA DE ANTI DOCUMENTOS\n\nQuantas advertencias voce deseja que o membro tenha antes de ser removido? Digite um numero.",
                        footer: "SYSTEM-SONIC - Security Anti Documentos"
                    });
                    return true;
                } else if (buttonId.startsWith('antidoc_qtd_')) {
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
                    await sock.sendMessage(from, { text: "Por favor, digite um numero valido maior que zero." });
                    return true;
                }
                const dados = { ...etapaAtual.dados, qtdAdvertencias: numero };
                await finalizarConfiguracao(sock, from, sender, dados);
                return true;
            }

        } catch (error) {
            console.error("[ANTIDOC-SETUP] Erro:", error.message);
            limparEtapaAntidoc(from, sender);
            await sock.sendMessage(from, { text: "*Ops!* Erro durante a configuracao. Tente novamente." });
            return true;
        }

        return false;
    }
};
