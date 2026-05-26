const path = require("path");
const { config, saveConfig } = require(path.join(__dirname, '..', '..', '..', 'settings', 'config.js'));
const { isOwner, isUserAdmin } = require(path.join(__dirname, '..', '..', 'utils.js'));

module.exports = {
    name: "setprefix",
    aliases: [],
    async execute(sock, m, options) {
        const { from, sender, args, prefixoAtual } = options;

        try {
            const isDono = await isOwner(sender, config.ownerNumber, sock);
            if (!isDono) {
                const groupMetadata = m.key.remoteJid.endsWith('@g.us') ? await sock.groupMetadata(m.key.remoteJid) : null;
                const isAdmin = groupMetadata ? await isUserAdmin(sender, groupMetadata, sock) : false;

                if (isAdmin) {
                    await sock.sendMessage(from, { 
                        text: '*ACESSO RESTRITO AO MEU DONO🛡️*\nEste comando só deve ser usado pelo meu dono, nenhum admin ou membro comum deste grupo tem a permissão de usá-lo.',
                        footer: 'SYSTEM-SONIC - Alteração de Prefixo'
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(from, { 
                        text: '*ACESSO RESTRITO AO MEU DONO⚔️*\nApenas o meu dono pode usar este comando, nenhum membro neste grupo é permitido.',
                        footer: 'SYSTEM-SONIC - Alteração de Prefixo'
                    }, { quoted: m });
                }
                return;
            }

            if (!args[0]) {
                await sock.sendMessage(from, { 
                    text: '❌ Forneça um novo prefixo!\n\nExemplo: ' + prefixoAtual + 'setprefix !',
                    footer: 'SYSTEM-SONIC - Alteração de Prefixo'
                }, { quoted: m });
                return;
            }

            const novoPrefixo = args[0];
            
            // Validar se o novo prefixo é válido (apenas 1 caractere)
            if (novoPrefixo.length > 1) {
                await sock.sendMessage(from, { 
                    text: '❌ O prefixo deve conter apenas 1 caractere!\n\nExemplo: ' + prefixoAtual + 'setprefix #',
                    footer: 'SYSTEM-SONIC - Alteração de Prefixo'
                }, { quoted: m });
                return;
            }

            // Mensagem de processamento
            await sock.sendMessage(from, { 
                text: '*PODE DEIXAR VOSSA EXCELÊNCIA!👑*\nEstou alterando o prefixo global neste exato momento. *Aguarde...⌛*',
                footer: 'SYSTEM-SONIC - Alteração de Prefixo'
            }, { quoted: m });

            // Aguardar um pouco para dar feedback visual
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Atualizar o prefixo no config
            config.prefix = novoPrefixo;
            saveConfig();

            // Mensagem de sucesso
            await sock.sendMessage(from, { 
                text: `*PERFEITO! PREFIXO ALTERADO COM SUCESSO!*\n\nNovo prefixo: *${novoPrefixo}*\n\nAgora use ${novoPrefixo}menu para ver os comandos disponíveis.`,
                footer: 'SYSTEM-SONIC - Alteração de Prefixo'
            }, { quoted: m });

        } catch (error) {
            console.error('Erro setprefix:', error.message);
            await sock.sendMessage(from, { 
                text: '💥 OPS! DEU ERRO\n\nErro ao alterar prefixo.',
                footer: 'SYSTEM-SONIC - Alteração de Prefixo'
            }, { quoted: m });
        }
    },
};
