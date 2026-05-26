// src/lib/bemvindo-handler/bemvindo-handler.js
const path = require('path');
const { obterConfigBemvindo, formatarMensagemBemvindo } = require(path.join(__dirname, '..', 'bemvindo-state', 'bemvindo-state.js'));
const { resolveToJID } = require(path.join(__dirname, '..', '..', 'utils.js'));

const FOTO_PADRAO = 'https://files.catbox.moe/h6xxwf.png';

async function obterFotoUsuario(sock, userId) {
    try {
        return await sock.profilePictureUrl(userId, 'image');
    } catch (e) {
        return null;
    }
}

async function processarNovoMembro(sock, update) {
    try {
        if (!update || !update.id || !update.participants || update.action !== 'add') return;

        const groupId = update.id;
        const configAtual = obterConfigBemvindo(groupId);
        if (!configAtual || !configAtual.ativo) return;

        const groupMeta = await sock.groupMetadata(groupId);
        const nomeGrupo = groupMeta.subject || 'Grupo';
        const descricaoGrupo = groupMeta.desc || '';
        const totalMembros = groupMeta.participants?.length || 0;

        for (const participante of update.participants) {
            // participants pode chegar como objeto {id, phoneNumber, admin} ou string simples
            const lidOuPn = typeof participante === 'object'
                ? (participante.phoneNumber || participante.id)
                : participante;

            // Resolver sempre para @s.whatsapp.net para menções e comandos
            const novoMemberId = await resolveToJID(lidOuPn, sock) || lidOuPn;
            const lidReal = typeof participante === 'object' ? participante.id : participante;
            const numeroUsuario = novoMemberId.split('@')[0];

            const fotoUrl = await obterFotoUsuario(sock, novoMemberId);
            const temFoto = fotoUrl !== null;

            const legenda = configAtual.legenda && configAtual.legenda.trim() !== ''
                ? configAtual.legenda
                : 'Bem-vindo ao @grupo, @user! Você é o membro número @membros.';

            const mensagemFormatada = formatarMensagemBemvindo(
                legenda,
                novoMemberId,
                nomeGrupo,
                numeroUsuario,
                lidReal,
                descricaoGrupo,
                totalMembros,
                temFoto
            );

            const urlImagem = fotoUrl || FOTO_PADRAO;

            try {
                await sock.sendMessage(groupId, {
                    image: { url: urlImagem },
                    caption: mensagemFormatada,
                    mentions: [novoMemberId]
                });
            } catch (imgError) {
                await sock.sendMessage(groupId, {
                    text: mensagemFormatada,
                    mentions: [novoMemberId]
                });
            }
        }

    } catch (error) {
        console.error('[BEMVINDO-HANDLER] Erro ao processar novo membro:', error.message);
    }
}

module.exports = { processarNovoMembro };
