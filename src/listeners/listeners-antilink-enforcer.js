const path = require("path");
const { isOwner, isUserAdmin } = require(path.join(__dirname, '..', 'utils.js'));
const {
    obterConfiguracao,
    adicionarAdvertencia,
    obterAdvertenciasUsuario,
    zerarAdvertenciasUsuario
} = require(path.join(__dirname, '..', 'lib', 'antilink-state', 'antilink-state.js'));

function extrairTextoMensagem(m) {
    if (m.message?.conversation) {
        return m.message.conversation;
    }

    if (m.message?.extendedTextMessage?.text) {
        return m.message.extendedTextMessage.text;
    }

    if (m.message?.imageMessage?.caption) {
        return m.message.imageMessage.caption;
    }

    if (m.message?.videoMessage?.caption) {
        return m.message.videoMessage.caption;
    }

    if (m.message?.documentMessage?.caption) {
        return m.message.documentMessage.caption;
    }

    if (m.message?.buttonsResponseMessage?.selectedDisplayText) {
        return m.message.buttonsResponseMessage.selectedDisplayText;
    }

    if (m.message?.templateButtonReplyMessage?.selectedDisplayText) {
        return m.message.templateButtonReplyMessage.selectedDisplayText;
    }

    return '';
}

function contemLink(texto) {
    if (!texto || typeof texto !== 'string') {
        return false;
    }

    const regexLink = /((https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|discord\.gg\/|instagram\.com\/|facebook\.com\/|youtube\.com\/|youtu\.be\/|x\.com\/|twitter\.com\/|bit\.ly\/|tinyurl\.com\/)[^\s]+)/i;
    return regexLink.test(texto);
}

async function deletarMensagemInfratora(sock, from, sender, m) {
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
        try {
            await sock.sendMessage(from, {
                delete: {
                    remoteJid: from,
                    fromMe: false,
                    id: m.key.id,
                    participant: sender
                }
            });
            return true;
        } catch (fallbackError) {
            console.error('[ANTILINK] Erro ao deletar mensagem com link:', fallbackError.message);
            return false;
        }
    }
}

async function removerParticipante(sock, from, sender) {
    try {
        await sock.groupParticipantsUpdate(from, [sender], 'remove');
        return true;
    } catch (error) {
        console.error('[ANTILINK] Erro ao remover participante com link:', error.message);
        return false;
    }
}

async function listenerAntilinkEnforcer(sock, m, from, sender, options = {}) {
    try {
        if (m.key.fromMe) {
            return false;
        }

        if (!from.endsWith('@g.us')) {
            return false;
        }

        const configGrupo = obterConfiguracao(from);
        if (!configGrupo || !configGrupo.ativo) {
            return false;
        }

        const texto = extrairTextoMensagem(m);
        if (!contemLink(texto)) {
            return false;
        }

        const config = options.config || {};
        const groupMetadata = await sock.groupMetadata(from);
        const senderIsOwner = await isOwner(sender, config.ownerNumber, sock);
        const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

        if (senderIsOwner || senderIsAdmin) {
            return false;
        }

        const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);

        if (configGrupo.deleteMessage && botIsAdmin) {
            await deletarMensagemInfratora(sock, from, sender, m);
        }

        if (!configGrupo.removeParticipant) {
            await sock.sendMessage(from, {
                text: `*SYSTEM - SECURITY ANTILINK*\nO participante @${sender.split('@')[0]} enviou um link e foi detectado pelo sistema de proteção deste grupo.`,
                mentions: [sender],
                footer: 'SYSTEM-SONIC - Security Antilink'
            }, { quoted: m });
            return true;
        }

        if (!botIsAdmin) {
            await sock.sendMessage(from, {
                text: "*SYSTEM - SECURITY ANTILINK*\nDetectei um link neste grupo, mas não consigo aplicar remoção porque não sou administrador.",
                footer: 'SYSTEM-SONIC - Security Antilink'
            }, { quoted: m });
            return true;
        }

        if (configGrupo.removeImmediately) {
            await removerParticipante(sock, from, sender);
            await sock.sendMessage(from, {
                text: `*SYSTEM - SECURITY ANTILINK*\nO participante @${sender.split('@')[0]} foi removido imediatamente por enviar link neste grupo.`,
                mentions: [sender],
                footer: 'SYSTEM-SONIC - Security Antilink'
            }, { quoted: m });
            return true;
        }

        if (configGrupo.warningMode) {
            const totalAdvertencias = adicionarAdvertencia(from, sender);
            const limite = configGrupo.warningLimit || 2;

            if (totalAdvertencias >= limite) {
                await removerParticipante(sock, from, sender);
                zerarAdvertenciasUsuario(from, sender);
                await sock.sendMessage(from, {
                    text: `*SYSTEM - SECURITY ANTILINK*\nO participante @${sender.split('@')[0]} atingiu ${limite} advertências por links e foi removido do grupo.`,
                    mentions: [sender],
                    footer: 'SYSTEM-SONIC - Security Antilink'
                }, { quoted: m });
                return true;
            }

            const restantes = limite - totalAdvertencias;
            await sock.sendMessage(from, {
                text: `*SYSTEM - SECURITY ANTILINK*\nO participante @${sender.split('@')[0]} recebeu uma advertência por enviar link.\n\n*Advertências atuais:* ${totalAdvertencias}/${limite}\n*Faltam para remoção:* ${restantes}`,
                mentions: [sender],
                footer: 'SYSTEM-SONIC - Security Antilink'
            }, { quoted: m });
            return true;
        }

        const advertenciasAtuais = obterAdvertenciasUsuario(from, sender);
        await sock.sendMessage(from, {
            text: `*SYSTEM - SECURITY ANTILINK*\nO participante @${sender.split('@')[0]} enviou um link e foi detectado pelo sistema.\n\n*Advertências registradas:* ${advertenciasAtuais}`,
            mentions: [sender],
            footer: 'SYSTEM-SONIC - Security Antilink'
        }, { quoted: m });

        return true;
    } catch (error) {
        console.error('Erro no listener de fiscalização do antilink:', error.message);
        return false;
    }
}

module.exports = listenerAntilinkEnforcer;
