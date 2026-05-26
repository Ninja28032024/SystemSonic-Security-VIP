const path = require("path");

const SPOTIFY_API_URL = "https://okarun-api.com.br/api/spotify/search";
const SPOTIFY_API_KEY = "NinjaTechDevelop";

/**
 * Busca uma música no Spotify usando a API
 * @param {string} query - Termo de busca
 * @returns {Promise<Object|null>} - Primeira música encontrada ou null
 */
async function buscarMusicaSpotify(query) {
    try {
        const url = new URL(SPOTIFY_API_URL);
        url.searchParams.append('query', query);
        url.searchParams.append('apikey', SPOTIFY_API_KEY);

        const response = await fetch(url.toString(), {
            method: 'GET'
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (data && data.resultado && data.resultado.length > 0) {
            return data.resultado[0]; // Retorna o primeiro resultado
        }

        return null;
    } catch (error) {
        console.error("Erro ao buscar música no Spotify:", error.message);
        return null;
    }
}

module.exports = {
    name: "spotify",
    aliases: ["music", "música"],
    async execute(sock, m, options) {
        const { from, args, prefixoAtual } = options;

        try {
            // Verificar se foi fornecido um termo de busca
            if (args.length === 0) {
                await sock.sendMessage(from, {
                    text: `❌ Forneça o nome de uma música!\n\nExemplo: ${prefixoAtual}spotify Gloria Martins`
                }, { quoted: m });
                return;
            }

            const termoBusca = args.join(" ");

            // Enviar mensagem de busca
            const msgBuscando = `*🎵BUSCANDO SUA MÚSICA NO SPOTIFY🎶*\nBuscando ${termoBusca} no spotify para você...`;
            const msgBuscandoEnviada = await sock.sendMessage(from, {
                text: msgBuscando
            }, { quoted: m });

            // Buscar a música
            const musica = await buscarMusicaSpotify(termoBusca);

            if (!musica) {
                await sock.sendMessage(from, {
                    text: `❌ Nenhuma música encontrada para "${termoBusca}".\n\nTente com outro termo!`
                }, { quoted: m });
                return;
            }

            // Extrair informações da música
            const titulo = musica.name;
            const artista = musica.trackArtist;
            const imageUrl = musica.album?.images?.[0];
            const spotifyUrl = musica.url;
            const duracao = musica.duration;
            const popularity = musica.popularity;

            // Preparar a mensagem com a música
            let mensagemMusica = `*AQUI ESTÁ SUA MÚSICA🎶*\n\n`;
            mensagemMusica += `*Título:* ${titulo}\n`;
            mensagemMusica += `*Artista:* ${artista}\n`;
            mensagemMusica += `*Duração:* ${duracao}\n`;
            mensagemMusica += `*Popularidade:* ${popularity}\n`;
            mensagemMusica += `*Link:* ${spotifyUrl}`;

            // Enviar a resposta com a imagem do álbum
            if (imageUrl) {
                try {
                    const imageResponse = await fetch(imageUrl);
                    if (imageResponse.ok) {
                        const imageBuffer = await imageResponse.buffer();

                        await sock.sendMessage(from, {
                            image: imageBuffer,
                            caption: mensagemMusica
                        }, { quoted: m });

                        return;
                    }
                } catch (imageError) {
                    console.error("Erro ao baixar imagem do Spotify:", imageError.message);
                }
            }

            // Se não conseguir enviar com imagem, enviar apenas o texto
            await sock.sendMessage(from, {
                text: mensagemMusica
            }, { quoted: m });

        } catch (error) {
            console.error("Erro spotify:", error.message);
            await sock.sendMessage(from, {
                text: "💥 OPS! DEU ERRO\n\nErro ao executar comando spotify."
            }, { quoted: m });
        }
    },
};
