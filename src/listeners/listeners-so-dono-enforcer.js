// src/listeners/listeners-so-dono-enforcer.js
// Intercepta comandos em grupos com so-dono ativo.
// Deixa passar: apenas o dono do bot.
// Bloqueia: todos os outros (membros e admins).

const path = require('path');
const { isOwner } = require(path.join(__dirname, '..', 'utils.js'));
const { isSoDonoAtivo } = require(path.join(__dirname, '..', 'lib', 'so-dono-state', 'so-dono-state.js'));

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
    while (Date.now() - inicio < 5000) {
        try {
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: emojis[i % 2], key: m.key }
            });
        } catch (_) {}
        await new Promise(r => setTimeout(r, 300));
        i++;
    }
}

async function listenerSoDonoEnforcer(sock, m, from, sender, options = {}) {
    try {
        if (!m?.message || m.key?.fromMe) return false;
        if (!from.endsWith('@g.us')) return false;
        if (!isSoDonoAtivo(from)) return false;

        const prefixo = options.prefixoAtual || '!';
        const cmdName = extrairComando(m, prefixo);

        // Só intercepta comandos
        if (!cmdName) return false;

        // O próprio so-dono sempre passa (para poder desativar)
        if (['so-dono', 'sodono', 'onlydono', 'only-dono'].includes(cmdName)) return false;

        const config = options.config || {};

        // Dono sempre passa
        const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
        if (senderIsDono) return false;

        // Todos os outros — bloqueia
        reagirBloqueio(sock, m); // sem await — roda em background
        return true;

    } catch (error) {
        console.error('[SO-DONO-ENFORCER] Erro:', error.message);
        return false;
    }
}

module.exports = listenerSoDonoEnforcer;
