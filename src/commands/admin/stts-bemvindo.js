// src/commands/admin/stts-bemvindo.js
const path = require('path');
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { obterConfigBemvindo } = require(path.join(__dirname, '..', '..', 'lib', 'bemvindo-state', 'bemvindo-state.js'));

module.exports = {
    name: 'stts-bemvindo',
    aliases: ['status-bemvindo', 'stts-bv'],
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

            if (!configAtual) {
                await sock.sendMessage(from, {
                    text: '*STATUS BOAS-VINDAS - SYSTEMSONIC*\n\n— dados do sistema de boas-vindas —\n*Status:* DESATIVADO\n*Legenda:* Não definida\n\nBoas-Vindas - SystemSonic',
                    footer: 'SYSTEM-SONIC - Boas-Vindas'
                }, { quoted: m });
                return;
            }

            const status = configAtual.ativo ? 'ATIVADO' : 'DESATIVADO';
            const legenda = configAtual.legenda || 'Não definida';

            await sock.sendMessage(from, {
                text: `*STATUS BOAS-VINDAS - SYSTEMSONIC*\n\n— dados do sistema de boas-vindas —\n*Status:* ${status}\n*Legenda:* ${legenda}\n\nBoas-Vindas - SystemSonic`,
                footer: 'SYSTEM-SONIC - Boas-Vindas'
            }, { quoted: m });

        } catch (error) {
            console.error('[STTS-BEMVINDO] Erro:', error.message);
            await sock.sendMessage(from, { text: '*Ops!* Erro ao executar comando stts-bemvindo.' }, { quoted: m });
        }
    }
};
