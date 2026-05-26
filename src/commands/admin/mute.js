const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const {
    obterPreferenciaGrupo,
    definirEtapaMute,
    limparEtapaMute
} = require(path.join(__dirname, '..', '..', 'lib', 'mute-state', 'mute-state.js'));

const MSG_SEM_ACESSO = '*Ops! Você não é dono do bot e nem administrador do grupo. Se ponha no seu lugar!*';
const MSG_PREFERENCIA_NAO_DEFINIDA = '*Ops!* O meu dono ainda não definiu a preferência desse sistema. Entre em contato com ele para definir e tente novamente mais tarde!';

module.exports = {
    name: 'mute',
    aliases: [],
    async execute(sock, m, options) {
        const { from, sender, config } = options;

        if (!from.endsWith('@g.us')) {
            await sock.sendMessage(from, {
                text: '❌ Este comando só pode ser acessado em grupos.'
            }, { quoted: m });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsDono && !senderIsAdmin) {
                await sock.sendMessage(from, { text: MSG_SEM_ACESSO }, { quoted: m });
                return;
            }

            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
            if (!botIsAdmin) {
                await sock.sendMessage(from, {
                    text: '*Ops!* Não sou admin para iniciar este sistema. Certifique-se que eu esteja de admin e tente de novo!'
                }, { quoted: m });
                return;
            }

            limparEtapaMute(from);

            const preferencia = obterPreferenciaGrupo(from);

            if (!preferencia) {
                if (!senderIsDono) {
                    await sock.sendMessage(from, {
                        text: MSG_PREFERENCIA_NAO_DEFINIDA
                    }, { quoted: m });
                    return;
                }

                definirEtapaMute(from, sender, 'choose_access', {}, 5 * 60 * 1000);
                await sock.sendMessage(from, {
                    text: '*PERFEITO! ANTES DE PROSSEGUIR, ME DIGA*\nDeseja que o comando seja restrito do dono ou permitir que os administradores também tenham acesso?',
                    footer: 'SYSTEM-SONIC - Sistema de Mute',
                    interactiveButtons: [
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'ACESSO DONO E ADMIN',
                                id: 'mute_access_owner_admin'
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'ACESSO APENAS DONO',
                                id: 'mute_access_owner_only'
                            })
                        }
                    ]
                }, { quoted: m });
                return;
            }

            const acessoOwnerOnly = preferencia.accessMode === 'owner_only';
            if (acessoOwnerOnly && !senderIsDono) {
                await sock.sendMessage(from, {
                    text: MSG_SEM_ACESSO
                }, { quoted: m });
                return;
            }

            if (senderIsDono) {
                definirEtapaMute(from, sender, 'review_preference', {
                    accessMode: preferencia.accessMode
                }, 5 * 60 * 1000);

                await sock.sendMessage(from, {
                    text: '*VEJO QUE TEM UMA DEFINIÇÃO DE PREFERÊNCIA, ANTES DE PROSSEGUIR QUE TAL REVISAR SUA PREFERÊNCIA?*\nRevisar suas preferências é essencial para saber o que você deseja no exato momento.',
                    footer: 'SYSTEM-SONIC - Sistema de Mute',
                    interactiveButtons: [
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'REVISAR',
                                id: 'mute_review_yes'
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'NÃO REVISAR',
                                id: 'mute_review_no'
                            })
                        }
                    ]
                }, { quoted: m });
                return;
            }

            definirEtapaMute(from, sender, 'await_target', {
                accessMode: preferencia.accessMode
            }, 5 * 60 * 1000);

            await sock.sendMessage(from, {
                text: '*OK! VEJO QUE DESEJA MUTAR ALGUM MEMBRO DESTE GRUPO*\nQue tal nos dizer que membro exatamente deseja mutar? Mencione o membro com @ dentro de 5 minutos para mutar. O sistema irá detectar as mensagens enviadas por ele e apagar imediatamente.',
                footer: 'SYSTEM-SONIC - Sistema de Mute'
            }, { quoted: m });
        } catch (error) {
            console.error('Erro mute:', error.message);
            await sock.sendMessage(from, {
                text: '💥 OPS! DEU ERRO\n\nErro ao executar comando mute.'
            }, { quoted: m });
        }
    }
};
