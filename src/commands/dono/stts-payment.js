const path = require("path");
const PaymentClient = require(path.join(__dirname, "..", "..", "lib", "payment-client", "payment-client.js"));
const { config } = require(path.join(__dirname, "..", "..", "..", "settings", "config.js"));
const { isOwner, isUserAdmin } = require(path.join(__dirname, "..", "..", "utils.js"));

const paymentClient = new PaymentClient();

function formatarData(dataIso) {
    if (!dataIso) return "Não registrado";

    const [ano, mes, dia] = String(dataIso).split("-");
    if (!ano || !mes || !dia) return dataIso;
    return `${dia}/${mes}/${ano}`;
}

function obterMesNumero(dataIso) {
    if (!dataIso) return "Não registrado";

    const partes = String(dataIso).split("-");
    return partes[1] ? String(Number(partes[1])) : "Não registrado";
}

function obterDiaSemana(dataIso) {
    if (!dataIso) return "não registrado";

    const data = new Date(`${dataIso}T12:00:00`);
    if (Number.isNaN(data.getTime())) return "não registrado";

    const dias = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
    return dias[data.getDay()] || "não registrado";
}

module.exports = {
    name: "stts-payment",
    aliases: ["status-payment", "status-pagamento", "stts-pay"],
    async execute(sock, m, options) {
        const { from, sender, prefixoAtual } = options;

        try {
            const isDono = await isOwner(sender, config.ownerNumber, sock);
            if (!isDono) {
                const groupMetadata = m.key.remoteJid.endsWith('@g.us') ? await sock.groupMetadata(m.key.remoteJid) : null;
                const isAdmin = groupMetadata ? await isUserAdmin(sender, groupMetadata, sock) : false;

                if (isAdmin) {
                    await sock.sendMessage(from, {
                        text: '*ACESSO RESTRITO AO MEU DONO🛡️*\nEste comando só deve ser usado pelo meu dono, nenhum admin ou membro comum deste grupo tem a permissão de usá-lo.',
                        footer: 'SYSTEM-SONIC - Status de Pagamento'
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(from, {
                        text: '*ACESSO RESTRITO AO MEU DONO⚔️*\nApenas o meu dono pode usar este comando, nenhum membro neste grupo é permitido.',
                        footer: 'SYSTEM-SONIC - Status de Pagamento'
                    }, { quoted: m });
                }
                return;
            }

            const ownerNumber = (config.ownerNumber || sender).split("@")[0];
            const paymentStatus = await paymentClient.getPaymentStatusInfo(ownerNumber);

            if (!paymentStatus || !paymentStatus.found) {
                const mensagemSemRegistro = '*STATUS DE PAGAMENTO MENSAL DO BOT*\n*Número do dono do Bot:* ' + ownerNumber + '\n*Data de pagamento:* Não registrado\n*Mês de pagamento:* Não registrado\n*Dia da semana do pagamento:* não registrado\n*Dia de vencimento:* Não registrado\n*Dia da semana de vencimento:* não registrado';

                await sock.sendMessage(from, {
                    text: mensagemSemRegistro,
                    footer: 'SYSTEM-SONIC - Status de Pagamento',
                    interactiveButtons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'COPIAR STATUS',
                                id: 'copy_status_payment',
                                copy_code: mensagemSemRegistro.replace(/\*/g, '').replace(/\n\n/g, '\n')
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'MENU',
                                id: `stts_payment_menu_${sender}`
                            })
                        }
                    ]
                }, { quoted: m });
                return;
            }

            const dataPagamento = formatarData(paymentStatus.purchaseDate);
            const mesPagamento = obterMesNumero(paymentStatus.purchaseDate);
            const diaSemanaPagamento = obterDiaSemana(paymentStatus.purchaseDate);
            const dataVencimento = formatarData(paymentStatus.expirationDate);
            const diaSemanaVencimento = obterDiaSemana(paymentStatus.expirationDate);

            const mensagem = `*STATUS DE PAGAMENTO MENSAL DO BOT*\n*Número do dono do Bot:* ${paymentStatus.ownerNumber || ownerNumber}\n*Data de pagamento:* ${dataPagamento}\n*Mês de pagamento:* ${mesPagamento}\n*Dia da semana do pagamento:* ${diaSemanaPagamento}\n*Dia de vencimento:* ${dataVencimento}\n*Dia da semana de vencimento:* ${diaSemanaVencimento}`;

            await sock.sendMessage(from, {
                text: mensagem,
                footer: 'SYSTEM-SONIC - Status de Pagamento',
                interactiveButtons: [
                    {
                        name: 'cta_copy',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'COPIAR STATUS',
                            id: 'copy_status_payment',
                            copy_code: mensagem.replace(/\*/g, '').replace(/\n\n/g, '\n')
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'MENU',
                            id: `stts_payment_menu_${sender}`
                        })
                    }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error('Erro stts-payment:', error.message);

            await sock.sendMessage(from, {
                text: `💥 OPS! DEU ERRO\n\nErro ao consultar o status de pagamento.\n\nSe o problema persistir, tente novamente usando ${prefixoAtual}stts-payment.`,
                footer: 'SYSTEM-SONIC - Status de Pagamento'
            }, { quoted: m });
        }
    },
};
