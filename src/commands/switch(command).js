// src/commands/switch(command).js
// Roteador de comandos via switch/case
// Adicione aqui os imports e cases dos seus novos comandos

async function handleCommand(commandName, sock, m, options) {
    // Desestruturar as variáveis do contexto
    const { args, prefixoAtual, sender, from, senderName, isGroup, config, isUserAdmin, isOwner, registerListener, removeListener } = options;
    
    switch (commandName) {


        default:
            break;
    }
}

module.exports = { handleCommand };
