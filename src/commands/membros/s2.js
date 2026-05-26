const path = require("path");
const fs = require("fs");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");

const execPromise = promisify(exec);

module.exports = {
    name: "s2",
    aliases: ["f2", "sticker2", "achatado"],
    async execute(sock, m, options) {
        const { from, prefixoAtual } = options;

        try {
            // 1. Identificar a mensagem de mídia (marcada ou atual)
            let quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage || m.message;
            let messageType = null;
            let isDocument = false;

            // Mapeamento de tipos de mídia suportados
            const types = {
                image: "imageMessage",
                video: "videoMessage",
                sticker: "stickerMessage",
                document: "documentMessage"
            };

            // Detectar o tipo de mensagem
            for (const key in types) {
                if (quotedMessage[types[key]]) {
                    messageType = types[key];
                    if (key === 'document') isDocument = true;
                    break;
                }
            }

            // Se for documento, validar se o mimetype é imagem ou vídeo
            if (isDocument) {
                const mimetype = quotedMessage.documentMessage.mimetype || "";
                if (!mimetype.includes("image") && !mimetype.includes("video")) {
                    messageType = null; // Descartar se não for imagem/vídeo dentro do documento
                }
            }

            if (!messageType) {
                await sock.sendMessage(from, {
                    text: `❌ Mídia não encontrada ou formato não suportado!\n\nEnvie ou marque uma *Imagem, Vídeo, GIF ou Documento (Imagem/Vídeo)* e use ${prefixoAtual}s2 para criar uma figurinha.`
                }, { quoted: m });
                return;
            }

            const mediaMessage = quotedMessage[messageType];

            // 2. Validar duração se for vídeo (incluindo vídeos em documentos)
            const isVideo = messageType === "videoMessage" || (isDocument && (mediaMessage.mimetype || "").includes("video"));
            if (isVideo) {
                const duration = mediaMessage.seconds || 0;
                if (duration > 9.9) {
                    await sock.sendMessage(from, {
                        text: `❌ O vídeo é muito longo! Máximo permitido: 9,9 segundos.\nDuração detectada: ${duration}s`
                    }, { quoted: m });
                    return;
                }
            }

            await sock.sendMessage(from, { text: "*⏳ Processando figurinha*. Aguarde... 🌀" }, { quoted: m });

            try {
                // 3. Download da mídia
                const { downloadContentFromMessage } = require("@systemzero/baileys");
                
                // Determinar o tipo correto para o download do Baileys
                let downloadType = messageType.replace("Message", "");
                if (isDocument) downloadType = "document";

                const stream = await downloadContentFromMessage(mediaMessage, downloadType);
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                const mediaBuffer = Buffer.concat(chunks);

                // 4. Preparar arquivos temporários
                const tempDir = path.join(os.tmpdir(), "sonic_stickers_v2");
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const timestamp = Date.now();
                const inputFile = path.join(tempDir, `in_${timestamp}.tmp`);
                const outputFile = path.join(tempDir, `out_${timestamp}.webp`);

                fs.writeFileSync(inputFile, mediaBuffer);

                // 5. Chamar processador Python v2
                // Se for vídeo ou GIF (mimetype ou tipo), usa lógica de vídeo
                const isVideoProcess = isVideo || (mediaMessage.mimetype || "").includes("gif");
                const mediaTypeArg = isVideoProcess ? "video" : "image";
                
                const pythonScript = path.join(__dirname, "..", "..", "lib", "sticker_processor_v2.py");
                const pythonCmd = `python3 "${pythonScript}" "${inputFile}" "${outputFile}" "${mediaTypeArg}" "SystemSonic" "Achatado por: SystemSonic"`;

                const { stdout } = await execPromise(pythonCmd);
                const response = JSON.parse(stdout);

                if (response.status !== "success") {
                    throw new Error(response.message);
                }

                // 6. Enviar a figurinha
                const stickerBuffer = fs.readFileSync(outputFile);
                await sock.sendMessage(from, {
                    sticker: stickerBuffer,
                    packName: "SystemSonic",
                    author: "Achatado por: SystemSonic"
                });

                // 7. Limpeza
                try {
                    if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                } catch (e) {}

            } catch (error) {
                console.error("Erro no processamento universal s2:", error);
                await sock.sendMessage(from, {
                    text: "❌ Erro ao converter a mídia. Verifique se o arquivo não está corrompido."
                }, { quoted: m });
            }

        } catch (error) {
            console.error("Erro geral comando s2:", error);
            await sock.sendMessage(from, {
                text: "*Ops!* Ocorreu um erro inesperado ao executar o comando s2."
            }, { quoted: m });
        }
    },
};
