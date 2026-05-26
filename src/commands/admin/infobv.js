// src/commands/admin/infobv.js
const path = require('path');
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: 'infobv',
    aliases: ['info-bv', 'ajudabv'],
    async execute(sock, m, options) {
        const { from, sender, prefixoAtual, config } = options;

        if (!from.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: '*Ops!* Este comando só pode ser usado em grupos.' }, { quoted: m });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsDono && !senderIsAdmin) {
                await sock.sendMessage(from, { text: '*Ops!* Você não é dono e nem administrador do grupo, se ponha no seu lugar.' }, { quoted: m });
                return;
            }

            const mensagem = `*COMO USAR O LEGENDABV*\n\nUse ${prefixoAtual}legendabv seguido da mensagem que deseja enviar ao novo membro.\n\n*Exemplo:*\n${prefixoAtual}legendabv Bem-vindo ao @grupo, @user! Você é o membro número @membros.\n\n*Variáveis disponíveis:*\n*@user* — Marca o novo membro\n*@grupo* — Nome do grupo\n*@hora* — Hora da entrada\n*@data* — Data da entrada\n*@dia* — Dia da semana\n*@numerouser* — Número do membro\n*@lid* — ID do membro\n*@desc* — Descrição do grupo\n*@membros* — Total de membros\n*@stts-profile* — Status do perfil`;

            await sock.sendMessage(from, {
                text: mensagem,
                footer: 'SYSTEM-SONIC - Boas-Vindas'
            }, { quoted: m });

        } catch (error) {
            console.error('[INFOBV] Erro:', error.message);
            await sock.sendMessage(from, { text: '*Ops!* Erro ao executar comando infobv.' }, { quoted: m });
        }
    }
};
