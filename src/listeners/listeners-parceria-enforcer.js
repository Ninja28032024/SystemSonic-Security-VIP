// src/listeners/listeners-parceria-enforcer.js
// Fiscalizador do sistema de parcerias - Remove não-parceiros que postam links

const path = require('path');
const { isUserAdmin, isOwner, isSameUser } = require(path.join(__dirname, '..', 'utils.js'));
const {
    obterStatusSistema,
    obterParceriaPorJid,
    atualizarLinkPostado,
    verificarLimiteExcedido
} = require(path.join(__dirname, '..', 'lib', 'parceria-state', 'parceria-state.js'));

function extrairTextoMensagem(m) {
    if (m.message?.conversation) return m.message.conversation;
    if (m.message?.extendedTextMessage?.text) return m.message.extendedTextMessage.text;
    if (m.message?.imageMessage?.caption) return m.message.imageMessage.caption;
    if (m.message?.videoMessage?.caption) return m.message.videoMessage.caption;
    return '';
}

function contemLink(texto) {
    if (!texto || typeof texto !== 'string') return false;
    const regexLink = /((https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|discord\.gg\/|instagram\.com\/)[^\s]+)/i;
    return regexLink.test(texto);
}

async function deletarMensagem(sock, from, sender, m) {
    try {
        await sock.sendMessage(from, {
            delete: {
                remoteJid: from,
                fromMe: false,
                id: m.key.id,
                participant: m.key.participant || sender
            }
        });
        return true;
    } catch (error) {
        console.error('[PARCERIA-ENFORCER] Erro ao deletar mensagem:', error.message);
        return false;
    }
}

async function removerParticipante(sock, from, sender) {
    try {
        await sock.groupParticipantsUpdate(from, [sender], 'remove');
        return true;
    } catch (error) {
        console.error('[PARCERIA-ENFORCER] Erro ao remover participante:', error.message);
        return false;
    }
}

async function listenerParceriaEnforcer(sock, m, from, sender, options = {}) {
    try {
        if (m.key.fromMe || !from.endsWith('@g.us')) return false;

        // Verificar se o sistema está ativo
        const sistemaAtivo = obterStatusSistema(from);
        if (!sistemaAtivo) return false;

        // Extrair texto e verificar se tem link
        const texto = extrairTextoMensagem(m);
        if (!contemLink(texto)) return false;

        const config = options.config || {};
        const groupMetadata = await sock.groupMetadata(from);

        // Admins e dono sempre podem postar links
        const senderIsOwner = await isOwner(sender, config.ownerNumber, sock);
        const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

        if (senderIsOwner || senderIsAdmin) return false;

        // Verificar se é parceiro
        const parceria = obterParceriaPorJid(from, sender);

        if (!parceria) {
            // SE NÃO É PARCEIRO REMOVE E DELETA MENSAGEM
            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);

            if (botIsAdmin) {
                await deletarMensagem(sock, from, sender, m);
                await removerParticipante(sock, from, sender);

                await sock.sendMessage(from, {
                    text: `*SYSTEM - PARCERIA*\n\n` +
                          `O participante @${sender.split('@')[0]} foi removido por postar link sem ser parceiro autorizado deste grupo.`,
                    mentions: [sender],
                    footer: 'SYSTEM-SONIC | Parcerias'
                });
            } else {
                await sock.sendMessage(from, {
                    text: '*SYSTEM - PARCERIA*\n\n' +
                          'Detectei um link de não-parceiro, mas não sou administrador para remover.'
                });
            }

            return true;
        }

        // É PARCEIRO - VERIFICAR LIMITES
        const verificacao = verificarLimiteExcedido(from, sender);

        if (verificacao.excedido) {
            // EXCEDEU O LIMITE - DELETAR MENSAGEM E AVISAR
            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);

            if (botIsAdmin) {
                await deletarMensagem(sock, from, sender, m);
            }

            await sock.sendMessage(from, {
                text: `*SYSTEM - PARCERIA*\n\n` +
                      `@${sender.split('@')[0]}, você já postou ${verificacao.atual} de ${verificacao.limite} links permitidos.\n\n` +
                      `Aguarde o intervalo de ${parceria.horasIntervalo} horas para postar novamente.`,
                mentions: [sender],
                footer: 'SYSTEM-SONIC | Parcerias'
            });

            return true;
        }

        // ATUALIZAR CONTADOR DE LINKS
        if (verificacao.resetado) {
            await sock.sendMessage(from, {
                text: `*SYSTEM - PARCERIA*\n\n` +
                      `@${sender.split('@')[0]}, seu limite de links foi resetado. Você pode postar novamente.`,
                mentions: [sender]
            });
        }

        atualizarLinkPostado(from, sender);
        return false; // Permite a mensagem

    } catch (error) {
        console.error('[PARCERIA-ENFORCER] Erro no enforcer:', error.message);
        return false;
    }
}

module.exports = listenerParceriaEnforcer;