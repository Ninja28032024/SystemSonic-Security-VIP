// src/lib/logs.js
const chalk = require('chalk');

function printLog(title, message) {
    const blue     = chalk.hex('#1E90FF');
    const blueDim  = chalk.hex('#0A4A8A');
    const white    = chalk.white.bold;
    const whiteDim = chalk.white;
    const now      = new Date().toLocaleTimeString('pt-BR', { hour12: false });

    const limitText = (text, limit = 25) => {
        if (text.length > limit) return text.substring(0, limit) + '...';
        return text;
    };

    const BLOCK_HEAVY = blueDim('▓'.repeat(36));
    const DIVIDER     = white('─'.repeat(36));

    console.log(BLOCK_HEAVY);
    console.log(white('◤') + white('─'.repeat(34)) + white('◥'));
    console.log('  ' + blue('▌') + ' ' + white(title) + ' ' + blue('▐'));
    console.log(white('◣') + white('─'.repeat(34)) + white('◢'));
    console.log(DIVIDER);

    const lines = message.split('\n');
    lines.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
            const key = line.substring(0, colonIdx).trim();
            const val = line.substring(colonIdx + 1).trim();
            console.log(blue(' ❯ ') + white(key + ':') + whiteDim(` ${limitText(val)}`));
        } else {
            console.log(blue(' ❯ ') + whiteDim(line));
        }
    });

    console.log(DIVIDER);
    console.log('  ' + white('◆') + blueDim(' ') + blue(now) + blueDim(' ') + white('◆'));
    console.log(BLOCK_HEAVY);
    console.log('');
}

module.exports = { printLog };
