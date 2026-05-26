// src/listeners/listeners-antiimg-buttons.js
const path = require('path');
const { isOwner, isUserAdmin } = require(path.join(__dirname, '..', 'utils.js'));
const {
    obterSetup,
    atualizarDadosSetup,
    definirEtapaSetup,
    salvarConfiguracao,
    limparSetup
} = require(path.join(__dirname, '..', 'lib', 'antiimg-state', 'antiimg-state.js'));

function extrairButtonId(m) {
    if (m.message?.templateButtonReplyMessage?.selectedId) {
        return m.message.templateButtonReplyMessage.selectedId;
    }
    if (m.message?.buttonsResponseMessage?.selectedButtonId) {
        return m.message.buttonsResponseMessage.selectedButtonId;
    }
    if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
        try {
            const params = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
            return params.id || null;
        } catch (error) {
            return null;
        }
    }
    return null;
}

async function validarAcesso(sock, from, sender, config) {
    const groupMetadata = await sock.groupMetadata(from);
    const senderIsOwner = await isOwner(sender, config.ownerNumber, sock);
    const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);
    if (!senderIsOwner && !senderIsAdmin) return { permitido: false };
    return { permitido: true };
}

module.exports = {
    name: 'antiimg-buttons',
    async execute(sock, m, options) {
        const from = options.from || m.key.remoteJid;
        const sender = options.sender || m.key.participant || m.key.remoteJid;

        try {
            if (m.key.fromMe || !from.endsWith('@g.us')) return false;

            const buttonId = extrairButtonId(m);
            if (!buttonId || !buttonId.startsWith('antiimg_')) return false;

            const config = options.config || {};
            const acesso = await validarAcesso(sock, from, sender, config);

            if (!acesso.permitido) {
                await sock.sendMessage(from, { text: '*Ops! Você não tem permissão para isso.' }, { quoted: m });
                return true;
            }

            const setup = obterSetup(from);
            if (!setup || setup.sender !== sender) {
                await sock.sendMessage(from, { text: '*Ops!* Nenhuma configuração em andamento encontrada. Use o comando novamente.' }, { quoted: m });
                return true;
            }

            if (buttonId === 'antiimg_delete_yes' || buttonId === 'antiimg_delete_no') {
                const deleteImage = buttonId === 'antiimg_delete_yes';
                atualizarDadosSetup(from, { deleteImage });
                definirEtapaSetup(from, sender, 'await_remove_participant', setup.data);

                await sock.sendMessage(from, {
                    text: '*CERTO, ENTENDI PERFEITAMENTE*\nAinda preciso de alguns detalhes, você deseja que a pessoa que enviou a imagem seja removida após ter enviado a imagem?',
                    interactiveButtons: [
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'SIM', id: 'antiimg_remove_yes' }) },
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'NÃO', id: 'antiimg_remove_no' }) }
                    ]
                }, { quoted: m });
                return true;
            }

            if (buttonId === 'antiimg_remove_yes' || buttonId === 'antiimg_remove_no') {
                const removeParticipant = buttonId === 'antiimg_remove_yes';
                atualizarDadosSetup(from, { removeParticipant });

                if (!removeParticipant) {
                    const finalConfig = {
                        ativo: true,
                        deleteImage: setup.data.deleteImage,
                        removeParticipant: false,
                        removeImmediately: false,
                        warningMode: false,
                        warningLimit: 0
                    };
                    salvarConfiguracao(from, finalConfig);
                    limparSetup(from);
                    const deleteText = finalConfig.deleteImage ? 'SIM' : 'NÃO';
                    await sock.sendMessage(from, {
                        text: '*STATUS ANTI-IMG - SYSTEMSONIC SECURITY*\n\n' +
                              `*A imagem deve ser deletada?:* ${deleteText}\n` +
                              `*O participante deverá ser removido?:* NÃO\n` +
                              `*A remoção do participante é imediato ou por advertências?:* N/A\n` +
                              `*Quantas advertências foi configurada?:* N/A\n\n` +
                              'SystemSonic Security - Anti Imagens'
                    }, { quoted: m });
                    return true;
                }

                definirEtapaSetup(from, sender, 'await_removal_mode', setup.data);
                await sock.sendMessage(from, {
                    text: '*PERFEITO!, ESTAMOS QUASE TERMINANDO*\nQuase lá! Antes, você deseja que a pessoa seja removida imediatamente ou por uma quantidade em advertências?',
                    interactiveButtons: [
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'IMEDIATO', id: 'antiimg_mode_immediate' }) },
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'ADVERTÊNCIAS', id: 'antiimg_mode_warnings' }) }
                    ]
                }, { quoted: m });
                return true;
            }

            if (buttonId === 'antiimg_mode_immediate' || buttonId === 'antiimg_mode_warnings') {
                const removeImmediately = buttonId === 'antiimg_mode_immediate';
                atualizarDadosSetup(from, { removeImmediately });

                if (removeImmediately) {
                    const finalConfig = {
                        ativo: true,
                        deleteImage: setup.data.deleteImage,
                        removeParticipant: true,
                        removeImmediately: true,
                        warningMode: false,
                        warningLimit: 0
                    };
                    salvarConfiguracao(from, finalConfig);
                    limparSetup(from);
                    const deleteText = finalConfig.deleteImage ? 'SIM' : 'NÃO';
                    await sock.sendMessage(from, {
                        text: '*STATUS ANTI-IMG - SYSTEMSONIC SECURITY*\n\n' +
                              `*A imagem deve ser deletada?:* ${deleteText}\n` +
                              `*O participante deverá ser removido?:* SIM\n` +
                              `*A remoção do participante é imediato ou por advertências?:* IMEDIATO\n` +
                              `*Quantas advertências foi configurada?:* N/A\n\n` +
                              'SystemSonic Security - Anti Imagens'
                    }, { quoted: m });
                    return true;
                }

                definirEtapaSetup(from, sender, 'await_warning_limit', setup.data);
                const buttons = [];
                for (let i = 1; i <= 8; i++) {
                    buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: i.toString(), id: `antiimg_warn_${i}` }) });
                }
                buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'PERSONALIZAR', id: 'antiimg_warn_custom' }) });
                await sock.sendMessage(from, {
                    text: '*OK! MAS AGORA PRECISO DA ÚLTIMA INFORMAÇÃO*\nQuantas advertências deseja que a pessoa tenha antes de ser removida?',
                    interactiveButtons: buttons
                }, { quoted: m });
                return true;
            }

            if (buttonId.startsWith('antiimg_warn_') && buttonId !== 'antiimg_warn_custom') {
                const warningLimit = parseInt(buttonId.replace('antiimg_warn_', ''));
                const finalConfig = {
                    ativo: true,
                    deleteImage: setup.data.deleteImage,
                    removeParticipant: true,
                    removeImmediately: false,
                    warningMode: true,
                    warningLimit
                };
                salvarConfiguracao(from, finalConfig);
                limparSetup(from);
                const deleteText = finalConfig.deleteImage ? 'SIM' : 'NÃO';
                await sock.sendMessage(from, {
                    text: '*STATUS ANTI-IMG - SYSTEMSONIC SECURITY*\n\n' +
                          `*A imagem deve ser deletada?:* ${deleteText}\n` +
                          `*O participante deverá ser removido?:* SIM\n` +
                          `*A remoção do participante é imediato ou por advertências?:* ADV\n` +
                          `*Quantas advertências foi configurada?:* ${warningLimit} advertências\n\n` +
                          'SystemSonic Security - Anti Imagens'
                }, { quoted: m });
                return true;
            }

            if (buttonId === 'antiimg_warn_custom') {
                definirEtapaSetup(from, sender, 'await_custom_warning', setup.data);
                await sock.sendMessage(from, {
                    text: '*ME DIGA QUANTAS ADVERTÊNCIAS PERSONALIZADAS VOCÊ DESEJA*\nDescreva em números abaixo a quantidade desejada.'
                }, { quoted: m });
                return true;
            }

            return false;

        } catch (error) {
            console.error('[ANTIIMG] Erro no listener de botões:', error.message);
            return false;
        }
    }
};
