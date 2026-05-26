// src/commands/membros/upload.js
// Comando para fazer upload de mídias para catbox.moe

const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@systemzero/baileys');

/**
 * Faz upload de arquivo para catbox.moe
 * @param {Buffer} fileBuffer - Buffer do arquivo
 * @param {string} filename - Nome do arquivo com extensão
 * @returns {Promise<string>} - URL do arquivo hospedado
 */
async function uploadToCatbox(fileBuffer, filename) {
    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', fileBuffer, filename);

        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: {
                ...form.getHeaders()
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        if (response.data && typeof response.data === 'string') {
            const url = response.data.trim();
            
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
            
            throw new Error('Resposta não contém URL válida');
        }

        throw new Error('Resposta inválida do servidor');
    } catch (error) {
        throw error;
    }
}

/**
 * Extrai informações da mídia da mensagem
 * @param {object} message - Mensagem do Baileys
 * @returns {object|null} - Informações da mídia ou null
 */
function getMediaInfo(message) {
    const mediaTypes = [
        { type: 'imageMessage', ext: 'jpg' },
        { type: 'videoMessage', ext: 'mp4' },
        { type: 'audioMessage', ext: 'mp3' },
        { type: 'stickerMessage', ext: 'webp' },
        { type: 'documentMessage', ext: null }
    ];

    for (const media of mediaTypes) {
        if (message[media.type]) {
            const msg = message[media.type];
            
            if (media.type === 'documentMessage') {
                const fileName = msg.fileName || 'document';
                const ext = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
                return {
                    type: media.type,
                    message: msg,
                    ext: ext,
                    fileName: fileName
                };
            }

            return {
                type: media.type,
                message: msg,
                ext: media.ext,
                fileName: `media_${Date.now()}.${media.ext}`
            };
        }
    }

    return null;
}

module.exports = {
    name: 'upload',
    aliases: ['up', 'host'],
    description: 'Faz upload de mídias para catbox.moe',
    usage: 'Marque uma mídia e use o comando',

    async execute(sock, m, options) {
        const { from, sender } = options;

        try {
            const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (!quotedMessage) {
                await sock.sendMessage(from, {
                    text: '*Ops! Você precisa marcar uma mídia para fazer upload.*'
                }, { quoted: m });
                return;
            }

            const mediaInfo = getMediaInfo(quotedMessage);

            if (!mediaInfo) {
                await sock.sendMessage(from, {
                    text: '*Ops! A mensagem marcada não contém uma mídia válida.*'
                }, { quoted: m });
                return;
            }

            // Mensagem de aguardo
            await sock.sendMessage(from, {
                text: '*ESTOU REALIZANDO O UPLOAD DA SUA MÍDIA*\n' +
                      'Estou gerando o link do conteúdo, aguarde alguns instantes...'
            }, { quoted: m });

            // Baixar a mídia
            let mediaBuffer;
            
            // Método 1: Tentar com contextInfo completo
            try {
                const contextInfo = m.message?.extendedTextMessage?.contextInfo;
                
                const quotedMsg = {
                    key: {
                        remoteJid: from,
                        fromMe: false,
                        id: contextInfo?.stanzaId || m.key.id,
                        participant: contextInfo?.participant || sender
                    },
                    message: quotedMessage
                };

                mediaBuffer = await downloadMediaMessage(
                    quotedMsg,
                    'buffer',
                    {},
                    {
                        logger: { level: 'silent' },
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
            } catch (downloadError1) {
                // Método 2: Tentar download simplificado
                const simpleQuoted = {
                    message: quotedMessage
                };

                mediaBuffer = await downloadMediaMessage(
                    simpleQuoted,
                    'buffer',
                    {},
                    {
                        logger: { level: 'silent' },
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
            }

            // Fazer upload para catbox
            const fileName = mediaInfo.fileName || `upload_${Date.now()}.${mediaInfo.ext}`;
            const uploadUrl = await uploadToCatbox(mediaBuffer, fileName);

            // Enviar resposta baseada no tipo de mídia
            if (mediaInfo.type === 'imageMessage') {
                await sock.sendMessage(from, {
                    image: mediaBuffer,
                    caption: `*AQUI ESTÁ O LINK DA SUA MÍDIA*\n\nEste é o link > ${uploadUrl}`
                }, { quoted: m });
            } else if (mediaInfo.type === 'videoMessage') {
                await sock.sendMessage(from, {
                    video: mediaBuffer,
                    caption: `*AQUI ESTÁ O LINK DA SUA MÍDIA*\n\nEste é o link > ${uploadUrl}`
                }, { quoted: m });
            } else if (mediaInfo.type === 'stickerMessage') {
                await sock.sendMessage(from, {
                    sticker: mediaBuffer
                }, { quoted: m });
                
                await sock.sendMessage(from, {
                    text: `*AQUI ESTÁ O LINK DA SUA MÍDIA*\n\nEste é o link > ${uploadUrl}`
                }, { quoted: m });
            } else {
                await sock.sendMessage(from, {
                    text: `*AQUI ESTÁ O LINK DA SUA MÍDIA*\n\nEste é o link > ${uploadUrl}`
                }, { quoted: m });
            }

        } catch (error) {
            await sock.sendMessage(from, {
                text: `*Erro ao fazer upload!*\n\nTente novamente mais tarde.`
            }, { quoted: m });
        }
    }
};