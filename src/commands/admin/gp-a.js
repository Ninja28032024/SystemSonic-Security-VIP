const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: "gp-a",
    aliases: [],
    async execute(sock, m, options) {
        const { from, sender, config } = options;

        if (!from.endsWith("@g.us")) {
            await sock.sendMessage(from, { text: '❌ Este comando só pode ser acessado em grupos.' }, { quoted: m });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsDono && !senderIsAdmin) {
                await sock.sendMessage(from, { text: '*ACESSO RESTRITO⚔️*\nApenas o dono ou admins podem usar este comando.' }, { quoted: m });
                return;
            }

            // Enviar primeira mensagem
            const msg1 = '*ABRINDO GRUPO...🔐*\nEste grupo está sendo aberto!';
            await sock.sendMessage(from, { text: msg1 }, { quoted: m });

            // Abrir o grupo
            await sock.groupSettingUpdate(from, 'not_announcement');

            // Enviar segunda mensagem
            const msg2 = '*ESTE GRUPO FOI ABERTO COM SUCESSO!!🔓*\nO grupo está aberto novamente, e vocês estão livres para conversar.';
            await sock.sendMessage(from, { text: msg2 }, { quoted: m });

        } catch (error) {
            console.error('Erro ao abrir grupo:', error.message);
            await sock.sendMessage(from, { text: '❌ Erro ao abrir o grupo!' }, { quoted: m });
        }
    },
};
