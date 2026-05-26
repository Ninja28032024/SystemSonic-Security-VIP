/**
 * Módulo de Similaridade de Comandos
 * Utiliza o algoritmo de Levenshtein para calcular a distância entre strings
 * e encontrar o comando mais semelhante a um comando digitado incorretamente
 */

/**
 * Calcula a distância de Levenshtein entre duas strings
 * A distância de Levenshtein é o número mínimo de edições (inserção, deleção, substituição)
 * necessárias para transformar uma string em outra
 * 
 * @param {string} str1 - Primeira string
 * @param {string} str2 - Segunda string
 * @returns {number} Distância de Levenshtein
 */
function calcularDistanciaLevenshtein(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Criar matriz de programação dinâmica
    const matriz = Array(len1 + 1)
        .fill(null)
        .map(() => Array(len2 + 1).fill(0));
    
    // Inicializar primeira linha e coluna
    for (let i = 0; i <= len1; i++) {
        matriz[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
        matriz[0][j] = j;
    }
    
    // Preencher a matriz
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const custo = str1[i - 1] === str2[j - 1] ? 0 : 1;
            
            matriz[i][j] = Math.min(
                matriz[i - 1][j] + 1,      // Deleção
                matriz[i][j - 1] + 1,      // Inserção
                matriz[i - 1][j - 1] + custo  // Substituição
            );
        }
    }
    
    return matriz[len1][len2];
}

/**
 * Calcula a similaridade entre duas strings em percentual (0-100)
 * Quanto maior o valor, mais semelhantes são as strings
 * 
 * @param {string} str1 - Primeira string
 * @param {string} str2 - Segunda string
 * @returns {number} Percentual de similaridade (0-100)
 */
function calcularSimilaridade(str1, str2) {
    const str1Lower = str1.toLowerCase();
    const str2Lower = str2.toLowerCase();
    
    const maxLen = Math.max(str1Lower.length, str2Lower.length);
    if (maxLen === 0) return 100;
    
    const distancia = calcularDistanciaLevenshtein(str1Lower, str2Lower);
    const similaridade = ((maxLen - distancia) / maxLen) * 100;
    
    return Math.round(similaridade);
}

/**
 * Encontra o comando mais semelhante a um comando digitado incorretamente
 * 
 * @param {string} comandoDigitado - Comando digitado incorretamente
 * @param {Array} comandosDisponiveis - Array com todos os comandos disponíveis
 * @param {number} limiarMinimo - Similaridade mínima para considerar (padrão: 50%)
 * @returns {Object|null} Objeto com {comando, similaridade} ou null se não houver match
 */
function encontrarComandoMaisSemelhante(comandoDigitado, comandosDisponiveis, limiarMinimo = 50) {
    if (!comandoDigitado || !comandosDisponiveis || comandosDisponiveis.length === 0) {
        return null;
    }
    
    let melhorMatch = null;
    let maiorSimilaridade = limiarMinimo;
    
    for (const comando of comandosDisponiveis) {
        const similaridade = calcularSimilaridade(comandoDigitado, comando);
        
        if (similaridade > maiorSimilaridade) {
            maiorSimilaridade = similaridade;
            melhorMatch = {
                comando: comando,
                similaridade: similaridade
            };
        }
    }
    
    return melhorMatch;
}

/**
 * Encontra os N comandos mais semelhantes a um comando digitado
 * Útil para oferecer múltiplas sugestões
 * 
 * @param {string} comandoDigitado - Comando digitado incorretamente
 * @param {Array} comandosDisponiveis - Array com todos os comandos disponíveis
 * @param {number} quantidade - Quantidade de sugestões a retornar
 * @param {number} limiarMinimo - Similaridade mínima para considerar
 * @returns {Array} Array com os N comandos mais semelhantes
 */
function encontrarTopComandosSemelhantes(comandoDigitado, comandosDisponiveis, quantidade = 3, limiarMinimo = 40) {
    if (!comandoDigitado || !comandosDisponiveis || comandosDisponiveis.length === 0) {
        return [];
    }
    
    const matches = comandosDisponiveis
        .map(comando => ({
            comando: comando,
            similaridade: calcularSimilaridade(comandoDigitado, comando)
        }))
        .filter(match => match.similaridade >= limiarMinimo)
        .sort((a, b) => b.similaridade - a.similaridade)
        .slice(0, quantidade);
    
    return matches;
}

module.exports = {
    calcularDistanciaLevenshtein,
    calcularSimilaridade,
    encontrarComandoMaisSemelhante,
    encontrarTopComandosSemelhantes
};
