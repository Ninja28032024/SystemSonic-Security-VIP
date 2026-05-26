// src/listeners/listeners-so-membro-enforcer.js
// Intercepta comandos em grupos com so-membro ativo.
// Deixa passar: membros do grupo + dono do bot.
// Bloqueia: quem não é membro do grupo.

const path = require('path');
const { isOwner, isSameUser, isUserAdmin } = require(path.join(__dirname, '..', 'utils.js'));
const { isSoMembroAtivo } = require(path.join(__dirname, '..', 'lib', 'so-membro-state', 'so-membro-state.js'));

function extrairComando(m, prefixo) {
    const texto =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        '';
    if (!texto.startsWith(prefixo)) return null;
    return texto.slice(prefixo.length).trim().split(/\s+/)[0].toLowerCase();
}

async function reagirBloqueio(sock, m) {
    const emojis = ['💬', '❌'];
    const inicio = Date.now();
    let i = 0;
    while (Date.now() - inicio < 30000) {
        try {
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: emojis[i % 2], key: m.key }
            });
        } catch (_) {}
        await new Promise(r => setTimeout(r, 300));
        i++;
    }
}

async function listenerSoMembroEnforcer(sock, m, from, sender, options = {}) {
    try {
        if (!m?.message || m.key?.fromMe) return false;
        if (!from.endsWith('@g.us')) return false;
        if (!isSoMembroAtivo(from)) return false;

        const prefixo = options.prefixoAtual || '!';
        const cmdName = extrairComando(m, prefixo);

        // Só intercepta comandos
        if (!cmdName) return false;

        // O próprio so-membro sempre passa (para poder desativar)
        if (['so-membro', 'somembro', 'onlymembro', 'only-membro'].includes(cmdName)) return false;

        const config = options.config || {};

        // Dono sempre passa
        const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
        if (senderIsDono) return false;

        // Verifica se é admin — se for, bloqueia
        const groupMeta = await sock.groupMetadata(from);
        const senderIsAdmin = await isUserAdmin(sender, groupMeta, sock);
        if (senderIsAdmin) {
            reagirBloqueio(sock, m); // sem await — roda em background
            return true;
        }

        // Verifica se ao menos é membro do grupo
        let ehMembro = false;
        for (const p of groupMeta.participants) {
            if (await isSameUser(p.id, sender, sock)) { ehMembro = true; break; }
        }

        if (ehMembro) return false;

        // Não é membro — bloqueia
        reagirBloqueio(sock, m); // sem await — roda em background
        return true;

    } catch (error) {
        console.error('[SO-MEMBRO-ENFORCER] Erro:', error.message);
        return false;
    }
}

module.exports = listenerSoMembroEnforcer;
