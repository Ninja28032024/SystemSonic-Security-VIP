// src/commands/admin/legendabv.js
const path = require('path');
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { obterConfigBemvindo, definirLegenda } = require(path.join(__dirname, '..', '..', 'lib', 'bemvindo-state', 'bemvindo-state.js'));

module.exports = {
    name: 'legendabv',
    aliases: ['legenda-bv', 'msgbv'],
    async execute(sock, m, options) {
        const { from, sender, args, prefixoAtual, config } = options;

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

            if (!configAtual || !configAtual.ativo) {
                await sock.sendMessage(from, {
                    text: `*Ops!* O sistema de boas-vindas está desativado neste grupo.\n\nAtive primeiro com ${prefixoAtual}bemvindo e tente novamente.`,
                    footer: 'SYSTEM-SONIC - Boas-Vindas'
                }, { quoted: m });
                return;
            }

            if (!args || args.length === 0) {
                const placeholders = `*@user* — Marca o novo membro\n*@grupo* — Nome do grupo\n*@hora* — Hora da entrada\n*@data* — Data da entrada\n*@dia* — Dia da semana\n*@numerouser* — Número do membro\n*@lid* — ID do membro\n*@desc* — Descrição do grupo\n*@membros* — Total de membros\n*@stts-profile* — Status do perfil`;

                await sock.sendMessage(from, {
                    text: `*COMO USAR O LEGENDABV*\n\nUse ${prefixoAtual}legendabv seguido da mensagem que deseja enviar ao novo membro.\n\n*Exemplo:*\n${prefixoAtual}legendabv Bem-vindo ao @grupo, @user! Você é o membro número @membros.\n\n*Variáveis disponíveis:*\n${placeholders}`,
                    footer: 'SYSTEM-SONIC - Boas-Vindas'
                }, { quoted: m });
                return;
            }

            // Extrai o texto completo preservando quebras de linha
            const textoCompleto = m.message?.extendedTextMessage?.text
                || m.message?.conversation
                || '';
            const novaLegenda = textoCompleto.slice(textoCompleto.indexOf(' ') + 1).trim();
            definirLegenda(from, novaLegenda);

            await sock.sendMessage(from, {
                text: `*LEGENDA DE BOAS-VINDAS ATUALIZADA*\n\nA mensagem de boas-vindas foi definida com sucesso!\n\n*Mensagem definida:*\n${novaLegenda}`,
                footer: 'SYSTEM-SONIC - Boas-Vindas'
            }, { quoted: m });

        } catch (error) {
            console.error('[LEGENDABV] Erro:', error.message);
            await sock.sendMessage(from, { text: '*Ops!* Erro ao executar comando legendabv.' }, { quoted: m });
        }
    }
};
