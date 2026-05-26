const path = require("path");
const fs = require("fs");

module.exports = {
    name: "menudown",
    aliases: ["menu-downloads","menudownloads","menudownload"],
    async execute(sock, m, options) {
        const { prefixoAtual, senderName, sender, from, config } = options;

        try {

            const { menuCategoria } = require(path.join(__dirname, '..', '..', 'lib', 'menu', 'menu.js'));
            let botNumberFormatted = sock.user.id.includes("@") ? sock.user.id.split("@")[0] : sock.user.id;
            if (botNumberFormatted.includes(":")) botNumberFormatted = botNumberFormatted.split(":")[0];
            const menuContent = menuCategoria('downloads', prefixoAtual, senderName, sender, config.ownerNumber, botNumberFormatted + '@s.whatsapp.net');
            if (!menuContent) {
                await sock.sendMessage(from, { text: "Nenhum comando encontrado na categoria Downloads." }, { quoted: m });
                return;
            }

            // Carregar imagem local da pasta img-menu como base64 para thumbnail
            const imgMenuPath = path.join(__dirname, '..', '..', 'lib', 'img-menu');
            let thumbnail = "";
            try {
                const files = fs.readdirSync(imgMenuPath).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
                if (files.length > 0) {
                    const imgBuffer = fs.readFileSync(path.join(imgMenuPath, files[0]));
                    thumbnail = `data:image/png;base64,${imgBuffer.toString('base64')}`;
                }
            } catch (e) {}

            await sock.sendMessage(from, {
                interactiveMessage: {
                    title: menuContent,
                    footer: "SYSTEM-SONIC - Menu Downloads",
                    thumbnail: thumbnail,
                    nativeFlowMessage: {
                        messageParamsJson: JSON.stringify({
                            bottom_sheet: {
                                button_title: "Menu",
                                list_title: "SYSTEM-SONIC"
                            }
                        }),
                        buttons: [
                            {
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({ display_text: "MINHA LID 🆔", id: `minha_lid_${sender}` })
                            },
                            {
                                name: "cta_url",
                                buttonParamsJson: JSON.stringify({ display_text: "CRIADOR DO BOT", url: "https://wa.me/5542984421154?text=Oi+tudo+bem?+Vim+pelo+SystemSonic" })
                            }
                        ]
                    }
                }
            }, { quoted: m });

        } catch (error) {
            console.error("Erro menudown:", error.message);
            await sock.sendMessage(from, { text: "Erro ao exibir o menu Downloads." }, { quoted: m });
        }
    }
};
