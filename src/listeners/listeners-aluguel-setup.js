// src/listeners/listeners-aluguel-setup.js
const path = require('path');
const { isOwner, isUserAdmin } = require(path.join(__dirname, '..', 'utils.js'));
const {
    obterSetup,
    atualizarSetup,
    limparSetup,
    definirSetup,
    obterToken,
    salvarToken,
    salvarPreco30Dias,
    calcularPrecos,
    formatarReais,
    registrarAluguel,
    registrarPagamentoPendente,
    formatarDataHora,
    salvarConfigGlobal
} = require(path.join(__dirname, '..', 'lib', 'aluguel-state', 'aluguel-state.js'));
const { criarCobrancaPix, validarToken } = require(path.join(__dirname, '..', 'lib', 'aluguel-state', 'mercadopago-client.js'));

function extrairButtonId(m) {
    if (m.message?.buttonsResponseMessage?.selectedButtonId) return m.message.buttonsResponseMessage.selectedButtonId;
    if (m.message?.interactiveResponseMessage) {
        const nf = m.message.interactiveResponseMessage?.nativeFlowResponseMessage;
        if (nf?.paramsJson) { try { return JSON.parse(nf.paramsJson).id; } catch (e) {} }
        const br = m.message.interactiveResponseMessage?.response?.buttonReply;
        if (br?.id) return br.id;
        const body = m.message.interactiveResponseMessage?.body?.text;
        if (body) return body;
    }
    if (m.message?.templateButtonReplyMessage?.selectedId) return m.message.templateButtonReplyMessage.selectedId;
    if (m.message?.listResponseMessage?.selectedButtonId) return m.message.listResponseMessage.selectedButtonId;
    return null;
}

function extrairTexto(m) {
    return m.message?.extendedTextMessage?.text || m.message?.conversation || '';
}

// Botões padrão de cancelar/reiniciar (reutilizados em todas as etapas)
const botoesNavegacao = [
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'CANCELAR SESSÃO', id: 'aluguel_token_cancelar' }) },
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'INICIAR DE NOVO', id: 'aluguel_token_reiniciar' }) }
];

async function enviarQrCode(sock, jid, qrBase64, qrCode, descricao) {
    try {
        if (qrBase64) {
            const buffer = Buffer.from(qrBase64, 'base64');
            await sock.sendMessage(jid, {
                image: buffer,
                caption: `*APONTE A CÂMERA DO SEU CELULAR OU COPIE O CÓDIGO ABAIXO PARA PAGAR*\n\n${descricao}`,
                footer: 'SYSTEM-SONIC - Modo Aluguel',
                interactiveButtons: [
                    { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copiar código Pix 📋', id: 'copy_pix', copy_code: qrCode }) }
                ]
            });
        } else {
            await sock.sendMessage(jid, {
                text: `*APONTE A CÂMERA DO SEU CELULAR OU COPIE O CÓDIGO ABAIXO PARA PAGAR*\n\n${descricao}\n\n${qrCode}`,
                footer: 'SYSTEM-SONIC - Modo Aluguel',
                interactiveButtons: [
                    { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copiar código Pix 📋', id: 'copy_pix', copy_code: qrCode }) }
                ]
            });
        }
    } catch (e) {
        await sock.sendMessage(jid, { text: `*Código Pix:*\n${qrCode}`, footer: 'SYSTEM-SONIC - Modo Aluguel' });
    }
}

function iniciarVerificacaoPagamento(sock, paymentId, groupId, adminJid, dias, valor, config) {
    const { verificarPagamento } = require(path.join(__dirname, '..', 'lib', 'aluguel-state', 'mercadopago-client.js'));
    const { obterToken, registrarAluguel, removerPagamentoPendente, formatarDataHora } = require(path.join(__dirname, '..', 'lib', 'aluguel-state', 'aluguel-state.js'));

    const INTERVALO = 15 * 1000;
    const TIMEOUT = 30 * 60 * 1000;
    const inicio = Date.now();

    const interval = setInterval(async () => {
        try {
            if (Date.now() - inicio > TIMEOUT) {
                clearInterval(interval);
                removerPagamentoPendente(paymentId);
                return;
            }
            const token = obterToken();
            if (!token) { clearInterval(interval); return; }
            const resultado = await verificarPagamento(token, paymentId);
            if (!resultado || !resultado.aprovado) return;
            clearInterval(interval);
            removerPagamentoPendente(paymentId);
            const info = registrarAluguel(groupId, dias, valor);
            const inicio2 = formatarDataHora(info.inicioEm);
            const fim = formatarDataHora(info.expiracaoEm);
            await sock.sendMessage(groupId, {
                text: `*PAGAMENTO CONFIRMADO! BOT ALUGADO*\n\n*Período:* ${dias} dias\n*Valor pago:* ${formatarReais(valor)}\n*Horário do aluguel:* ${inicio2.hora}\n*Data do aluguel:* ${inicio2.data}\n*Dia terminal:* ${fim.data}\n*Hora terminal:* ${fim.hora}`,
                footer: 'SYSTEM-SONIC - Modo Aluguel'
            });
        } catch (e) {
            console.error('[ALUGUEL] Erro na verificação de pagamento:', e.message);
        }
    }, INTERVALO);
}

module.exports = {
    name: 'aluguel-setup',
    async execute(sock, m, options) {
        const { from, sender, config } = options;
        if (!from.endsWith('@g.us')) return false;

        const buttonId = extrairButtonId(m);
        const texto = extrairTexto(m).trim();
        const setup = obterSetup(from, sender);

        try {
            // ── BOTÃO PAGAR PLANO (privado dos admins) ──
            if (buttonId === 'aluguel_pagar_plano') {
                const token = obterToken();
                const ownerNumber = (config.ownerNumber || '').split('@')[0];

                if (!token) {
                    await sock.sendMessage(from, {
                        text: '*ENTRE EM CONTATO COM MEU DONO PARA PAGAR UM PLANO*',
                        footer: 'SYSTEM-SONIC - Modo Aluguel',
                        interactiveButtons: [
                            { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Falar com o Dono', url: `https://wa.me/${ownerNumber}` }) }
                        ]
                    });
                    return true;
                }

                const precos = calcularPrecos();
                if (!precos) {
                    await sock.sendMessage(from, { text: '*Ops!* Nenhum plano configurado ainda. Tente mais tarde.', footer: 'SYSTEM-SONIC - Modo Aluguel' });
                    return true;
                }

                const botoes = [5, 10, 15, 20, 25, 30].map(dias => ({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({ display_text: `${dias} dias | ${formatarReais(precos[dias])}`, id: `aluguel_escolher_plano_${dias}` })
                }));

                await sock.sendMessage(from, {
                    text: '*PERFEITO!* MAS ANTES, ESCOLHA O PLANO QUE DESEJA PAGAR',
                    footer: 'SYSTEM-SONIC - Modo Aluguel',
                    interactiveButtons: botoes
                });
                return true;
            }

            // ── ESCOLHA DO PLANO NO PRIVADO ──
            if (buttonId?.startsWith('aluguel_escolher_plano_')) {
                const dias = parseInt(buttonId.replace('aluguel_escolher_plano_', ''));
                const token = obterToken();
                const precos = calcularPrecos();
                if (!precos || !token) return false;

                const valor = precos[dias];
                const descricao = `${dias} dias | ${formatarReais(valor)}`;

                try {
                    const cobranca = await criarCobrancaPix(token, valor, descricao);
                    registrarPagamentoPendente(cobranca.id, from, sender, dias, valor);
                    await enviarQrCode(sock, from, cobranca.qrCodeBase64, cobranca.qrCode, descricao);
                    iniciarVerificacaoPagamento(sock, cobranca.id, from, sender, dias, valor, config);
                } catch (e) {
                    console.error('[ALUGUEL] Erro ao gerar Pix:', e.message);
                    await sock.sendMessage(from, { text: '*Ops!* Erro ao gerar cobrança. Tente novamente.' });
                }
                return true;
            }

            // ── ALUGUEL MANUAL (dono, no grupo) ──
            if (buttonId?.startsWith('alugar_manual_') && setup?.etapa === 'alugar_manual') {
                const dias = parseInt(buttonId.replace('alugar_manual_', ''));
                const precos = calcularPrecos();
                if (!precos) return false;

                const valor = precos[dias];
                const info = registrarAluguel(from, dias, valor);
                const inicio = formatarDataHora(info.inicioEm);
                const fim = formatarDataHora(info.expiracaoEm);
                limparSetup(from, sender);

                await sock.sendMessage(from, {
                    text: `*PERFEITO!* BOT ALUGADO\n\n*Período:* ${dias} dias\n*Valor pago:* ${formatarReais(valor)}\n*Horário do aluguel:* ${inicio.hora}\n*Data do aluguel:* ${inicio.data}\n*Dia terminal:* ${fim.data}\n*Hora terminal:* ${fim.hora}`,
                    footer: 'SYSTEM-SONIC - Modo Aluguel'
                }, { quoted: m });
                return true;
            }

            // ── CANCELAR SESSÃO ──
            if (buttonId === 'aluguel_token_cancelar') {
                limparSetup(from, sender);
                await sock.sendMessage(from, {
                    text: '*CONFIGURAÇÃO CANCELADA*\n\nA sessão de configuração foi encerrada. Use !config-aluguel para começar novamente quando quiser.',
                    footer: 'SYSTEM-SONIC - Modo Aluguel'
                }, { quoted: m });
                return true;
            }

            // ── REINICIAR SESSÃO ──
            if (buttonId === 'aluguel_token_reiniciar') {
                limparSetup(from, sender);
                definirSetup(from, sender, 'escopo');
                await sock.sendMessage(from, {
                    text: '*OK!* VAMOS CONFIGURAR O SISTEMA DE MODO ALUGUEL NESTE GRUPO\n\nO sistema deve ser ativo e cobrado apenas neste grupo?',
                    footer: 'SYSTEM-SONIC - Modo Aluguel',
                    interactiveButtons: [
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'SIM', id: 'aluguel_escopo_sim' }) },
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'NÃO', id: 'aluguel_escopo_nao' }) }
                    ]
                }, { quoted: m });
                return true;
            }

            // ── A PARTIR DAQUI PRECISA DE SETUP ──
            if (!setup) return false;

            // ── ESCOPO ──
            if (buttonId === 'aluguel_escopo_sim' || buttonId === 'aluguel_escopo_nao') {
                const apenasEsteGrupo = buttonId === 'aluguel_escopo_sim';
                atualizarSetup(from, sender, 'token', { apenasEsteGrupo });
                await sock.sendMessage(from, {
                    text: '*CERTO!* VAMOS CONTINUAR CONFIGURANDO O SISTEMA DE MODO ALUGUEL\n\nVocê já tem token do Mercado Pago?',
                    footer: 'SYSTEM-SONIC - Modo Aluguel',
                    interactiveButtons: [
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'SIM', id: 'aluguel_token_sim' }) },
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'NÃO', id: 'aluguel_token_nao' }) },
                        ...botoesNavegacao
                    ]
                }, { quoted: m });
                return true;
            }

            // ── ETAPA: TEM TOKEN? ──
            if (setup.etapa === 'token' && buttonId) {
                if (buttonId === 'aluguel_token_sim') {
                    atualizarSetup(from, sender, 'aguardar_token', {});
                    await sock.sendMessage(from, {
                        text: '*ENTENDIDO!* VOU PRECISAR DESTE TOKEN\n\nMande-me o token do Mercado Pago.',
                        footer: 'SYSTEM-SONIC - Modo Aluguel',
                        interactiveButtons: botoesNavegacao
                    }, { quoted: m });
                } else if (buttonId === 'aluguel_token_nao') {
                    atualizarSetup(from, sender, 'aguardar_preco', { semToken: true });
                    await sock.sendMessage(from, {
                        text: '*ENTENDIDO!* SEM PROBLEMA\n\nVocê poderá alugar manualmente usando o comando !alugar.\n\nAgora vamos configurar os preços.',
                        footer: 'SYSTEM-SONIC - Modo Aluguel',
                        interactiveButtons: botoesNavegacao
                    }, { quoted: m });
                    await new Promise(r => setTimeout(r, 2000));
                    await sock.sendMessage(from, {
                        text: '*AGORA ME DIGA*\n\nQual valor você cobra durante 30 dias? Digite usando "R$" e o valor dividido em reais e centavos (ex: R$20,90)',
                        footer: 'SYSTEM-SONIC - Modo Aluguel',
                        interactiveButtons: botoesNavegacao
                    }, { quoted: m });
                }
                return true;
            }

            // ── ETAPA: AGUARDAR TOKEN ──
            if (setup.etapa === 'aguardar_token' && texto) {
                const tokenInformado = texto.trim();
                const valido = await validarToken(tokenInformado);

                if (!valido) {
                    await sock.sendMessage(from, {
                        text: '*Ops!* Token inválido ou sem conexão com o Mercado Pago. Verifique e tente novamente.\nSYSTEM-SONIC - Modo Aluguel',
                        footer: 'SYSTEM-SONIC - Modo Aluguel',
                        interactiveButtons: botoesNavegacao
                    }, { quoted: m });
                    return true;
                }

                salvarToken(tokenInformado);
                atualizarSetup(from, sender, 'aguardar_preco', { comToken: true });

                await sock.sendMessage(from, {
                    text: '*PERFEITO!* O TOKEN FOI SALVO E SERÁ USADO PARA COBRAR AUTOMATICAMENTE.\n\nAgora vamos configurar os preços.',
                    footer: 'SYSTEM-SONIC - Modo Aluguel',
                    interactiveButtons: botoesNavegacao
                }, { quoted: m });

                await new Promise(r => setTimeout(r, 2000));

                await sock.sendMessage(from, {
                    text: '*AGORA ME DIGA*\n\nQual valor você cobra durante 30 dias? Digite usando "R$" e o valor dividido em reais e centavos (ex: R$20,90)',
                    footer: 'SYSTEM-SONIC - Modo Aluguel',
                    interactiveButtons: botoesNavegacao
                }, { quoted: m });
                return true;
            }

            // ── ETAPA: AGUARDAR PREÇO ──
            if (setup.etapa === 'aguardar_preco' && texto) {
                const match = texto.replace(/\s/g, '').match(/R?\$?(\d+)[,.](\d{1,2})/i);
                if (!match) {
                    await sock.sendMessage(from, {
                        text: '*Ops!* Valor inválido. Use o formato R$20,90 e tente novamente.',
                        footer: 'SYSTEM-SONIC - Modo Aluguel',
                        interactiveButtons: botoesNavegacao
                    }, { quoted: m });
                    return true;
                }

                const valor = parseFloat(`${match[1]}.${match[2].padEnd(2, '0')}`);
                salvarPreco30Dias(valor);
                limparSetup(from, sender);

                const precos = calcularPrecos();
                const linhas = [5, 10, 15, 20, 25, 30].map(d => `*${d} dias:* ${formatarReais(precos[d])}`).join('\n');

                await sock.sendMessage(from, {
                    text: `*PERFEITO!* CONFIGUREI SEIS PERÍODOS DE ALUGUÉIS\n\n${linhas}`,
                    footer: 'SYSTEM-SONIC - Modo Aluguel'
                }, { quoted: m });
                return true;
            }

        } catch (error) {
            console.error('[ALUGUEL-SETUP] Erro:', error.message);
            limparSetup(from, sender);
            await sock.sendMessage(from, { text: '*Ops!* Erro durante a configuração. Tente novamente.' }, { quoted: m });
            return true;
        }

        return false;
    }
};
