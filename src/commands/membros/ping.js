const path = require("path");

module.exports = {
    name: "ping",
    aliases: ["p"],
    async execute(sock, m, options) {
        const { from } = options;

        const barras = ["[□□□□□□□□]", "[■□□□□□□□]", "[■■□□□□□□]", "[■■■□□□□□]", "[■■■■□□□□]", "[■■■■■□□□]", "[■■■■■■□□]", "[■■■■■■■□]", "[■■■■■■■■]"];
                                
        // Medir velocidade real usando timestamp da mensagem recebida
        const tempoMensagem = m.messageTimestamp * 1000;
        const tempoAtual = Date.now();
        const tempoFinal = tempoAtual - tempoMensagem;
        const tempoFormatado = (tempoFinal / 1000).toFixed(3);
                                
        // Enviar mensagem inicial com animação
        const msgInicial = await sock.sendMessage(from, { text: `*Medindo velocidade...* ${barras[0]}` }, { quoted: m });
                                
        // Animar a barra de progresso editando a mensagem 9 vezes com delays aleatórios
        for (let i = 1; i < barras.length; i++) {
            const delaysAleatorios = [500, 1000, 1500];
            const delayAleatorio = delaysAleatorios[Math.floor(Math.random() * delaysAleatorios.length)];
            await new Promise(resolve => setTimeout(resolve, delayAleatorio));
            await sock.sendMessage(from, { text: `*Medindo velocidade...* ${barras[i]}`, edit: msgInicial.key });
        }
                                
        // Enviar resultado com velocidade real medida
        const mensagem = `*Hahah!* Minha velocidade é impressionante, né mesmo? *Consigo dar a volta no mundo em [ ${tempoFormatado}ms ] ⚡*`;
        if (true) {
            await sock.sendMessage(from, {
                text: mensagem,
                footer: "SystemSonic - Medidor de Velocidade",
                interactiveButtons: [
                    {
                        name: "cta_copy",
                        buttonParamsJson: JSON.stringify({
                            display_text: "Copiar Latência⚡",
                            id: `speed_copy_[ ${tempoFormatado}ms ]`,
                            copy_code: `speed_copy_[ ${tempoFormatado}ms ]`
                        })
                    }
                ]
            }, { quoted: m });
        }
    },
};
