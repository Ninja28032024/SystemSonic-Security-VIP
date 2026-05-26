// src/lib/bannerASCII.js
const chalk = require('chalk');
const path = require('path');

// --- CAMINHO CORRIGIDO ---
// Importa as configurações da pasta 'settings'
const { config } = require(path.join(__dirname, '..', '..', 'settings', 'config.js'));

function showBanner() {
    // Cor azul meio termo para os blocos █
    const orangeColor = chalk.hex('#4A90E2'); 

    const lines = [
        ` ███████╗██╗   ██╗███████╗████████╗███████╗███╗   ███╗`,
        ` ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔════╝████╗ ████║`,
        ` ███████╗ ╚████╔╝ ███████╗   ██║   █████╗  ██╔████╔██║`,
        ` ╚════██║  ╚██╔╝  ╚════██║   ██║   ██╔══╝  ██║╚██╔╝██║`,
        ` ███████║   ██║   ███████║   ██║   ███████╗██║ ╚═╝ ██║`,
        ` ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝`,
        `                                                       `,
        ` ███████╗ ██████╗ ███╗   ██╗██╗ ██████╗             `,
        ` ██╔════╝██╔═══██╗████╗  ██║██║██╔════╝             `,
        ` ███████╗██║   ██║██╔██╗ ██║██║██║                  `,
        ` ╚════██║██║   ██║██║╚██╗██║██║██║                  `,
        ` ███████║╚██████╔╝██║ ╚████║██║╚██████╗             `,
        ` ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝ ╚═════╝`
    ];

    // Função para colorir apenas os blocos █ com a cor laranja
    const colorize = (text) => text.split('').map(char => char === '█' ? orangeColor(char) : char).join('');

    lines.forEach(line => {
        console.log(colorize(line));
    });
    
    console.log('');

    // Adicionando informações do bot abaixo do banner
    console.log(chalk.white.bold(`        ${config.botName} v${config.botVersion}`));
    console.log(chalk.white.bold(`        Criador: ${config.ownerName}`));
    console.log(chalk.white.bold(`        Prefixo da Sessão: [ ${config.prefix} ]`));
    console.log(orangeColor('='.repeat(60)));
}

module.exports = { showBanner };
