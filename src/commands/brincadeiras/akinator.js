// CAMINHO: src/commands/brincadeiras/akinator.js

const path = require('path');
const fs   = require('fs');

// ─── Diretório de memória ─────────────────────────────────────────────────────
const DATABASE_DIR = path.join(__dirname, '..', '..', '..', 'database', 'akinator');
if (!fs.existsSync(DATABASE_DIR)) fs.mkdirSync(DATABASE_DIR, { recursive: true });

// ─── Configuração ─────────────────────────────────────────────────────────────
const IA_API_URL     = 'https://systemzone.store/api/ia/multiai';
const IA_MODEL       = 'claude';
const TIMEOUT_SESSAO = 4 * 60 * 1000;

// ─── Sessões exportadas (o listener as acessa) ────────────────────────────────
const sessoesAtivas = new Map();
module.exports.sessoesAtivas = sessoesAtivas;

// ─── Helpers de memória JSON ──────────────────────────────────────────────────
function caminhoMemoria(sender) {
    return path.join(DATABASE_DIR, `${sender.replace(/[^a-z0-9]/gi, '_')}.json`);
}
function carregarMemoria(sender) {
    try {
        const arq = caminhoMemoria(sender);
        if (fs.existsSync(arq)) return JSON.parse(fs.readFileSync(arq, 'utf8'));
    } catch (_) {}
    return [];
}
function salvarMemoria(sender, historico) {
    try { fs.writeFileSync(caminhoMemoria(sender), JSON.stringify(historico, null, 2), 'utf8'); }
    catch (e) { console.error('[AKINATOR] Erro ao salvar memória:', e.message); }
}
function limparMemoria(sender) {
    try {
        const arq = caminhoMemoria(sender);
        if (fs.existsSync(arq)) fs.unlinkSync(arq);
    } catch (_) {}
}

// ─── Limpeza de sessão ────────────────────────────────────────────────────────
function limparSessao(sender) {
    const s = sessoesAtivas.get(sender);
    if (s?.timeoutId) clearTimeout(s.timeoutId);
    sessoesAtivas.delete(sender);
    limparMemoria(sender);
}
module.exports.limparSessao = limparSessao;

function resetarTimeout(sender, sock, from) {
    const s = sessoesAtivas.get(sender);
    if (!s) return;
    if (s.timeoutId) clearTimeout(s.timeoutId);
    s.timeoutId = setTimeout(async () => {
        limparSessao(sender);
        try {
            await sock.sendMessage(from, {
                text:
                    `*AKINATOR* 🎩\n\n` +
                    `Sessão encerrada por inatividade.\n\n` +
                    `Sua partida foi cancelada após 4 minutos sem resposta.\n` +
                    `Use o comando novamente quando quiser jogar.`,
                footer: 'SYSTEM-SONIC - Akinator'
            });
        } catch (_) {}
    }, TIMEOUT_SESSAO);
}
module.exports.resetarTimeout = resetarTimeout;

// ─── Chamada à API de IA ──────────────────────────────────────────────────────
async function consultarIA(prompt) {
    const url = new URL(IA_API_URL);
    url.searchParams.append('q', prompt);
    url.searchParams.append('model', IA_MODEL);
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dados = await res.json();
    if (!dados?.result) throw new Error('Resposta inválida da IA');
    return dados.result.trim();
}
module.exports.consultarIA = consultarIA;

// ─── Detecta palpite no texto da IA ──────────────────────────────────────────
function detectarPalpite(textoIA) {
    const linhas = textoIA.split('\n').map(l => l.trim());
    let nome = null, descricao = null;
    for (const linha of linhas) {
        if (linha.toUpperCase().startsWith('PALPITE:'))   nome      = linha.replace(/^palpite:/i, '').trim();
        if (linha.toUpperCase().startsWith('DESCRICAO:')) descricao = linha.replace(/^descricao:/i, '').trim();
    }
    return nome ? { nome, descricao } : null;
}
module.exports.detectarPalpite = detectarPalpite;

// ─── Prompts ──────────────────────────────────────────────────────────────────
const LIMITE_PERGUNTAS = 20;

function montarPromptInicio() {
    return (
        `Você é o Akinator, o gênio que lê mentes. Sua missão é descobrir qualquer personagem, pessoa famosa, animal ou objeto em no máximo ${LIMITE_PERGUNTAS} perguntas.\n\n` +
        `ESTRATÉGIA OBRIGATÓRIA — Árvore de decisão binária:\n` +
        `Cada pergunta deve cortar o universo de possibilidades ao meio. Pense sempre: "Esta pergunta elimina ~50% das opções se a resposta for sim, e outros ~50% se for não?"\n\n` +
        `ORDEM DE PRIORIDADE das primeiras perguntas:\n` +
        `1. É um ser humano? (elimina animais, objetos, lugares)\n` +
        `2. É um personagem fictício? (elimina pessoas reais)\n` +
        `3. É do sexo masculino? (divide metade dos resultados)\n` +
        `4. Ainda está vivo / ainda existe? (elimina metade por era)\n` +
        `5. É originário de um produto de mídia (filme, série, jogo, anime)? (foca a categoria)\n\n` +
        `Faça APENAS a primeira pergunta agora. Responda SOMENTE com a pergunta, sem nenhum texto extra.`
    );
}

function montarPrompt(historico, respostaAtual) {
    const perguntasFeitas = historico.filter(e => !e.pergunta.startsWith('[Palpite')).length;
    const restantes       = Math.max(0, LIMITE_PERGUNTAS - perguntasFeitas);
    const forcaPalpite    = perguntasFeitas >= LIMITE_PERGUNTAS;

    const confirmados = historico.filter(e => e.resposta === 'Sim' || e.resposta === 'Provavelmente sim');
    const descartados = historico.filter(e => e.resposta === 'Não'  || e.resposta === 'Provavelmente não');
    const indefinidos = historico.filter(e => e.resposta === 'Não sei');

    // Monta bloco de fatos estabelecidos como afirmações diretas — mais fácil para a IA processar
    const fatosConfirmados = confirmados
        .filter(e => !e.pergunta.startsWith('[Palpite'))
        .map(e => `✔ ${e.pergunta} → SIM`)
        .join('\n');

    const fatosDescartados = descartados
        .filter(e => !e.pergunta.startsWith('[Palpite'))
        .map(e => `✘ ${e.pergunta} → NÃO`)
        .join('\n');

    // Lista de TEMAS já cobertos para bloquear reformulações semânticas
    // A IA deve checar cada tema antes de perguntar
    const todasPerguntas = historico
        .filter(e => !e.pergunta.startsWith('[Palpite'))
        .map(e => e.pergunta);

    const SISTEMA =
        `Você é o Akinator, o gênio que lê mentes. Descubra o personagem, pessoa, animal ou objeto em no máximo ${LIMITE_PERGUNTAS} perguntas.\n\n` +

        `═══ FATOS JÁ ESTABELECIDOS ═══\n` +
        (fatosConfirmados ? fatosConfirmados + '\n' : '') +
        (fatosDescartados ? fatosDescartados + '\n' : '') +
        (indefinidos.length > 0 ? indefinidos.map(e => `? ${e.pergunta} → NÃO SEI`).join('\n') + '\n' : '') +
        (fatosConfirmados || fatosDescartados ? '\n' : '(Nenhum fato estabelecido ainda.)\n\n') +

        `═══ PERGUNTAS JÁ FEITAS (LISTA COMPLETA) ═══\n` +
        (todasPerguntas.length > 0
            ? todasPerguntas.map((p, i) => `${i + 1}. ${p}`).join('\n') + '\n\n'
            : '(Nenhuma ainda.)\n\n') +

        `═══ REGRA ANTI-REPETIÇÃO (CRÍTICA) ═══\n` +
        `Antes de formular a próxima pergunta, faça esta checagem mental obrigatória:\n` +
        `1. O TEMA central desta pergunta já aparece em alguma das perguntas listadas acima?\n` +
        `   - "decorativo", "enfeite", "ornamento" → mesmo tema. PROIBIDO reformular.\n` +
        `   - "usado para comer", "utensílio de cozinha", "serve para alimentação" → mesmo tema. PROIBIDO.\n` +
        `   - "é eletrônico", "funciona com energia", "tem circuito" → mesmo tema. PROIBIDO.\n` +
        `   Se sim para qualquer um: descarte essa pergunta e escolha um tema completamente diferente.\n` +
        `2. A resposta já pode ser inferida pelos fatos estabelecidos? Se sim: descarte e troque de tema.\n` +
        `3. Só formule a pergunta se passar nas duas checagens acima.\n\n` +

        `═══ ESTRATÉGIA DE ELIMINAÇÃO ═══\n` +
        `Cada pergunta deve cortar os candidatos restantes ao meio. Siga esta hierarquia:\n` +
        `1. Categoria: humano / animal / objeto / lugar / conceito abstrato\n` +
        `2. Real vs fictício (se humano ou personagem)\n` +
        `3. Gênero\n` +
        `4. Vivo/existente hoje\n` +
        `5. Mídia/área: filme, série, jogo, anime, esporte, música, política, ciência...\n` +
        `6. Época (anterior a 1990? anterior a 2000?)\n` +
        `7. Origem geográfica\n` +
        `8. Característica física marcante e única\n` +
        `9. Traço que identifica unicamente o alvo\n\n` +

        `═══ CONTROLE DE PROGRESSO ═══\n` +
        `Perguntas feitas: ${perguntasFeitas} / ${LIMITE_PERGUNTAS}. Restantes: ${restantes}.\n` +
        (forcaPalpite
            ? `*** LIMITE ATINGIDO. Declare SEU MELHOR PALPITE agora. Obrigatório. ***\n`
            : restantes <= 4
                ? `*** CRÍTICO: ${restantes} perguntas restantes. Declare o palpite se houver qualquer suspeita forte. ***\n`
                : restantes <= 8
                    ? `Atenção: ${restantes} restantes. Foque em perguntas que identificam unicamente o alvo.\n`
                    : `Se a lógica já aponta para um único candidato, declare o palpite sem esperar o limite.\n`) +
        `\n` +
        `Para palpite, responda EXATAMENTE assim (nada antes, nada depois):\n` +
        `PALPITE: [Nome completo]\n` +
        `DESCRICAO: [Uma frase]\n\n` +
        `Caso contrário, responda SOMENTE com a próxima pergunta. Zero texto extra.\n` +
        `\nIMPORTANTE: Antes de responder, faça este raciocínio interno (não escreva, apenas pense):\n` +
        `→ Quais candidatos ainda satisfazem TODOS os "Sim" do histórico?\n` +
        `→ Quais desses contradizem algum "Não"? Elimine-os.\n` +
        `→ Restou um único candidato forte? Se sim: declare o palpite.\n` +
        `→ Restaram vários? Escolha a pergunta que mais divide esse grupo.\n`;

    return SISTEMA + `\nÚltima resposta do jogador: "${respostaAtual}"\nSua próxima ação:`;
}
module.exports.montarPrompt = montarPrompt;

// ─── Texto da pergunta ────────────────────────────────────────────────────────
function montarTextoPergunta(pergunta, etapa, totalRespostas) {
    const barra = Math.min(Math.round((totalRespostas / LIMITE_PERGUNTAS) * 10), 10);
    const progresso = '█'.repeat(barra) + '░'.repeat(10 - barra);
    return (
        `*AKINATOR* 🎩\n\n` +
        `┌ Pergunta *${etapa}*\n` +
        `└ ${pergunta}\n\n` +
        `Progresso  [${progresso}]\n\n` +
        `_Use os botões abaixo para responder_`
    );
}
module.exports.montarTextoPergunta = montarTextoPergunta;
module.exports.salvarMemoria       = salvarMemoria;

// ─── Mapa de respostas legíveis ───────────────────────────────────────────────
const MAPA_LEGIVEL = {
    '1': 'Sim',
    '2': 'Não',
    '3': 'Não sei',
    '4': 'Provavelmente sim',
    '5': 'Provavelmente não'
};
module.exports.MAPA_LEGIVEL = MAPA_LEGIVEL;

// ─── Botões completos de resposta (7 botões) ──────────────────────────────────
function botoesResposta(sender) {
    return [
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Sim',               id: `aki_resp_${sender}_1` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Não',               id: `aki_resp_${sender}_2` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Não sei',           id: `aki_resp_${sender}_3` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Provavelmente sim', id: `aki_resp_${sender}_4` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Provavelmente não', id: `aki_resp_${sender}_5` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '↩ Voltar',          id: `aki_voltar_${sender}` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '✖ Encerrar',        id: `aki_parar_${sender}`  }) }
    ];
}

// ─── Botões de confirmação de palpite ────────────────────────────────────────
function botoesPalpite(sender) {
    return [
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Sim, acertou!', id: `aki_acertou_${sender}` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Não, errou!',   id: `aki_errou_${sender}`  }) }
    ];
}

// ─── Comando ──────────────────────────────────────────────────────────────────
module.exports.name    = 'akinator';
module.exports.aliases = ['aki'];

module.exports.execute = async function execute(sock, m, options) {
    const { from, sender, registerListener, removeListener } = options;

    if (sessoesAtivas.has(sender)) {
        await sock.sendMessage(from, {
            text:
                `*AKINATOR* 🎩\n\n` +
                `Você já tem uma partida em andamento!\n` +
                `Use os botões da pergunta atual ou clique em *Encerrar*.`,
            footer: 'SYSTEM-SONIC - Akinator'
        }, { quoted: m });
        return;
    }

    await sock.sendMessage(from, {
        text:
            `*AKINATOR* 🎩\n\n` +
            `🔮 Conectando ao gênio...\n\n` +
            `Pense em um *personagem*, *animal*, *objeto* ou *pessoa famosa*.\n` +
            `Não me diga nada — eu vou descobrir apenas com perguntas!`,
        footer: 'SYSTEM-SONIC - Akinator'
    }, { quoted: m });

    // ── Primeira pergunta ─────────────────────────────────────────────────────
    let primeiraPergunta;
    try {
        primeiraPergunta = await consultarIA(montarPromptInicio());
    } catch (err) {
        console.error('[AKINATOR] Erro ao obter primeira pergunta:', err.message);
        await sock.sendMessage(from, {
            text:
                `*AKINATOR* 🎩\n\n` +
                `Não foi possível conectar ao gênio no momento.\n` +
                `Tente novamente em alguns instantes.`,
            footer: 'SYSTEM-SONIC - Akinator'
        }, { quoted: m });
        return;
    }

    const sessao = {
        historico: [],
        etapa: 1,
        ultimaPergunta: primeiraPergunta,
        aguardandoConfirmacao: false,
        palpiteAtual: null,
        sock,
        from,
        removeListener,
        timeoutId: null
    };
    sessoesAtivas.set(sender, sessao);
    resetarTimeout(sender, sock, from);

    const listenerId = `${from}_${sender}`;

    await sock.sendMessage(from, {
        text: montarTextoPergunta(primeiraPergunta, 1, 0),
        footer: 'SYSTEM-SONIC - Akinator',
        interactiveButtons: botoesResposta(sender)
    }, { quoted: m });

    // ── Listener de texto como fallback (digitar 1-5, voltar, parar) ─────────
    registerListener(listenerId, async (novaMsg) => {
        const sessaoAtual = sessoesAtivas.get(sender);
        if (!sessaoAtual) return;

        const texto = (
            novaMsg.message?.conversation ||
            novaMsg.message?.extendedTextMessage?.text || ''
        ).trim().toLowerCase();

        // Aceita digitação como fallback caso os botões não funcionem
        let resposta = null;
        if (['1','2','3','4','5'].includes(texto))                          resposta = texto;
        else if (texto === '0' || texto === 'voltar')                       resposta = 'voltar';
        else if (texto === 'parar' || texto === 'sair' || texto === 'stop') resposta = 'parar';
        else if (sessaoAtual.aguardandoConfirmacao && texto === 'sim')      resposta = 'acertou';
        else if (sessaoAtual.aguardandoConfirmacao && texto === 'não' || texto === 'nao') resposta = 'errou';
        else return;

        await processarRespostaAkinator(sender, resposta, novaMsg, sock, from, removeListener, listenerId);
    }, TIMEOUT_SESSAO);
};

// ─── Processador central de resposta ─────────────────────────────────────────
// Chamado tanto pelo listener de texto quanto pelo listener de botões
async function processarRespostaAkinator(sender, resposta, novaMsg, sock, from, removeListener, listenerId) {
    const sessaoAtual = sessoesAtivas.get(sender);
    if (!sessaoAtual) return;

    resetarTimeout(sender, sock, from);

    // ── Encerrar ──────────────────────────────────────────────────────────────
    if (resposta === 'parar') {
        removeListener(listenerId);
        limparSessao(sender);
        await sock.sendMessage(from, {
            text:
                `*AKINATOR* 🎩\n\n` +
                `Partida encerrada por você.\n\n` +
                `Já vivi o suficiente para uma pergunta dessas... até a próxima!`,
            footer: 'SYSTEM-SONIC - Akinator'
        }, { quoted: novaMsg });
        return;
    }

    // ── Voltar pergunta anterior ───────────────────────────────────────────────
    if (resposta === 'voltar') {
        if (sessaoAtual.historico.length === 0) {
            await sock.sendMessage(from, {
                text: `*AKINATOR* 🎩\n\nEsta é a primeira pergunta, não há como voltar.`,
                footer: 'SYSTEM-SONIC - Akinator'
            }, { quoted: novaMsg });
            return;
        }
        const removida = sessaoAtual.historico.pop();
        sessaoAtual.etapa = Math.max(1, sessaoAtual.etapa - 1);
        sessaoAtual.aguardandoConfirmacao = false;
        sessaoAtual.palpiteAtual = null;
        salvarMemoria(sender, sessaoAtual.historico);
        sessaoAtual.ultimaPergunta = removida.pergunta;

        await sock.sendMessage(from, {
            text: montarTextoPergunta(removida.pergunta, sessaoAtual.etapa, sessaoAtual.historico.length),
            footer: 'SYSTEM-SONIC - Akinator',
            interactiveButtons: botoesResposta(sender)
        }, { quoted: novaMsg });
        return;
    }

    // ── Confirmação de palpite ────────────────────────────────────────────────
    if (sessaoAtual.aguardandoConfirmacao) {
        if (resposta === 'acertou') {
            removeListener(listenerId);
            const nomeAcertado = sessaoAtual.palpiteAtual;
            limparSessao(sender);
            await sock.sendMessage(from, {
                text:
                    `*AKINATOR* 🎩\n\n` +
                    `*${nomeAcertado}* — eu sabia!\n\n` +
                    `Nenhuma mente pode me enganar por muito tempo.\n` +
                    `Foi um prazer desafiar você.`,
                footer: 'SYSTEM-SONIC - Akinator'
            }, { quoted: novaMsg });
            return;
        }

        if (resposta === 'errou') {
            const palpiteErrado = sessaoAtual.palpiteAtual;
            sessaoAtual.aguardandoConfirmacao = false;
            sessaoAtual.palpiteAtual = null;
            sessaoAtual.historico.push({ pergunta: `[Palpite: ${palpiteErrado}]`, resposta: 'Errado' });
            salvarMemoria(sender, sessaoAtual.historico);

            await sock.sendMessage(from, {
                text:
                    `*AKINATOR* 🎩\n\n` +
                    `Errei desta vez...\n\n` +
                    `Vou continuar investigando — veja se resiste!`,
                footer: 'SYSTEM-SONIC - Akinator'
            }, { quoted: novaMsg });

            try {
                const textoIA = await consultarIA(montarPrompt(sessaoAtual.historico, 'Você errou, continue perguntando'));
                sessaoAtual.ultimaPergunta = textoIA;
                await sock.sendMessage(from, {
                    text: montarTextoPergunta(textoIA, sessaoAtual.etapa, sessaoAtual.historico.length),
                    footer: 'SYSTEM-SONIC - Akinator',
                    interactiveButtons: botoesResposta(sender)
                }, { quoted: novaMsg });
            } catch (err) {
                console.error('[AKINATOR] Erro ao retomar:', err.message);
                removeListener(listenerId);
                limparSessao(sender);
                await sock.sendMessage(from, {
                    text: `*AKINATOR* 🎩\n\nMeu poder se esgotou desta vez...\nTente iniciar uma nova partida.`,
                    footer: 'SYSTEM-SONIC - Akinator'
                }, { quoted: novaMsg });
            }
            return;
        }
        return;
    }

    // ── Resposta normal (1-5) ─────────────────────────────────────────────────
    const respostaLegivel = MAPA_LEGIVEL[resposta] || resposta;
    sessaoAtual.historico.push({ pergunta: sessaoAtual.ultimaPergunta, resposta: respostaLegivel });
    salvarMemoria(sender, sessaoAtual.historico);
    sessaoAtual.etapa++;

    const perguntasFeitas = sessaoAtual.historico.filter(e => !e.pergunta.startsWith('[Palpite')).length;

    let textoIA;
    try {
        textoIA = await consultarIA(montarPrompt(sessaoAtual.historico, respostaLegivel));
    } catch (err) {
        console.error('[AKINATOR] Erro ao consultar IA:', err.message);
        removeListener(listenerId);
        limparSessao(sender);
        await sock.sendMessage(from, {
            text: `*AKINATOR* 🎩\n\nPerdi a conexão com os espíritos...\nTente iniciar uma nova partida.`,
            footer: 'SYSTEM-SONIC - Akinator'
        }, { quoted: novaMsg });
        return;
    }

    // Se atingiu o limite e a IA teimou em não dar palpite, força uma segunda chamada
    const palpite = detectarPalpite(textoIA);
    if (!palpite && perguntasFeitas >= LIMITE_PERGUNTAS) {
        let textoForcado;
        try {
            const historicoFormatado = sessaoAtual.historico
                .filter(e => !e.pergunta.startsWith('[Palpite'))
                .map((e, i) => `${i + 1}. ${e.pergunta} → ${e.resposta}`)
                .join('\n');

            textoForcado = await consultarIA(
                `Você é o Akinator. O limite de perguntas foi atingido. Analise rigorosamente o histórico abaixo e determine o único candidato que satisfaz TODAS as respostas "Sim"/"Provavelmente sim" e não contradiz nenhum "Não"/"Provavelmente não".\n\n` +
                `HISTÓRICO:\n${historicoFormatado}\n\n` +
                `INSTRUÇÕES:\n` +
                `1. Liste mentalmente os candidatos que atendem a todos os "Sim" do histórico.\n` +
                `2. Elimine os que contradizem qualquer "Não".\n` +
                `3. O candidato restante mais provável é o palpite.\n` +
                `4. Se não houver candidato claro, escolha o mais consistente com os "Sim".\n` +
                `5. NÃO chute aleatoriamente — o palpite deve ser justificado pelo histórico.\n\n` +
                `Responda SOMENTE neste formato (nada antes, nada depois):\n` +
                `PALPITE: [Nome completo]\n` +
                `DESCRICAO: [Uma frase que justifica com base no histórico]`
            );
        } catch (_) {
            textoForcado = `PALPITE: Não consegui descobrir\nDESCRICAO: Você me venceu desta vez!`;
        }
        const palpiteForcado = detectarPalpite(textoForcado) || { nome: 'Não consegui descobrir', descricao: 'Você me venceu desta vez!' };

        sessaoAtual.aguardandoConfirmacao = true;
        sessaoAtual.palpiteAtual = palpiteForcado.nome;

        let textoPalpite =
            `*AKINATOR* 🎩\n\n` +
            `🔮 *Limite de perguntas atingido!*\n\n` +
            `Meu palpite final é:\n*${palpiteForcado.nome}*`;
        if (palpiteForcado.descricao) textoPalpite += `\n_${palpiteForcado.descricao}_`;
        textoPalpite += `\n\nEstou certo?`;

        await sock.sendMessage(from, {
            text: textoPalpite,
            footer: 'SYSTEM-SONIC - Akinator',
            interactiveButtons: botoesPalpite(sender)
        }, { quoted: novaMsg });
        return;
    }

    if (palpite) {
        sessaoAtual.aguardandoConfirmacao = true;
        sessaoAtual.palpiteAtual = palpite.nome;

        let textoPalpite =
            `*AKINATOR* 🎩\n\n` +
            `🔮 *Eu sei quem é!*\n\n` +
            `*${palpite.nome}*`;
        if (palpite.descricao) textoPalpite += `\n_${palpite.descricao}_`;
        textoPalpite += `\n\nEstou certo?`;

        await sock.sendMessage(from, {
            text: textoPalpite,
            footer: 'SYSTEM-SONIC - Akinator',
            interactiveButtons: botoesPalpite(sender)
        }, { quoted: novaMsg });
    } else {
        sessaoAtual.ultimaPergunta = textoIA;
        await sock.sendMessage(from, {
            text: montarTextoPergunta(textoIA, sessaoAtual.etapa, sessaoAtual.historico.length),
            footer: 'SYSTEM-SONIC - Akinator',
            interactiveButtons: botoesResposta(sender)
        }, { quoted: novaMsg });
    }
}
module.exports.processarRespostaAkinator = processarRespostaAkinator;
