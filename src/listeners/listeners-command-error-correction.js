/**
 * Listener de Correção de Comandos
 * Detecta quando um usuário digita um comando inválido e sugere o comando mais semelhante
 * Utiliza o algoritmo de Levenshtein para calcular a similaridade entre strings
 */

const path = require('path');
const { encontrarComandoMaisSemelhante } = require(path.join(__dirname, '..', 'lib', 'command-similarity', 'command-similarity.js'));

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
 * Extrai o texto da mensagem de múltiplos formatos possíveis
 * 
 * @param {Object} m - Objeto da mensagem
 * @returns {string} Texto extraído ou string vazia
 */
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
    
    return '';
}

/**
 * Listener principal de correção de comandos
 * Detecta comandos inválidos e sugere o comando mais semelhante
 * 
 * @param {Object} sock - Socket da Baileys
 * @param {Object} m - Objeto da mensagem
 * @param {string} from - JID do grupo/chat
 * @param {string} sender - JID do remetente
 * @param {Object} options - Opções com contexto do bot
 * @returns {boolean} true se processou, false caso contrário
 */
async function listenerCommandErrorCorrection(sock, m, from, sender, options = {}) {
    try {
        // Ignorar mensagens do próprio bot
        if (m.key.fromMe) {
            return false;
        }
        
        // Ignorar se não for um comando (não começar com prefixo)
        const prefixoAtual = options.prefixoAtual || '!';
        const texto = extrairTextoMensagem(m);
        
        if (!texto.startsWith(prefixoAtual)) {
            return false;
        }
        
        // Extrair o comando digitado
        const textoSemPrefixo = texto.slice(prefixoAtual.length).trim();
        const partes = textoSemPrefixo.split(/\s+/);
        const comandoDigitado = partes[0].toLowerCase();
        
        // Se não houver comando, ignorar
        if (!comandoDigitado) {
            return false;
        }
        
        // Obter mapa de comandos
        const comandosMap = options.comandosMap || new Map();
        
        // Verificar se o comando existe
        if (comandosMap.has(comandoDigitado)) {
            return false;  // Comando válido, deixar o switch(command).js processar
        }
        
        // Extrair lista de todos os comandos disponíveis (incluindo aliases)
        const todosOsComandos = [];
        for (const [nome, cmd] of comandosMap.entries()) {
            todosOsComandos.push(nome);
            if (cmd.aliases && Array.isArray(cmd.aliases)) {
                todosOsComandos.push(...cmd.aliases);
            }
        }
        
        // Remover duplicatas
        const comandosUnicos = [...new Set(todosOsComandos)];
        
        // Encontrar o comando mais semelhante
        const sugestao = encontrarComandoMaisSemelhante(comandoDigitado, comandosUnicos, 50);
        
        // Se não houver sugestão com similaridade mínima, ignorar
        if (!sugestao) {
            return false;
        }
        
        // Enviar mensagem com sugestão
        await sock.sendMessage(from, {
            text: "*Ops!* Percebi que você errou o comando, o comando que gostaria de executar é este abaixo?",
            interactiveButtons: [
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: sugestao.comando.toUpperCase(),
                        id: `correcao_${sugestao.comando}`
                    })
                }
            ],
            footer: "SYSTEM-SONIC - Correção de Comandos"
        }, { quoted: m });
        
        return true;  // Mensagem processada
        
    } catch (error) {
        console.error('Erro no listener de correção de comandos:', error.message);
        return false;
    }
}

module.exports = listenerCommandErrorCorrection;
