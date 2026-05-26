// settings/config.js
// Sistema de configuração dinâmico que funciona como um banco de dados
// Relê o config.json a cada acesso, sem necessidade de reiniciar o bot

const fs = require('fs');
const path = require('path');

// Caminho para o arquivo config.json (agora na mesma pasta)
const CONFIG_JSON_PATH = path.join(__dirname, 'config.json');

// Caminho para a pasta de autenticação, que está na pasta 'database'
const AUTH_DIR = path.join(__dirname, '..', 'database', 'SystemSonic-QR');

/**
 * Carrega as configurações do JSON de forma dinâmica
 * Funciona como um banco de dados, relendo o arquivo a cada chamada
 * 
 * @returns {Object} Objeto com as configurações atualizadas
 */
function obterConfig() {
    try {
        if (fs.existsSync(CONFIG_JSON_PATH)) {
            const conteudo = fs.readFileSync(CONFIG_JSON_PATH, 'utf8');
            return JSON.parse(conteudo);
        } else {
            console.error("ERRO: O arquivo config.json não foi encontrado em /settings. Crie-o antes de continuar.");
            process.exit(1);
        }
    } catch (error) {
        console.error("ERRO ao ler config.json:", error.message);
        return {};
    }
}

/**
 * Carrega as configurações iniciais (apenas uma vez)
 * Mantém compatibilidade com código que espera um objeto config
 */
let config = obterConfig();

/**
 * Função para salvar as configurações
 * Escreve no arquivo JSON para persistência
 * 
 * @param {Object} novasConfigs - Configurações a serem salvas (opcional)
 */
const saveConfig = (novasConfigs = null) => {
    try {
        if (novasConfigs) {
            config = { ...config, ...novasConfigs };
        }
        fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error("ERRO ao salvar config.json:", error.message);
    }
};

/**
 * Getter dinâmico para o prefixo
 * Relê o config.json a cada acesso
 * 
 * @returns {string} Prefixo atual do bot
 */
function obterPrefixo() {
    try {
        const configAtual = obterConfig();
        return configAtual.prefix || '!';
    } catch (error) {
        console.error("ERRO ao obter prefixo:", error.message);
        return '!';
    }
}

/**
 * Setter para o prefixo
 * Atualiza o config.json e a variável config
 * 
 * @param {string} novoPrefixo - Novo prefixo a ser definido
 */
function definirPrefixo(novoPrefixo) {
    try {
        config.prefix = novoPrefixo;
        saveConfig();
    } catch (error) {
        console.error("ERRO ao definir prefixo:", error.message);
    }
}

/**
 * Getter dinâmico para o número do dono
 * Relê o config.json a cada acesso
 * 
 * @returns {string} Número do dono
 */
function obterOwnerNumber() {
    try {
        const configAtual = obterConfig();
        return configAtual.ownerNumber || '';
    } catch (error) {
        console.error("ERRO ao obter ownerNumber:", error.message);
        return '';
    }
}

/**
 * Getter dinâmico para toda a configuração
 * Relê o config.json a cada acesso (funciona como banco de dados)
 * 
 * @returns {Object} Objeto com todas as configurações atualizadas
 */
function obterConfigCompleta() {
    return obterConfig();
}

module.exports = {
    AUTH_DIR,
    config,           // Mantém compatibilidade com código existente
    saveConfig,       // Função para salvar
    obterConfig,      // Função para obter config dinâmico
    obterPrefixo,     // Getter para prefixo dinâmico
    definirPrefixo,   // Setter para prefixo dinâmico
    obterOwnerNumber, // Getter para owner number dinâmico
    obterConfigCompleta // Getter para config completo dinâmico
};
