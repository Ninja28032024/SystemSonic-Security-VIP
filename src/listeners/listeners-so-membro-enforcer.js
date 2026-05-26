// src/listeners/listeners-so-membro-enforcer.js
// Intercepta comandos em grupos com so-membro ativo.
// Deixa passar: membros do grupo + dono do bot.
// Bloqueia: quem não é membro do grupo.

const path = require('path');
const { isOwner, isSameUser } = require(path.join(__dirname, '..', 'utils.js'));
const { isSoMembroAtivo } = require(path.join(__dirname, '..', 'lib', 'so-membro-state', 'so-membro-state.js'));

function extrairComando(m, prefixo) {
    const texto =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        '';
    if (!texto.startsWith(prefixo)) return null;
    return texto.slice(prefixo.length).trim().split(/\s+/)[0].toLowerCase();
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

        // Verifica se o sender é membro do grupo
        const groupMeta = await sock.groupMetadata(from);
        let ehMembro = false;
        for (const p of groupMeta.participants) {
            if (await isSameUser(p.id, sender, sock)) {
                ehMembro = true;
                break;
            }
        }

        if (ehMembro) return false;

        // Não é membro — bloqueia
        await sock.sendMessage(from, {
            text: '*ACESSO RESTRITO⚔️*\nOs comandos do bot estão restritos apenas para membros do grupo.'
        }, { quoted: m });

        return true;

    } catch (error) {
        console.error('[SO-MEMBRO-ENFORCER] Erro:', error.message);
        return false;
    }
}

module.exports = listenerSoMembroEnforcer;
