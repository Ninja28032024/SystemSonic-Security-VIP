// src/commands/admin/lista-adv.js
const path = require("path");
const { isUserAdmin, isOwner } = require(path.join(__dirname, '..', '..', 'utils.js'));
const { obterMembrosGrupo, obterConfigAdv, formatarData } = require(path.join(__dirname, '..', '..', 'lib', 'adv-state', 'adv-state.js'));

module.exports = {
    name: "lista-adv",
    aliases: ["listaadv", "list-adv"],
    async execute(sock, m, options) {
        const { from, sender, config } = options;

        if (!from.endsWith("@g.us")) {
            await sock.sendMessage(from, { text: "Este comando só pode ser usado em grupos." }, { quoted: m });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const senderIsDono = await isOwner(sender, config.ownerNumber, sock);
            const senderIsAdmin = await isUserAdmin(sender, groupMetadata, sock);

            if (!senderIsDono && !senderIsAdmin) {
                await sock.sendMessage(from, { text: "*ACESSO RESTRITO!*\nApenas um administrador do grupo ou o dono do bot pode usar este comando." }, { quoted: m });
                return;
            }

            const membros = obterMembrosGrupo(from);
            const configAdv = obterConfigAdv(from);
            const limite = configAdv ? configAdv.limiteAdvertencias : '∞';

            const lista = Object.entries(membros);

            if (lista.length === 0) {
                await sock.sendMessage(from, {
                    text: "*LISTA DE MEMBROS ADVERTIDOS DESTE GRUPO*\n\n— membros advertidos —\nNenhum membro advertido no momento.\n\nLista adv - SystemSonic Security",
                    footer: "SYSTEM-SONIC - Sistema de Advertências"
                }, { quoted: m });
                return;
            }

            const mentions = lista.map(([jid]) => jid);
            let linhas = "";

            lista.forEach(([jid, dados], index) => {
                const numero = jid.split('@')[0];
                const data = dados.ultimaAdv ? formatarData(dados.ultimaAdv) : 'N/A';
                linhas += `${index + 1} - @${numero} ${dados.quantidade}/${limite} ${data}\n`;
            });

            const mensagem = `*LISTA DE MEMBROS ADVERTIDOS DESTE GRUPO*\n\n— membros advertidos —\n${linhas}\nLista adv - SystemSonic Security`;

            await sock.sendMessage(from, {
                text: mensagem,
                mentions,
                footer: "SYSTEM-SONIC - Sistema de Advertências"
            }, { quoted: m });

        } catch (error) {
            console.error("Erro lista-adv:", error.message);
            await sock.sendMessage(from, { text: "*Ops!* Erro ao executar comando lista-adv." }, { quoted: m });
        }
    }
};
