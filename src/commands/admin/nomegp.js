// src/commands/admin/nomegp.js
// Comando para alterar o nome do grupo

module.exports = {
    name: 'nomegp',
    aliases: ['nomegrupo', 'groupname', 'setname'],
    description: 'Altera o nome do grupo',
    usage: '<prefixo>nomegp <novo nome>',

    async execute(sock, m, options) {
        const { from, sender, isGroup, config, isUserAdmin, isOwner, args } = options;

        try {
            // Verificar se é grupo
            if (!isGroup) {
                await sock.sendMessage(from, {
                    text: '*Ops! Este comando só funciona em grupos.*'
                }, { quoted: m });
                return;
            }

            // Verificar permissões
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsOwner = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsOwner && !senderIsAdmin) {
                await sock.sendMessage(from, {
                    text: '*Ops! Você precisa ser administrador ou dono do bot para usar este comando.*'
                }, { quoted: m });
                return;
            }

            // Verificar se bot é admin
            const botIsAdmin = await isUserAdmin(sock.user.id, groupMetadata, sock);
            if (!botIsAdmin) {
                await sock.sendMessage(from, {
                    text: '*Ops! Eu preciso ser administrador do grupo para alterar o nome.*'
                }, { quoted: m });
                return;
            }

            // Verificar se foi fornecido um nome
            if (args.length === 0) {
                await sock.sendMessage(from, {
                    text: `*Ops! Você precisa informar o novo nome do grupo.*\n\n` +
                          `*Uso correto:* ${options.prefixoAtual}nomegp <novo nome>`
                }, { quoted: m });
                return;
            }

            // Juntar argumentos para formar o nome completo
            const novoNome = args.join(' ').trim();

            // Validar tamanho do nome (WhatsApp permite até 25 caracteres)
            if (novoNome.length > 25) {
                await sock.sendMessage(from, {
                    text: `*Ops! O nome é muito longo.*\n\n` +
                          `*Tamanho atual:* ${novoNome.length} caracteres\n` +
                          `*Limite:* 25 caracteres\n\n` +
                          `Por favor, escolha um nome mais curto.`
                }, { quoted: m });
                return;
            }

            if (novoNome.length < 1) {
                await sock.sendMessage(from, {
                    text: '*Ops! O nome não pode estar vazio.*'
                }, { quoted: m });
                return;
            }

            // Alterar nome do grupo
            await sock.groupUpdateSubject(from, novoNome);

            await sock.sendMessage(from, {
                text: `*NOME DO GRUPO ALTERADO COM SUCESSO!*\n\n` +
                      `*Novo nome:* ${novoNome}`
            }, { quoted: m });

        } catch (error) {
            console.error('[NOMEGP] Erro no comando:', error.message);
            
            if (error.message.includes('not-authorized')) {
                await sock.sendMessage(from, {
                    text: '*Ops! Eu preciso ser administrador do grupo para alterar o nome.*'
                }, { quoted: m });
            } else {
                await sock.sendMessage(from, {
                    text: '*Erro ao alterar nome do grupo!*\n\nTente novamente mais tarde.'
                }, { quoted: m });
            }
        }
    }
};