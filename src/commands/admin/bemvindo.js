// src/commands/admin/bemvindo.js
const path = require('path');
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { obterConfigBemvindo, ativarBemvindo, desativarBemvindo } = require(path.join(__dirname, '..', '..', 'lib', 'bemvindo-state', 'bemvindo-state.js'));

module.exports = {
    name: 'bemvindo',
    aliases: ['boasvindas', 'bv'],
    async execute(sock, m, options) {
        const { from, sender, config } = options;

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

            const configAtual = obterConfigBemvindo(from);
            const estaAtivo = configAtual && configAtual.ativo;

            if (estaAtivo) {
                desativarBemvindo(from);
                await sock.sendMessage(from, {
                    text: '*SISTEMA DE BOAS-VINDAS DESATIVADO*\n\nO sistema de boas-vindas foi desativado neste grupo com sucesso.',
                    footer: 'SYSTEM-SONIC - Boas-Vindas'
                }, { quoted: m });
            } else {
                ativarBemvindo(from);
                await sock.sendMessage(from, {
                    text: '*SISTEMA DE BOAS-VINDAS ATIVADO*\n\nO sistema de boas-vindas foi ativado neste grupo com sucesso! Novos membros serão saudados automaticamente.',
                    footer: 'SYSTEM-SONIC - Boas-Vindas'
                }, { quoted: m });
            }

        } catch (error) {
            console.error('[BEMVINDO] Erro:', error.message);
            await sock.sendMessage(from, { text: '*Ops!* Erro ao executar comando bemvindo.' }, { quoted: m });
        }
    }
};
