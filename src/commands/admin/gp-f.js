const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: "gp-f",
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
            const msg1 = '*FECHANDO GRUPO...🚪*\nEste grupo será fechado por ordem de um administrador.';
            await sock.sendMessage(from, { text: msg1 }, { quoted: m });

            // Fechar o grupo
            await sock.groupSettingUpdate(from, 'announcement');

            // Enviar segunda mensagem
            const msg2 = '*GRUPO FECHADO COM SUCESSO!🔒*\nPor decreto de um administrador, este grupo foi fechado e retornará em breve!';
            await sock.sendMessage(from, { text: msg2 }, { quoted: m });

        } catch (error) {
            console.error('Erro ao fechar grupo:', error.message);
            await sock.sendMessage(from, { text: '❌ Erro ao fechar o grupo!' }, { quoted: m });
        }
    },
};
