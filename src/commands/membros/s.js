const path = require("path");
const fs = require("fs");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");

const execPromise = promisify(exec);

module.exports = {
    name: "s",
    aliases: ["f"],
    async execute(sock, m, options) {
        const { from, prefixoAtual } = options;

        try {
            // Verificar se há uma mensagem marcada
            if (!m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                await sock.sendMessage(from, {
                    text: `❌ Marque uma imagem, GIF ou vídeo (até 9,9s) para criar uma figurinha!\n\nExemplo: Marque uma mídia e responda com ${prefixoAtual}s ou ${prefixoAtual}f`
                }, { quoted: m });
                return;
            }

            const quotedMessage = m.message.extendedTextMessage.contextInfo.quotedMessage;

            // Detectar tipo de mensagem
            let messageType = null;
            if (quotedMessage.imageMessage) {
                messageType = "imageMessage";
            } else if (quotedMessage.videoMessage) {
                messageType = "videoMessage";
            } else if (quotedMessage.stickerMessage) {
                messageType = "stickerMessage";
            }

            // Validar tipo de mídia suportado
            if (!messageType) {
                await sock.sendMessage(from, {
                    text: `❌ A mensagem marcada não é uma imagem, GIF ou vídeo!\n\nMarque uma mídia válida e tente novamente.`
                }, { quoted: m });
                return;
            }

            // Extrair a mensagem de mídia
            const mediaMessage = quotedMessage[messageType];

            // Verificar duração do vídeo (se for vídeo)
            if (messageType === "videoMessage") {
                const duration = mediaMessage.seconds || 0;
                if (duration > 9.9) {
                    await sock.sendMessage(from, {
                        text: `❌ O vídeo é muito longo! Máximo permitido: 9,9 segundos.\nDuração do vídeo: ${duration}s`
                    }, { quoted: m });
                    return;
                }
            }

            // Enviar mensagem de processamento
            await sock.sendMessage(from, {
                text: "⏳ Processando figurinha... aguarde!"
            }, { quoted: m });

            try {
                // Baixar a mídia usando a API nativa do Baileys
                let mediaBuffer;

                try {
                    const { downloadContentFromMessage } = require("@systemzero/baileys");
                    const stream = await downloadContentFromMessage(mediaMessage, messageType.replace("Message", ""));
                    const chunks = [];
                    for await (const chunk of stream) {
                        chunks.push(chunk);
                    }
                    mediaBuffer = Buffer.concat(chunks);
                } catch (downloadError) {

                    throw new Error("Não foi possível baixar a mídia");
                }



                // Criar diretório temporário
                const tempDir = path.join(os.tmpdir(), "sonic_stickers");
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const timestamp = Date.now();
                const inputFile = path.join(tempDir, `input_${timestamp}.tmp`);
                const outputFile = path.join(tempDir, `sticker_${timestamp}.webp`);

                // Salvar buffer em arquivo temporário
                fs.writeFileSync(inputFile, mediaBuffer);

                // Determinar tipo de mídia para Python
                let mediaType = "image";
                if (messageType === "videoMessage") {
                    mediaType = "video";
                }

                // Chamar script Python para processar figurinha
                const pythonScript = path.join(__dirname, "..", "..", "lib", "sticker_processor.py");
                const pythonCmd = `python3 "${pythonScript}" "${inputFile}" "${outputFile}" "${mediaType}" "SystemSonic" "Criado por: SystemSonic"`;

                try {
                    const { stdout, stderr } = await execPromise(pythonCmd);
                    
                    // Parsear resposta JSON do Python
                    const response = JSON.parse(stdout);
                    
                    if (response.status !== "success") {
                        throw new Error(response.message);
                    }



                    // Verificar se o arquivo foi criado
                    if (!fs.existsSync(outputFile)) {
                        throw new Error("Arquivo WebP não foi gerado pelo Python");
                    }

                    // Ler o arquivo gerado
                    const stickerBuffer = fs.readFileSync(outputFile);



                    // Enviar a figurinha usando a API nativa do Baileys com metadados
                    await sock.sendMessage(from, {
                        sticker: stickerBuffer,
                        packName: "SystemSonic",
                        author: "Criado por: SystemSonic"
                    });



                    // Limpar arquivos temporários
                    try {
                        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                    } catch (cleanupError) {
                        // Silenciosamente ignorar erros de limpeza
                    }

                } catch (pythonError) {

                    
                    // Limpar arquivos temporários em caso de erro
                    try {
                        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                    } catch (cleanupError) {
                        // Silenciosamente ignorar erros de limpeza
                    }

                    throw pythonError;
                }

            } catch (error) {
                await sock.sendMessage(from, {
                    text: "❌ Erro ao processar a mídia. Tente novamente!"
                }, { quoted: m });
            }
        } catch (error) {
            await sock.sendMessage(from, {
                text: "💥 OPS! DEU ERRO\n\nErro ao executar comando s."
            }, { quoted: m });
        }
    },
};
