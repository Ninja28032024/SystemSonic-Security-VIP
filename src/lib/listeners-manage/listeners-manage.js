// src/lib/listeners-manage/listeners-manage.js
const fs = require('fs');
const path = require('path');

function carregarListeners(listenersDir) {
    const listeners = [];

    if (!fs.existsSync(listenersDir)) {
        console.warn(`⚠️  Pasta de listeners não encontrada: ${listenersDir}`);
        return listeners;
    }

    const files = fs.readdirSync(listenersDir);

    for (const file of files) {
        const fullPath = path.join(listenersDir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            const subListeners = carregarListeners(fullPath);
            listeners.push(...subListeners);
        } else if (file.endsWith('.js')) {
            try {
                delete require.cache[require.resolve(fullPath)];
                const listenerModule = require(fullPath);

                if (typeof listenerModule === 'function') {
                    listeners.push({
                        name: file.replace('.js', ''),
                        handler: listenerModule,
                        path: fullPath,
                        tipo: 'function'
                    });
                } else if (listenerModule.default && typeof listenerModule.default === 'function') {
                    listeners.push({
                        name: file.replace('.js', ''),
                        handler: listenerModule.default,
                        path: fullPath,
                        tipo: 'function'
                    });
                } else if (listenerModule.name && typeof listenerModule.execute === 'function') {
                    listeners.push({
                        name: listenerModule.name,
                        handler: listenerModule.execute,
                        path: fullPath,
                        tipo: 'module'
                    });
                } else {
                    console.warn(`⚠️  Listener ${file} não exporta uma função válida`);
                }
            } catch (error) {
                console.warn(`[LISTENER ERROR] ${file}: ${error.message}`);
            }
        }
    }

    return listeners;
}

async function executarListeners(listeners, sock, m, from, sender, options = {}) {
    const listenersCopy = [...listeners];

    const listenerCorrecaoButton = listenersCopy.find(l => l.name === 'listeners-correcao-button');
    const listenerCorrecaoErro = listenersCopy.find(l => l.name === 'listeners-command-error-correction');

    if (listenerCorrecaoButton) listenersCopy.splice(listenersCopy.indexOf(listenerCorrecaoButton), 1);
    if (listenerCorrecaoErro) listenersCopy.splice(listenersCopy.indexOf(listenerCorrecaoErro), 1);

    const listenersOrdenados = [];
    if (listenerCorrecaoButton) listenersOrdenados.push(listenerCorrecaoButton);
    if (listenerCorrecaoErro) listenersOrdenados.push(listenerCorrecaoErro);
    listenersOrdenados.push(...listenersCopy);

    for (const listener of listenersOrdenados) {
        try {
            let resultado;

            if (listener.tipo === 'module') {
                resultado = await listener.handler(sock, m, { ...options, from, sender });
            } else {
                resultado = await listener.handler(sock, m, from, sender, options);
            }

            if (resultado === true) {
                return true;
            }
        } catch (error) {
            console.error(`❌ Erro ao executar listener ${listener.name}:`, error.message);
        }
    }

    return false;
}

module.exports = {
    carregarListeners,
    executarListeners
};