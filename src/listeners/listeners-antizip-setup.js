// src/listeners/listeners-antizip-setup.js
const path = require("path");
const { obterEtapaAntizip, atualizarEtapaAntizip, limparEtapaAntizip, salvarConfigAntizip, desativarAntizip } = require(path.join(__dirname, '..', 'lib', 'antizip-state', 'antizip-state.js'));

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

    salvarConfigAntizip(from, configParaSalvar);
    limparEtapaAntizip(from, sender);

    const resumo = `*STATUS ANTI ZIP - SYSTEMSONIC SECURITY*\n\n— dados do sistema de anti ZIP —\n*Deletar a mensagem?* ${deletarMsg}\n*Remover membro?* ${removerMembro}\n*Remoção:* ${modoRemocaoTexto}\n\nAnti ZIP - SystemSonic Security`;

    await sock.sendMessage(from, { text: resumo, footer: "SYSTEM-SONIC - Security Anti ZIP" });
}

module.exports = {
    name: "antizip-setup",
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

        if (buttonId === 'antizip_desativar') {
            desativarAntizip(from);
            await sock.sendMessage(from, {
                text: "*ANTI ZIP DESATIVADO*\n\nO sistema de anti ZIP foi desativado com sucesso!\n\nAnti ZIP - SystemSonic Security",
                footer: "SYSTEM-SONIC - Security Anti ZIP"
            });
            return true;
        }

        const etapaAtual = obterEtapaAntizip(from, sender);
        if (!etapaAtual) return false;

        try {
            if (etapaAtual.etapa === 'intro' && buttonId) {
                const removeMembro = buttonId === 'antizip_intro_sim';
                atualizarEtapaAntizip(from, sender, 'deletar_midia', { removerMembro: removeMembro });
                await sock.sendMessage(from, {
                    text: "*PERFEITO!* VAMOS CONTINUAR CONFIGURANDO\n\nVocê deseja que o arquivo ZIP postado seja deletado para todos?",
                    footer: "SYSTEM-SONIC - Security Anti ZIP",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "SIM", id: "antizip_deletar_sim" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "NÃO", id: "antizip_deletar_nao" }) }
                    ]
                });
                return true;
            }

            if (etapaAtual.etapa === 'deletar_midia' && buttonId) {
                const deletarMidia = buttonId === 'antizip_deletar_sim';

                if (!etapaAtual.dados.removerMembro) {
                    const dadosFinais = { ...etapaAtual.dados, deletarMidia, modoRemocao: 'imediato', qtdAdvertencias: 0 };
                    await finalizarConfiguracao(sock, from, sender, dadosFinais);
                    return true;
                }

                atualizarEtapaAntizip(from, sender, 'modo_remocao', { deletarMidia });
                await sock.sendMessage(from, {
                    text: "*EXCELENTE!* QUASE LÁ. VAMOS TERMINAR DE CONFIGURAR\n\nVocê deseja que a pessoa seja removida imediatamente ou por advertências?",
                    footer: "SYSTEM-SONIC - Security Anti ZIP",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "IMEDIATAMENTE", id: "antizip_modo_imediato" }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "ADVERTÊNCIAS", id: "antizip_modo_advertencia" }) }
                    ]
                });
                return true;
            }

            if (etapaAtual.etapa === 'modo_remocao' && buttonId) {
                if (buttonId === 'antizip_modo_imediato') {
                    const dados = { ...etapaAtual.dados, modoRemocao: 'imediato', qtdAdvertencias: 0 };
                    await finalizarConfiguracao(sock, from, sender, dados);
                    return true;
                } else if (buttonId === 'antizip_modo_advertencia') {
                    atualizarEtapaAntizip(from, sender, 'qtd_advertencias', { modoRemocao: 'advertencia' });
                    const botoes = [];
                    for (let i = 1; i <= 8; i++) {
                        botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `${i}`, id: `antizip_qtd_${i}` }) });
                    }
                    botoes.push({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PERSONALIZAR", id: "antizip_qtd_personalizar" }) });
                    await sock.sendMessage(from, {
                        text: "*CERTO!* ESTAMOS NA ETAPA FINAL\n\nQuantas advertências o membro deve ter antes de ser removido?",
                        footer: "SYSTEM-SONIC - Security Anti ZIP",
                        interactiveButtons: botoes
                    });
                    return true;
                }
            }

            if (etapaAtual.etapa === 'qtd_advertencias' && buttonId) {
                if (buttonId === 'antizip_qtd_personalizar') {
                    atualizarEtapaAntizip(from, sender, 'personalizar_advertencia', {});
                    await sock.sendMessage(from, {
                        text: "*ENTENDI* VAMOS TERMINAR DE CONFIGURAR O SISTEMA DE ANTI ZIP\n\nQuantas advertências você deseja que o membro tenha antes de ser removido? Digite um número.",
                        footer: "SYSTEM-SONIC - Security Anti ZIP"
                    });
                    return true;
                } else if (buttonId.startsWith('antizip_qtd_')) {
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
            console.error("[ANTIZIP-SETUP] Erro:", error.message);
            limparEtapaAntizip(from, sender);
            await sock.sendMessage(from, { text: "*Ops!* Erro durante a configuração. Tente novamente." });
            return true;
        }

        return false;
    }
};
