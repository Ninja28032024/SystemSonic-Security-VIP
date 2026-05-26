// src/commands/membros/play.js
// Comando para buscar e baixar músicas do YouTube

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getTempPath(filename) {
    const tempDir = path.join(__dirname, '..', '..', '..', 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    return path.join(tempDir, filename);
}

module.exports = {
    name: 'play',
    aliases: [],
    description: 'Busca e baixa músicas do YouTube',
    usage: '<prefixo>play <nome da música>',

    async execute(sock, m, options) {
        const { from, sender, args, senderName } = options;

        try {
            // Verificar se o usuário forneceu o nome da música
            if (!args || args.length === 0) {
                await sock.sendMessage(from, {
                    text: '*Ops! Você precisa me dizer qual música quer buscar!*\n\n' +
                          '*Exemplo de uso:*\n' +
                          '!play Carol of the Bells\n' +
                          '!play Naruto Shippuden Opening\n\n' +
                          '*Aguardo suas ordens!*'
                }, { quoted: m });
                return;
            }

            const searchQuery = args.join(' ');

            // Enviar mensagem de aguarde
            await sock.sendMessage(from, {
                text: `*Estou buscando* "${searchQuery}" *para você!*\n\n*Aguarde um momento...*`
            }, { quoted: m });

            // Fazer requisição para a API play
            const apiUrl = `https://systemzone.store/api/play?text=${encodeURIComponent(searchQuery)}`;

            const response = await axios.get(apiUrl, { timeout: 60000 });

            // Verificar se a API retornou sucesso
            if (!response.data || !response.data.status) {
                throw new Error(response.data?.error || 'Erro desconhecido na API');
            }

            const data = response.data;

            // Extrair informações
            const title = data.title || 'Desconhecido';
            const author = data.author || 'Desconhecido';
            const duration = data.duration || 'N/A';
            const views = data.views ? data.views.toLocaleString('pt-BR') : 'N/A';
            const thumbnail = data.thumbnail || '';
            const youtubeUrl = data.youtube_url || '';
            const downloadUrl = data.download_url || '';

            // ETAPA 1: ENVIAR MENSAGEM DE INFORMAÇÕES COM BOTÃO
            
            let infoText = `*INFORMAÇÕES DA MÚSICA*\n\n`;
            infoText += `*Título:* ${title}\n`;
            infoText += `*Canal:* ${author}\n`;
            infoText += `*Duração:* ${duration}\n`;
            infoText += `*Visualizações:* ${views}`;

            await sock.sendMessage(from, {
                text: infoText,
                footer: "SYSTEM-SONIC | Play",
                interactiveButtons: [
                    {
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                            display_text: "VISITE O YOUTUBE",
                            url: youtubeUrl
                        })
                    }
                ]
            }, { quoted: m });

            // Pequena pausa para garantir processamento
            await sleep(500);

            // ETAPA 2: BAIXAR E ENVIAR O ÁUDIO

            // Baixar o áudio
            const audioResponse = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 120000
            });

            // Salvar áudio temporariamente
            const audioPath = getTempPath(`play_${Date.now()}.mp3`);
            fs.writeFileSync(audioPath, audioResponse.data);

            // Baixar thumbnail se disponível
            let thumbnailBuffer = null;
            if (thumbnail) {
                try {
                    const thumbResponse = await axios.get(thumbnail, {
                        responseType: 'arraybuffer',
                        timeout: 10000
                    });
                    thumbnailBuffer = thumbResponse.data;
                } catch (thumbError) {
                    console.error('[PLAY] Erro ao baixar thumbnail:', thumbError.message);
                }
            }

            // Enviar áudio com informações
            await sock.sendMessage(from, {
                audio: fs.readFileSync(audioPath),
                mimetype: 'audio/mpeg',
                ptt: false,
                contextInfo: {
                    externalAdReply: {
                        title: title,
                        body: `Por ${author}`,
                        thumbnail: thumbnailBuffer,
                        mediaType: 2,
                        mediaUrl: youtubeUrl,
                        sourceUrl: youtubeUrl
                    }
                }
            }, { quoted: m });

            // Limpar arquivo temporário
            try {
                fs.unlinkSync(audioPath);
            } catch (e) {
                console.error('[PLAY] Erro ao limpar arquivo:', e.message);
            }

        } catch (error) {
            console.error('[PLAY] Erro ao buscar música:', error.message);

            let errorMessage = `*❌ Ocorreu um erro ao buscar a música!*\n\n`;

            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorMessage += `*Motivo:* A busca demorou demais e expirou o tempo limite.\n\n*Tente novamente com outro termo de busca.*`;
            } else if (error.response?.status === 404) {
                errorMessage += `*Motivo:* Não foi possível encontrar esta música.\n\n*Tente com outro nome ou artista.*`;
            } else if (error.message.includes('404')) {
                errorMessage += `*Motivo:* Música não encontrada.\n\n*Verifique o nome e tente novamente.*`;
            } else {
                errorMessage += `*Detalhes:* ${error.message}\n\n*Tente novamente em alguns instantes.*`;
            }

            await sock.sendMessage(from, {
                text: errorMessage
            }, { quoted: m });
        }
    }
};