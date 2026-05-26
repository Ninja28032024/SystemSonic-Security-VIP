/**
 * Listener de Processamento de Correção de Comando
 * Processa quando o usuário clica no botão de sugestão de comando corrigido
 */

const path = require('path');

/**
 * Extrai o ID do botão de uma mensagem interativa
 * Suporta múltiplos formatos de resposta da Baileys
 * 
 * @param {Object} m - Objeto da mensagem
 * @returns {string|null} ID do botão ou null
 */
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

/**
 * Listener para processar cliques na sugestão de comando
 * Quando o usuário clica no botão, o comando sugerido é executado automaticamente
 * 
 * @param {Object} sock - Socket da Baileys
 * @param {Object} m - Objeto da mensagem
 * @param {string} from - JID do grupo/chat
 * @param {string} sender - JID do remetente
 * @param {Object} options - Opções com contexto do bot
 * @returns {boolean} true se processou, false caso contrário
 */
async function listenerCorrecaoButton(sock, m, from, sender, options = {}) {
    try {
        // Ignorar mensagens do próprio bot
        if (m.key.fromMe) {
            return false;
        }
        
        // Extrair ID do botão
        const buttonId = extrairButtonId(m);
        
        // Verificar se é um botão de correção
        if (!buttonId || !buttonId.startsWith('correcao_')) {
            return false;
        }
        
        // Extrair o comando sugerido
        const comandoSugerido = buttonId.replace('correcao_', '').toLowerCase();
        
        if (!comandoSugerido) {
            return false;
        }
        
        // Obter mapa de comandos
        const comandosMap = options.comandosMap || new Map();
        const prefixoAtual = options.prefixoAtual || '!';
        
        // Procurar o comando no mapa
        let comando = null;
        let nomeComando = null;
        
        // Primeiro, procurar pelo nome exato
        if (comandosMap.has(comandoSugerido)) {
            comando = comandosMap.get(comandoSugerido);
            nomeComando = comandoSugerido;
        } else {
            // Procurar pelos aliases
            for (const [nome, cmd] of comandosMap.entries()) {
                if (cmd.aliases && cmd.aliases.includes(comandoSugerido)) {
                    comando = cmd;
                    nomeComando = nome;
                    break;
                }
            }
        }
        
        // Se o comando não existir, algo deu errado
        if (!comando) {
            await sock.sendMessage(from, {
                text: "💥 OPS! DEU ERRO\n\nNão consegui encontrar o comando sugerido. Tente novamente.",
                footer: "SYSTEM-SONIC - Correção de Comandos"
            }, { quoted: m });
            return true;
        }
        
        // Preparar contexto para execução do comando
        const config = options.config || {};
        const isGroup = from.endsWith('@g.us');
        const senderName = m.pushName || 'Usuário';
        
        // Executar o comando sugerido
        try {
            await comando.execute(sock, m, {
                from,
                sender,
                args: [],  // Sem argumentos adicionais
                config,
                prefixoAtual,
                senderName,
                isGroup,
                isUserAdmin: options.isUserAdmin,
                isOwner: options.isOwner,
                registerListener: options.registerListener,
                removeListener: options.removeListener,
                comandosMap
            });
        } catch (cmdError) {
            console.error(`Erro ao executar comando sugerido ${nomeComando}:`, cmdError.message);
            await sock.sendMessage(from, {
                text: `💥 OPS! DEU ERRO\n\nErro ao executar comando ${nomeComando}.`,
                footer: "SYSTEM-SONIC - Correção de Comandos"
            }, { quoted: m });
        }
        
        return true;  // Mensagem processada
        
    } catch (error) {
        console.error('Erro no listener de botão de correção:', error.message);
        return false;
    }
}

module.exports = listenerCorrecaoButton;
