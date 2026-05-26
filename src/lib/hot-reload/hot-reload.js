const fs = require('fs');
const path = require('path');

const PASTAS_MONITORADAS = [
    'src/commands',
    'src/listeners',
    'src/lib',
    'settings'
];

const EXTENSOES_VALIDAS = ['.js', '.json'];
const DEBOUNCE_MS = 800;

function limparCacheModulo(modulePath) {
    try {
        const resolved = require.resolve(modulePath);
        const mod = require.cache[resolved];
        if (!mod) return;

        mod.children.forEach(child => {
            if (!child.id.includes('node_modules') && !child.id.includes('session')) {
                limparCacheModulo(child.id);
            }
        });

        delete require.cache[resolved];
    } catch (e) {}
}

function recarregarComandos(comandosMap, rootDir) {
    const commandsDir = path.join(rootDir, 'src', 'commands');
    function varrerPasta(dir) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                varrerPasta(fullPath);
            } else if (file.endsWith('.js')) {
                try {
                    limparCacheModulo(fullPath);
                    const mod = require(fullPath);
                    if (mod.name && typeof mod.execute === 'function') {
                        comandosMap.set(mod.name.toLowerCase(), mod);
                        if (Array.isArray(mod.aliases)) {
                            mod.aliases.forEach(alias => comandosMap.set(alias.toLowerCase(), mod));
                        }
                    }
                } catch (err) {}
            }
        }
    }
    varrerPasta(commandsDir);
}

function recarregarListeners(listenersArray, rootDir) {
    try {
        const { carregarListeners } = require(path.join(rootDir, 'src', 'lib', 'listeners-manage', 'listeners-manage.js'));
        const listenersDir = path.join(rootDir, 'src', 'listeners');
        if (!fs.existsSync(listenersDir)) return;
        const files = fs.readdirSync(listenersDir);
        files.forEach(file => {
            if (file.endsWith('.js')) {
                limparCacheModulo(path.join(listenersDir, file));
            }
        });
        const novosListeners = carregarListeners(listenersDir);
        listenersArray.length = 0;
        novosListeners.forEach(l => listenersArray.push(l));
    } catch (e) {}
}

class HotReload {
    constructor({ rootDir, comandosMap, listenersArray }) {
        this.rootDir = rootDir;
        this.comandosMap = comandosMap;
        this.listenersArray = listenersArray;
        this._watchers = [];
        this._debounceTimers = new Map();
        this._ativo = false;
    }

    iniciar() {
        if (this._ativo) return;
        this._ativo = true;
        PASTAS_MONITORADAS.forEach(pastaRelativa => {
            const pastaCaminho = path.join(this.rootDir, pastaRelativa);
            if (!fs.existsSync(pastaCaminho)) return;
            try {
                const watcher = fs.watch(pastaCaminho, { recursive: true }, (eventType, filename) => {
                    if (!filename || filename.includes('session')) return;
                    const ext = path.extname(filename);
                    if (!EXTENSOES_VALIDAS.includes(ext)) return;
                    this._agendarReload(path.join(pastaRelativa, filename), eventType);
                });
                this._watchers.push(watcher);
            } catch (err) {}
        });
        try {
            const indexWatcher = fs.watch(this.rootDir, (eventType, filename) => {
                if (filename === 'index.js') this._agendarReload(filename, eventType);
            });
            this._watchers.push(indexWatcher);
        } catch (err) {}
    }

    _agendarReload(caminhoRelativo, eventType) {
        if (this._debounceTimers.has(caminhoRelativo)) {
            clearTimeout(this._debounceTimers.get(caminhoRelativo));
        }
        const timer = setTimeout(() => {
            this._debounceTimers.delete(caminhoRelativo);
            this._processarAlteracao(caminhoRelativo, eventType);
        }, DEBOUNCE_MS);
        this._debounceTimers.set(caminhoRelativo, timer);
    }

    _processarAlteracao(caminhoRelativo, eventType) {
        if (caminhoRelativo.includes('session')) return;
        const caminhoCompleto = path.join(this.rootDir, caminhoRelativo);
        if (caminhoRelativo.includes('commands')) {
            recarregarComandos(this.comandosMap, this.rootDir);
        } else if (caminhoRelativo.includes('listeners')) {
            recarregarListeners(this.listenersArray, this.rootDir);
        } else {
            limparCacheModulo(caminhoCompleto);
            recarregarComandos(this.comandosMap, this.rootDir);
            recarregarListeners(this.listenersArray, this.rootDir);
        }
    }
}

module.exports = HotReload;
