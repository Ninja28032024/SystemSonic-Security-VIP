// src/listeners/listeners-parceria-mencao.js
// Listener para processar menções e inputs customizados do sistema de parcerias

const path = require('path');
const { isUserAdmin } = require(path.join(__dirname, '..', 'utils.js'));
const {
    obterEtapaParceria,
    definirEtapaParceria,
    adicionarParceria,
    limparEtapaParceria,
    obterStatusSistema,
    obterParceriasGrupo
} = require(path.join(__dirname, '..', 'lib', 'parceria-state', 'parceria-state.js'));

const MSG_SISTEMA_DESATIVADO = '*Ops!* O sistema de parcerias está desativado, ative para usar.';

// ============ FUNÇÕES AUXILIARES ============

function extrairTexto(m) {
    if (m.message?.conversation) return m.message.conversation;
    if (m.message?.extendedTextMessage?.text) return m.message.extendedTextMessage.text;
    return '';
}

/**
 * Extrai menção cobrindo TODAS as estruturas possíveis do Baileys
 */
function extrairMencao(m) {
    // Caso 1: extendedTextMessage com contextInfo (mais comum)
    const caso1 = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (caso1 && caso1.length > 0) return caso1[0];

    // Caso 2: Direto no contextInfo sem extendedTextMessage
    const caso2 = m.message?.contextInfo?.mentionedJid;
    if (caso2 && caso2.length > 0) return caso2[0];

    // Caso 3: Mensagem com viewOnce ou outros wrappers
    const caso3 = m.message?.viewOnceMessage?.message
        ?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (caso3 && caso3.length > 0) return caso3[0];

    // Caso 4: Varrer recursivamente qualquer chave de mensagem
    // que contenha mentionedJid (fallback geral)
    try {
        const msgStr = JSON.stringify(m.message || {});
        const match = msgStr.match(/"mentionedJid":\["([^"]+)"/);
        if (match && match[1]) return match[1];
    } catch (_) {}

    return null;
}

/**
 * Normaliza o JID removendo sufixo :XX
 * Ex: 5511999@s.whatsapp.net:0 → 5511999@s.whatsapp.net
 */
function normalizarJid(jid) {
    if (!jid) return '';
    return jid.replace(/:(\d+)@/, '@');
}

/**
 * Verifica se a mensagem é uma resposta de botão
 * (deve ser ignorada pelo listener de menção)
 */
function ehRespostaDeButao(m) {
    return !!(
        m.message?.templateButtonReplyMessage ||
        m.message?.buttonsResponseMessage ||
        m.message?.interactiveResponseMessage
    );
}

// LISTENER PRINCIPAL

async function listenerParceriaMencao(sock, m, from, sender, options = {}) {
    try {
        // Filtros iniciais rápidos
        if (m.key.fromMe) return false;
        if (!from.endsWith('@g.us')) return false;
        if (ehRespostaDeButao(m)) return false;

        // Verificar se existe etapa ativa neste grupo
        const setup = obterEtapaParceria(from);
        if (!setup) return false;

        // Verificar se o sender é quem iniciou o setup
        const senderNorm = normalizarJid(sender);
        const setupSenderNorm = normalizarJid(setup.sender);
        if (senderNorm !== setupSenderNorm) return false;

        // Este listener só trata etapas de texto/menção
        const etapasValidas = [
            'await_mention',
            'await_custom_links',
            'await_custom_interval'
        ];
        if (!etapasValidas.includes(setup.step)) return false;

        // Verificar permissão 
        const groupMetadata = await sock.groupMetadata(from);
        const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);
        if (!senderIsAdmin) return false;

        // ── Verificar sistema ativo
        const sistemaAtivo = obterStatusSistema(from);
        if (!sistemaAtivo) {
            await sock.sendMessage(from, {
                text: MSG_SISTEMA_DESATIVADO
            }, { quoted: m });
            limparEtapaParceria(from);
            return true;
        }

        const texto = extrairTexto(m).trim();
        // ETAPA 1 — AGUARDA MENÇÃO DO PARCEIRO
        if (setup.step === 'await_mention') {

            const partnerJid = extrairMencao(m);

            // Log de diagnóstico
            console.log('[PARCERIA-MENCAO] Step await_mention acionado');
            console.log('[PARCERIA-MENCAO] partnerJid extraído:', partnerJid);
            console.log('[PARCERIA-MENCAO] Keys da mensagem:', Object.keys(m.message || {}));

            if (!partnerJid) {
                await sock.sendMessage(from, {
                    text: '*Ops!* Não detectei nenhuma menção.\n\n' +
                          'Mencione o membro com @ para adicioná-lo como parceiro.'
                }, { quoted: m });
                // NÃO limpa o setup — permite tentar novamente
                return true;
            }

            // Impedir auto-adição
            if (normalizarJid(partnerJid) === senderNorm) {
                await sock.sendMessage(from, {
                    text: '*Ops!* Você não pode se adicionar como parceiro.'
                }, { quoted: m });
                return true;
            }

            // Verifica se já é parceiro
            const parcerias = obterParceriasGrupo(from);
            const jaExiste = parcerias.find(p =>
                normalizarJid(p.partnerJid) === normalizarJid(partnerJid)
            );

            if (jaExiste) {
                await sock.sendMessage(from, {
                    text: `*Ops!* O membro @${partnerJid.split('@')[0]} já é parceiro deste grupo.`,
                    mentions: [partnerJid]
                }, { quoted: m });
                return true;
            }

            // Avança para escolha de quantidade de links
            definirEtapaParceria(from, sender, 'await_max_links', {
                partnerJid: partnerJid
            });

            const botoesLinks = [];
            for (let i = 1; i <= 8; i++) {
                botoesLinks.push({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: `${i} link${i > 1 ? 's' : ''}`,
                        id: `parceria_links_${i}`
                    })
                });
            }
            botoesLinks.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: 'PERSONALIZAR',
                    id: 'parceria_links_custom'
                })
            });

            await sock.sendMessage(from, {
                text: `*OK!* ADICIONANDO @${partnerJid.split('@')[0]} COMO PARCEIRO\n\n` +
                      `Quantos links ele poderá postar por intervalo?`,
                mentions: [partnerJid],
                footer: 'SYSTEM-SONIC | Parcerias',
                interactiveButtons: botoesLinks
            }, { quoted: m });

            return true;
        }
        
        // AGUARDA QUANTIDADE PERSONALIZADA DE LINKS
        if (setup.step === 'await_custom_links') {

            const maxLinks = parseInt(texto);

            if (isNaN(maxLinks) || maxLinks <= 0 || maxLinks > 9999) {
                await sock.sendMessage(from, {
                    text: '*Ops!* Digite apenas um número válido maior que zero.\n\nExemplo: *5*'
                }, { quoted: m });
                return true;
            }

            // Avança para escolha de intervalo
            definirEtapaParceria(from, sender, 'await_interval', {
                ...setup.data,
                maxLinks: maxLinks
            });

            await sock.sendMessage(from, {
                text: `*PERFEITO!* ${maxLinks} link${maxLinks > 1 ? 's' : ''} definido${maxLinks > 1 ? 's' : ''}.\n\n` +
                      `A cada quantas horas esse parceiro poderá postar?`,
                footer: 'SYSTEM-SONIC | Parcerias',
                interactiveButtons: [
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: '12 HORAS',
                            id: 'parceria_interval_12'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: '24 HORAS',
                            id: 'parceria_interval_24'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: '48 HORAS',
                            id: 'parceria_interval_48'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: '72 HORAS',
                            id: 'parceria_interval_72'
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'PERSONALIZAR',
                            id: 'parceria_interval_custom'
                        })
                    }
                ]
            }, { quoted: m });

            return true;
        }

        if (setup.step === 'await_custom_interval') {

            const horasIntervalo = parseInt(texto);

            if (isNaN(horasIntervalo) || horasIntervalo <= 0 || horasIntervalo > 8760) {
                await sock.sendMessage(from, {
                    text: '*Ops!* Digite apenas um número válido de horas maior que zero.\n\nExemplo: *6*'
                }, { quoted: m });
                return true;
            }

            const partnerJid = setup.data?.partnerJid;
            const maxLinks = setup.data?.maxLinks;

            // Segurança — dados incompletos
            if (!partnerJid || !maxLinks) {
                await sock.sendMessage(from, {
                    text: '*Erro!* Dados da parceria incompletos.\n\n' +
                          'Use o comando novamente para reiniciar.'
                }, { quoted: m });
                limparEtapaParceria(from);
                return true;
            }

            // Salvar parceria e limpar setup
            adicionarParceria(from, partnerJid, maxLinks, horasIntervalo);
            limparEtapaParceria(from);

            await sock.sendMessage(from, {
                text: `*PARCERIA ADICIONADA COM SUCESSO!*\n\n` +
                      `— definições do novo parceiro —\n` +
                      `*Parceiro:* @${partnerJid.split('@')[0]}\n` +
                      `*Links permitidos:* ${maxLinks} link${maxLinks > 1 ? 's' : ''}\n` +
                      `*Intervalo:* a cada ${horasIntervalo} hora${horasIntervalo > 1 ? 's' : ''}`,
                mentions: [partnerJid],
                footer: 'SYSTEM-SONIC | Parcerias'
            }, { quoted: m });

            return true;
        }

        return false;

    } catch (error) {
        console.error('[PARCERIA-MENCAO] Erro no listener:', error.message);
        console.error('[PARCERIA-MENCAO] Stack:', error.stack);
        return false;
    }
}

module.exports = listenerParceriaMencao;