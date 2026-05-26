// src/listeners/listeners-msgtmp-buttons.js
// Listener para processar botões de mensagens temporárias

const path = require('path');
const { isOwner, isUserAdmin } = require(path.join(__dirname, '..', 'utils.js'));

const MSG_SEM_ACESSO = '*Ops! Você não é dono do bot e nem administrador do grupo. Se ponha no seu lugar!*';

function extrairButtonId(m) {
    if (m.message?.templateButtonReplyMessage?.selectedId) {
        return m.message.templateButtonReplyMessage.selectedId;
    }
    if (m.message?.buttonsResponseMessage?.selectedButtonId) {
        return m.message.buttonsResponseMessage.selectedButtonId;
    }
    if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
        try {
            const params = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
            return params.id || null;
        } catch (error) {
            return null;
        }
    }
    return null;
}

async function validarAcesso(sock, from, sender, config) {
    const groupMetadata = await sock.groupMetadata(from);
    const senderIsOwner = await isOwner(sender, config.ownerNumber, sock);
    const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

    if (!senderIsOwner && !senderIsAdmin) {
        return { permitido: false };
    }

    return { permitido: true };
}

async function listenerMsgTmpButtons(sock, m, from, sender, options = {}) {
    try {
        if (m.key.fromMe || !from.endsWith('@g.us')) {
            return false;
        }

        const buttonId = extrairButtonId(m);
        if (!buttonId || !buttonId.startsWith('msgtmp_')) {
            return false;
        }

        const config = options.config || {};
        const acesso = await validarAcesso(sock, from, sender, config);

        // Validar permissão do usuário que clicou
        if (!acesso.permitido) {
            await sock.sendMessage(from, { text: MSG_SEM_ACESSO }, { quoted: m });
            return true;
        }

        const groupMetadata = await sock.groupMetadata(from);
        const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
        if (!botIsAdmin) {
            await sock.sendMessage(from, {
                text: '*Ops! Eu preciso ser administrador para executar esta ação.*'
            }, { quoted: m });
            return true;
        }

        let duration = 0;
        let periodoTexto = '';

        switch (buttonId) {
            case 'msgtmp_set_24h':
                duration = 24 * 60 * 60; // 86400 segundos
                periodoTexto = '24 horas';
                break;
            case 'msgtmp_set_7d':
                duration = 7 * 24 * 60 * 60; // 604800 segundos
                periodoTexto = '7 dias';
                break;
            case 'msgtmp_set_90d':
                duration = 90 * 24 * 60 * 60; // 7776000 segundos
                periodoTexto = '90 dias';
                break;
            case 'msgtmp_disable':
                duration = 0; // Desativar
                break;
            default:
                return false; // Não é um botão que conhecemos
        }

        // Aplicar a configuração
        await sock.groupToggleEphemeral(from, duration);

        if (duration > 0) {
            // Mensagem de ativação
            await sock.sendMessage(from, {
                text: '*STATUS MSG TMP - SYSTEMSONIC SECURITY*\n\n' +
                      `Você definiu mensagens temporárias neste grupo com período de expiração de ${periodoTexto}.`
            }, { quoted: m });
        } else {
            // Mensagem de desativação
            await sock.sendMessage(from, {
                text: '*Sistema de mensagens temporárias desativada com sucesso neste grupo.*'
            }, { quoted: m });
        }

        return true;

    } catch (error) {
        console.error('[MSG-TMP] Erro no listener:', error.message);
        return false;
    }
}

module.exports = listenerMsgTmpButtons;