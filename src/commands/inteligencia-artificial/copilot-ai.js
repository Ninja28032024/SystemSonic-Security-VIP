const path = require("path");
const fs = require("fs");
const { config } = require(path.join(__dirname, '..', '..', '..', 'settings', 'config.js'));
const { isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));

// ========== SISTEMA DE DATABASE ==========
const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'copilot');

// Criar diretório se não existir
if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

const STATUS_FILE = path.join(DATABASE_DIR, 'status.json');
const HISTORY_FILE = path.join(DATABASE_DIR, 'history.json');

/**
 * Carrega o arquivo de status
 */
function loadStatus() {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const data = fs.readFileSync(STATUS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Erro ao carregar status:', e.message);
    }
    return {};
}

/**
 * Salva o arquivo de status
 */
function saveStatus(data) {
    try {
        if (!fs.existsSync(DATABASE_DIR)) {
            fs.mkdirSync(DATABASE_DIR, { recursive: true });
        }
        fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Erro ao salvar status:', e.message);
    }
}

/**
 * Obtém o status do copilot para um grupo
 */
function getStatusCopilot(groupId) {
    const status = loadStatus();
    const statusAtual = status[groupId] === true;
    return statusAtual;
}

/**
 * Define o status do copilot para um grupo
 */
function setStatusCopilot(groupId, isActive) {
    const status = loadStatus();
    status[groupId] = isActive === true;
    saveStatus(status);
}

/**
 * Carrega o histórico
 */
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Erro ao carregar histórico:', e.message);
    }
    return [];
}

/**
 * Salva o histórico
 */
function saveHistory(data) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Erro ao salvar histórico:', e.message);
    }
}

/**
 * Adiciona uma entrada ao histórico
 */
function addHistoryEntry(groupId, pergunta, resposta, userId) {
    const history = loadHistory();
    history.push({
        groupId,
        userId,
        pergunta,
        resposta,
        timestamp: new Date().toISOString()
    });
    saveHistory(history);
}

// ========== API DA IA ==========
const IA_API_URL = "https://okarun-api.com.br/api/ia/gpt";
const IA_API_KEY = "NinjaTechDevelop";

// API Secundária (Fallback)
const IA_API_FALLBACK_URL = "https://systemzone.store/api/copilot";

/**
 * Faz uma requisição à API de IA usando fetch
 * @param {string} query - Pergunta/prompt para a IA
 * @returns {Promise<string>} - Resposta da IA
 */
async function consultarIA(query) {
    try {
        // Tentar API Principal
        console.log('🔄 Tentando API principal do Copilot...');
        const url = new URL(IA_API_URL);
        url.searchParams.append('query', query);
        url.searchParams.append('apikey', IA_API_KEY);
        
        const response = await fetch(url.toString(), {
            method: 'GET',
            timeout: 10000
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data && data.result) {
                console.log('✅ Resposta recebida da API principal');
                // Remove o nome do criador da resposta
                let resultado = data.result;
                resultado = resultado.replace(/Paulo Mods/gi, "");
                resultado = resultado.trim();
                return resultado;
            }
        }
        
        // Se a API principal falhar, tentar API Fallback
        console.log('⚠️ API principal falhou, tentando API de fallback...');
        return await consultarIAFallback(query);
        
    } catch (error) {
        console.error("❌ Erro ao consultar IA principal:", error.message);
        // Tentar API Fallback em caso de erro
        console.log('⚠️ Tentando API de fallback após erro...');
        return await consultarIAFallback(query);
    }
}

/**
 * Faz uma requisição à API de IA Fallback (secundária)
 * @param {string} query - Pergunta/prompt para a IA
 * @returns {Promise<string>} - Resposta da IA
 */
async function consultarIAFallback(query) {
    try {
        const url = new URL(IA_API_FALLBACK_URL);
        url.searchParams.append('text', query);
        
        const response = await fetch(url.toString(), {
            method: 'GET',
            timeout: 10000
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data && data.result) {
                console.log('✅ Resposta recebida da API de fallback');
                let resultado = data.result;
                // Remove menções de criadores/watermarks
                resultado = resultado.replace(/Apocalypse System/gi, "");
                resultado = resultado.replace(/Paulo Mods/gi, "");
                resultado = resultado.trim();
                return resultado;
            }
        }
        
        console.error('❌ API de fallback retornou resposta inválida');
        return "Desculpe, não consegui processar sua pergunta no momento. Ambas as APIs estão indisponíveis.";
        
    } catch (error) {
        console.error("❌ Erro ao consultar IA Fallback:", error.message);
        return "Desculpe, houve um erro ao processar sua pergunta. As APIs estão indisponíveis.";
    }
}

// ========== COMANDO ==========
module.exports = {
    name: "copilot-ai",
    aliases: ["copilot", "ia"],
    async execute(sock, m, options) {
        const { from, sender, isGroup } = options;

        try {
            // Verificar se é o dono
            const isDono = await isOwner(sender, config.ownerNumber, sock);
            if (!isDono) {
                await sock.sendMessage(from, {
                    text: "*ACESSO RESTRITO AO MEU DONO🛡️*\nEste comando só pode ser usado pelo meu dono."
                }, { quoted: m });
                return;
            }

            // Comando só funciona em grupos
            if (!isGroup) {
                await sock.sendMessage(from, {
                    text: "Este comando só funciona em grupos!"
                }, { quoted: m });
                return;
            }

            const statusAtual = getStatusCopilot(from);

            const statusTexto = statusAtual ? "ATIVADO" : "DESATIVADO";
            const botaoTexto = statusAtual ? "DESATIVAR" : "ATIVAR";

            const mensagem = `*COPILOT AI ${statusTexto}*\nClique no botão abaixo para alternar`;

            try {
                await sock.sendMessage(from, {
                    text: mensagem,
                    footer: "SYSTEM-SONIC - Copilot AI",
                    interactiveButtons: [
                        {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: botaoTexto,
                                id: `copilot_${statusAtual ? 'desativar' : 'ativar'}_${from}`
                            })
                        }
                    ]
                }, { quoted: m });
            } catch (error) {
                console.error("Erro ao enviar mensagem do copilot:", error.message);
                await sock.sendMessage(from, {
                    text: "Erro ao processar comando do copilot."
                }, { quoted: m });
            }
        } catch (error) {
            console.error("Erro copilot-ai:", error.message);
            await sock.sendMessage(from, {
                text: "Erro ao processar comando do copilot."
            }, { quoted: m });
        }
    }
};

// Exportar funções para uso em listeners
module.exports.consultarIA = consultarIA;
module.exports.getStatusCopilot = getStatusCopilot;
module.exports.setStatusCopilot = setStatusCopilot;
module.exports.addHistoryEntry = addHistoryEntry;
