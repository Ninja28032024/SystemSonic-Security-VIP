const path = require("path");
const fs = require("fs");

module.exports = {
    name: "menu",
    aliases: ["help","start"],
    async execute(sock, m, options) {
        const { prefixoAtual, senderName, sender, from, config } = options;

        try {

            const { menu: menuFunction } = require(path.join(__dirname, '..', '..', 'lib', 'menu', 'menu.js'));
            let botNumberFormatted = sock.user.id.includes("@") ? sock.user.id.split("@")[0] : sock.user.id;
            if (botNumberFormatted.includes(":")) botNumberFormatted = botNumberFormatted.split(":")[0];
            const menuContent = menuFunction(prefixoAtual, senderName, sender, config.ownerNumber, botNumberFormatted + '@s.whatsapp.net');

            // Reacoes antes do menu
            const emojisReacoes = ["1️⃣", "2️⃣", "3️⃣"];
            for (const emoji of emojisReacoes) {
                try {
                    await sock.sendMessage(from, { react: { text: emoji, key: m.key } });
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {}
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
                    footer: "SYSTEM-SONIC - Menu Principal",
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

            // Reacao final
            try {
                await sock.sendMessage(from, { react: { text: "🌀", key: m.key } });
            } catch (e) {}

        } catch (error) {
            console.error("Erro menu:", error.message);
            await sock.sendMessage(from, { text: "Erro ao exibir o menu." }, { quoted: m });
        }
    }
};
