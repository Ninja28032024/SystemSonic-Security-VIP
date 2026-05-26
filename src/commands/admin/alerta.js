// src/commands/admin/alerta.js
// Comando para enviar alertas com hidetag para todos os membros do grupo

const path = require("path");
const { isUserAdmin } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: "alerta",
    aliases: [],
    async execute(sock, m, options) {
        const { from, sender, args, isGroup, prefixoAtual } = options;

        if (!isGroup) {
            return await sock.sendMessage(from, { 
                text: '*Ops!* Este comando só pode ser usado em grupos.' 
            }, { quoted: m });
        }

        const groupMeta = await sock.groupMetadata(from);
        
        // Verificar se o remetente é admin
        const senderIsAdmin = await isUserAdmin(sender, groupMeta, sock);

        if (!senderIsAdmin) {
            return await sock.sendMessage(from, { 
                text: '*Ops!* Você não é dono do Bot e nem administrador do grupo, se ponha no seu lugar.' 
            }, { quoted: m });
        }

        try {
            // Obter todos os participantes do grupo para hidetag
            const participants = groupMeta.participants;
            const mentions = participants.map(p => p.id);
            
            let alertMessage = '';
            
            // Verificar se está respondendo a uma mensagem
            const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (quotedMessage) {
                // Se está respondendo, usar o conteúdo da mensagem respondida
                alertMessage = quotedMessage.conversation || 
                              quotedMessage.extendedTextMessage?.text || 
                              quotedMessage.imageMessage?.caption || 
                              quotedMessage.videoMessage?.caption || 
                              'Alerta importante!';
            } else if (args.length > 0) {
                // Se não está respondendo, usar os argumentos
                alertMessage = args.join(' ');
            } else {
                return await sock.sendMessage(from, { 
                    text: `Preciso saber qual é o alerta!\n\n*Uso correto:*\n${prefixoAtual}alerta <mensagem>\n\nOu responda a uma mensagem com:\n${prefixoAtual}alerta` 
                }, { quoted: m });
            }
            
            // Reagir com emoji de alto-falante
            await sock.sendMessage(from, {
                react: {
                    text: '',
                    key: m.key
                }
            });
            
            // Enviar alerta com hidetag (marcando todos de forma fantasma)
            await sock.sendMessage(from, {
                text: alertMessage,
                mentions: mentions
            }, {
                quoted: {
                    key: {
                        fromMe: false,
                        participant: '0@s.whatsapp.net',
                        remoteJid: from
                    },
                    message: {
                        conversation: 'Enviado por SystemSonic Security'
                    }
                }
            });
            
        } catch (error) {
            console.error(" Erro ao enviar alerta:", error);
            await sock.sendMessage(from, { 
                text: `Puts, deu ruim! Não consegui enviar o alerta. Verifque se há algum erro.` 
            }, { quoted: m });
        }
    }
};