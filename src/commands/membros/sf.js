// CAMINHO: src/commands/membros/figurinha.js

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { exec }     = require('child_process');
const { promisify } = require('util');
const { generateWAMessageFromContent, downloadContentFromMessage } = require('@systemzero/baileys');

const execPromise = promisify(exec);

// ── Estado global (sobrevive ao hot-reload) ───────────────────────────────────
if (!global.__figurinhaSetup) global.__figurinhaSetup = {};
const figurinhaSetup = global.__figurinhaSetup;

// ── Helper: envia mensagem interativa com botões ──────────────────────────────
async function enviarComBotoes(sock, from, texto, footer, botoes, quotedMsg) {
    const msg = generateWAMessageFromContent(from, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    header: { hasMediaAttachment: false },
                    body:   { text: texto },
                    footer: { text: footer },
                    nativeFlowMessage: { buttons: botoes }
                }
            }
        }
    }, { quoted: quotedMsg });
    await sock.relayMessage(from, msg.message, { messageId: msg.key.id });
    return msg; // retorna para guardar a key do bot
}

// ── Processa figurinha com Python ─────────────────────────────────────────────
async function processarFigurinha(sock, from, mediaMessage, messageType, packName, author, quotedMsg) {
    const tempDir = path.join(os.tmpdir(), 'sonic_stickers_custom');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const ts         = Date.now();
    const inputFile  = path.join(tempDir, `in_${ts}.tmp`);
    const outputFile = path.join(tempDir, `out_${ts}.webp`);

    try {
        // Download da mídia
        const downloadType = messageType.replace('Message', '');
        const stream = await downloadContentFromMessage(mediaMessage, downloadType);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        fs.writeFileSync(inputFile, Buffer.concat(chunks));

        const isVideo    = messageType === 'videoMessage';
        const mediaArg   = isVideo ? 'video' : 'image';
        const packArg    = packName.replace(/"/g, '\\"');
        const authorArg  = author.replace(/"/g, '\\"');
        const pyScript   = path.join(__dirname, '..', '..', 'lib', 'sticker_processor.py');
        const cmd        = `python3 "${pyScript}" "${inputFile}" "${outputFile}" "${mediaArg}" "${packArg}" "${authorArg}"`;

        const { stdout } = await execPromise(cmd);
        const response   = JSON.parse(stdout);
        if (response.status !== 'success') throw new Error(response.message);

        const stickerBuffer = fs.readFileSync(outputFile);
        await sock.sendMessage(from, {
            sticker: stickerBuffer,
            packName,
            author
        }, { quoted: quotedMsg });

    } finally {
        try { if (fs.existsSync(inputFile))  fs.unlinkSync(inputFile);  } catch (_) {}
        try { if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); } catch (_) {}
    }
}

// ── Comando principal ─────────────────────────────────────────────────────────
module.exports = {
    name: 'figurinha',
    aliases: ['fig', 'sticker', 'sf'],

    async execute(sock, m, options) {
        const { from, sender } = options;
        const sessionKey = `${from}_${sender}`;

        try {
            // Limpa sessão anterior se existir
            delete figurinhaSetup[sessionKey];

            const msgEnviada = await enviarComBotoes(
                sock, from,
                '*Vamos criar sua figurinha?* Me diga, deseja com nome de pacote e autor?',
                'SYSTEM-SONIC - Figurinhas',
                [
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'SIM', id: `fig_pack_sim_${sessionKey}` }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'NÃO', id: `fig_pack_nao_${sessionKey}` }) }
                ],
                m
            );

            // Guarda a key da mensagem do bot para validar citação
            figurinhaSetup[sessionKey] = {
                etapa: 'aguardando_pack',
                botMsgKey: msgEnviada.key,
                packName: 'SystemSonic',
                author: 'Criado por: SystemSonic'
            };

        } catch (err) {
            console.error('[FIGURINHA] Erro execute:', err);
            await sock.sendMessage(from, { text: '*Ops!* Ocorreu um erro ao iniciar o comando.' }, { quoted: m });
        }
    }
};

// ── Exporta estado e processador para uso no listener ─────────────────────────
module.exports.figurinhaSetup   = figurinhaSetup;
module.exports.enviarComBotoes  = enviarComBotoes;
module.exports.processarFigurinha = processarFigurinha;
