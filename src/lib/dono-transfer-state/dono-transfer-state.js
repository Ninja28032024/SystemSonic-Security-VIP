// src/lib/dono-transfer-state/dono-transfer-state.js
// Banco de dados para o sistema de transferência de dono (setdono)

const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');

const DATABASE_DIR  = path.join(__dirname, '..', '..', '..', 'database', 'dono-transfer');
const TRANSFER_FILE = path.join(DATABASE_DIR, 'historico.json');

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

// ────────────────────────────────────────────────
//  Helpers de I/O
// ────────────────────────────────────────────────

function carregarHistorico() {
    try {
        if (fs.existsSync(TRANSFER_FILE)) {
            return JSON.parse(fs.readFileSync(TRANSFER_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[DONO-TRANSFER] Erro ao carregar histórico:', e.message);
    }
    return {};
}

function salvarHistorico(data) {
    try {
        fs.writeFileSync(TRANSFER_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('[DONO-TRANSFER] Erro ao salvar histórico:', e.message);
    }
}

// ────────────────────────────────────────────────
//  Geração de Token
// ────────────────────────────────────────────────

/**
 * Gera um token hexadecimal de 64 caracteres (256 bits).
 */
function gerarToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ────────────────────────────────────────────────
//  API pública
// ────────────────────────────────────────────────

/**
 * Registra (ou atualiza) uma transferência de dono.
 *
 * @param {string} anteriorPn   - Número PN do ex-dono (ex: "5511999...")
 * @param {string} anteriorLid  - JID LID do ex-dono (ou null)
 * @param {string} novoDonoPn   - Número digitado para o novo dono (exatamente como o usuário informou)
 * @returns {{ token: string, dataHora: string }} Token gerado e timestamp ISO
 */
function registrarTransferencia(anteriorPn, anteriorLid, novoDonoPn) {
    const historico = carregarHistorico();
    const token     = gerarToken();
    const dataHora  = new Date().toISOString();

    // A chave é o número PN do ex-dono (sem @s.whatsapp.net)
    historico[anteriorPn] = {
        anteriorPn,
        anteriorLid: anteriorLid || null,
        novoDonoPn,
        token,
        dataHora,
    };

    salvarHistorico(historico);
    return { token, dataHora };
}

/**
 * Verifica se um número/JID já foi dono alguma vez (está no histórico).
 *
 * @param {string} pnOuJid - Número puro (ex: "5511...") ou JID (@s.whatsapp.net / @lid)
 * @returns {object|null} Registro de histórico ou null
 */
function obterRegistroPorPn(pnOuJid) {
    const pn = pnOuJid.split('@')[0].split(':')[0];
    const historico = carregarHistorico();
    return historico[pn] || null;
}

/**
 * Valida o token para um ex-dono.
 *
 * @param {string} pnOuJid - Número/JID do ex-dono
 * @param {string} tokenInformado - Token digitado pelo usuário
 * @returns {boolean}
 */
function validarToken(pnOuJid, tokenInformado) {
    const registro = obterRegistroPorPn(pnOuJid);
    if (!registro) return false;
    return registro.token === tokenInformado.trim();
}

/**
 * Remove o registro de um ex-dono (após ele recuperar o acesso,
 * ele volta a ser dono ativo — o próximo setdono vai gerar novo token).
 *
 * @param {string} pnOuJid
 */
function removerRegistro(pnOuJid) {
    const pn = pnOuJid.split('@')[0].split(':')[0];
    const historico = carregarHistorico();
    delete historico[pn];
    salvarHistorico(historico);
}

module.exports = {
    gerarToken,
    registrarTransferencia,
    obterRegistroPorPn,
    validarToken,
    removerRegistro,
};
