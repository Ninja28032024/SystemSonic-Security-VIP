// CAMINHO: src/commands/dono/autosair.js
// Comando para agendar a saída automática do bot de um grupo

const path = require("path");
const { config } = require(path.join(__dirname, '..', '..', '..', 'settings', 'config.js'));
const { isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { obterAgendamento, removerAgendamento, obterTodosAgendamentos } = require(path.join(__dirname, '..', '..', 'lib', 'autosair-state', 'autosair-state.js'));

// Variável para controlar se a verificação periódica já foi iniciada
let verificacaoInicializada = false;

/**
 * Inicia a verificação periódica de agendamentos vencidos
 */
function iniciarVerificacaoAutosair(sock) {
    if (verificacaoInicializada) {
        return;
    }

    verificacaoInicializada = true;

    // Verificar a cada 30 segundos
    setInterval(async () => {
        try {
            const agendamentos = obterTodosAgendamentos();

            for (const groupId in agendamentos) {
                const agendamento = agendamentos[groupId];

                if (!agendamento.ativo) {
                    continue;
                }

                // Verificar se o agendamento venceu
                if (Date.now() >= agendamento.saidaEm) {
                    try {
                        // Enviar mensagem de despedida
                        await sock.sendMessage(groupId, {
                            text: "Adeus! Estou saindo deste grupo conforme agendado."
                        });

                        // Aguardar 2 segundos antes de sair
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        // Sair do grupo
                        await sock.groupLeave(groupId);

                        // Remover agendamento
                        removerAgendamento(groupId);

                    } catch (error) {
                        console.error('[AUTOSAIR] Erro ao sair do grupo:', error.message);
                    }
                }
            }
        } catch (error) {
            console.error('[AUTOSAIR] Erro na verificacao periodica:', error.message);
        }
    }, 30000); // 30 segundos
}

module.exports = {
    name: "autosair",
    aliases: [],
    async execute(sock, m, options) {
        const { from, sender, isGroup } = options;

        try {
            // Iniciar verificação periódica na primeira execução
            iniciarVerificacaoAutosair(sock);
            
            // Verificar se é o dono
            const isDono = await isOwner(sender, config.ownerNumber, sock);
            
            if (!isDono) {
                await sock.sendMessage(from, {
                    text: "*ACESSO RESTRITO AO MEU DONO*\nEste comando só pode ser usado pelo meu dono."
                }, { quoted: m });
                return;
            }

            // Verificar se é um grupo
            if (!isGroup) {
                await sock.sendMessage(from, {
                    text: "Este comando só funciona em grupos!"
                }, { quoted: m });
                return;
            }

            // Verificar se já existe um agendamento ativo
            const agendamentoExistente = obterAgendamento(from);
            if (agendamentoExistente && agendamentoExistente.ativo) {
                await sock.sendMessage(from, {
                    text: "Ja existe um agendamento de saida ativo para este grupo!\n\nPara criar um novo, aguarde a execucao do anterior ou cancele manualmente.",
                    footer: "SYSTEM-SONIC - Autosair",
                    interactiveButtons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Cancelar Autosair", id: "autosair_cancel" }) }
                    ]
                }, { quoted: m });
                return;
            }

            // Enviar mensagem com as opções
            const mensagem = `*Interessante!* Entendi que deseja que eu saia deste grupo em um horario ou dia especifico. Para entender melhor algumas das alternativas pre-programadas abaixo refere-se ao seu interesse? Se sim, so clicar, se nao, clique em *Escolher dia/hora*.`;

            await sock.sendMessage(from, {
                text: mensagem,
                footer: "SYSTEM-SONIC - Autosair",
                interactiveButtons: [
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Sair daqui 5 dias", id: "autosair_5d" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Sair daqui 10 dias", id: "autosair_10d" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Sair daqui 15 dias", id: "autosair_15d" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Sair daqui 20 dias", id: "autosair_20d" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Sair daqui 25 dias", id: "autosair_25d" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Sair daqui 30 dias", id: "autosair_30d" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Escolher dia/hora", id: "autosair_custom" }) }
                ]
            }, { quoted: m });

        } catch (error) {
            console.error("[AUTOSAIR] Erro:", error.message);
            try {
                await sock.sendMessage(from, {
                    text: "Erro ao processar comando do autosair."
                }, { quoted: m });
            } catch (e) {
                console.error('[AUTOSAIR] Erro ao enviar mensagem de erro:', e.message);
            }
        }
    }
};
