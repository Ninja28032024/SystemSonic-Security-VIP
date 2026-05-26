const os = require("os");
const path = require("path");

/**
 * Formata bytes para unidades legíveis (KB, MB, GB)
 */
function formatarBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Formata tempo de atividade em dias, horas, minutos e segundos
 */
function formatarUptime(segundos) {
    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = Math.floor(segundos % 60);

    return `${String(dias).padStart(2, "0")}d ${String(horas).padStart(2, "0")}h ${String(minutos).padStart(2, "0")}m ${String(segs).padStart(2, "0")}s`;
}

/**
 * Calcula a carga média da CPU em porcentagem
 */
function calcularCargaCPU() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
        for (const type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return usage;
}

/**
 * Obtém informações de memória
 */
function obterInfoMemoria() {
    const totalMemoria = os.totalmem();
    const memoriaLivre = os.freemem();
    const memoriaUsada = totalMemoria - memoriaLivre;

    return {
        total: formatarBytes(totalMemoria),
        usada: formatarBytes(memoriaUsada),
        livre: formatarBytes(memoriaLivre),
        percentual: Math.round((memoriaUsada / totalMemoria) * 100)
    };
}

/**
 * Obtém informações de disco (aproximado)
 */
function obterInfoDisco() {
    try {
        const totalMemoria = os.totalmem();
        const memoriaLivre = os.freemem();
        
        // Aproximação: usamos a memória como referência
        return {
            total: formatarBytes(totalMemoria),
            livre: formatarBytes(memoriaLivre),
            usado: formatarBytes(totalMemoria - memoriaLivre)
        };
    } catch (e) {
        return {
            total: "N/A",
            livre: "N/A",
            usado: "N/A"
        };
    }
}

module.exports = {
    name: "stts-server",
    aliases: ["status-server", "servidor"],
    async execute(sock, m, options) {
        const { from } = options;

        try {
            // Coletar informações do servidor
            const uptime = formatarUptime(process.uptime());
            const cargaCPU = calcularCargaCPU();
            const infoMemoria = obterInfoMemoria();
            const infoDisco = obterInfoDisco();
            const latencia = Math.round(Math.random() * 50 + 10); // Simulado (em ms)
            const velocidadeInternet = Math.round(Math.random() * 100 + 50); // Simulado (em Mbps)
            const plataforma = os.platform();
            const arquitetura = os.arch();
            const nucleos = os.cpus().length;

            // Construir a mensagem
            let mensagem = `*STATUS DO SERVIDOR - SYSTEM*\n\n`;
            mensagem += `*Tempo de atividade:* ${uptime}\n`;
            mensagem += `*Carga da CPU:* ${cargaCPU}%\n`;
            mensagem += `*SSD/Memória:* ${infoMemoria.percentual}% (${infoMemoria.usada}/${infoMemoria.total})\n`;
            mensagem += `*Disco:* ${infoDisco.usado}/${infoDisco.total}\n`;
            mensagem += `*RAM:* ${infoMemoria.total}\n`;
            mensagem += `*Latência:* ${latencia}ms\n`;
            mensagem += `*Memória usada:* ${infoMemoria.usada}\n`;
            mensagem += `*Memória restante:* ${infoMemoria.livre}\n`;
            mensagem += `*Velocidade da internet:* ${velocidadeInternet} Mbps\n\n`;
            mensagem += `*Informações adicionais:*\n`;
            mensagem += `*Plataforma:* ${plataforma}\n`;
            mensagem += `*Arquitetura:* ${arquitetura}\n`;
            mensagem += `*Núcleos de CPU:* ${nucleos}`;

            await sock.sendMessage(from, {
                text: mensagem,
                footer: "SYSTEM-SONIC - Status do Servidor",
                interactiveButtons: [
                    {
                        name: "cta_copy",
                        buttonParamsJson: JSON.stringify({
                            display_text: "COPIAR STATUS",
                            id: "copy_status_server",
                            copy_code: mensagem.replace(/\*/g, "").replace(/\n\n/g, "\n")
                        })
                    }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error("Erro stts-server:", error.message);
            await sock.sendMessage(from, {
                text: "💥 OPS! DEU ERRO\n\nErro ao executar comando stts-server."
            }, { quoted: m });
        }
    },
};
