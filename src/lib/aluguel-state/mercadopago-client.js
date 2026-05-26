// src/lib/aluguel-state/mercadopago-client.js
const https = require('https');

const MP_API_BASE = 'api.mercadopago.com';

function requestMP(method, path, token, body = null) {
    return new Promise((resolve, reject) => {
        const postData = body ? JSON.stringify(body) : null;
        const options = {
            hostname: MP_API_BASE,
            path,
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': `sonic_${Date.now()}_${Math.random().toString(36).slice(2)}`
            }
        };
        if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

async function validarToken(token) {
    try {
        const res = await requestMP('GET', '/v1/payment_methods', token);
        return res.status === 200;
    } catch (e) {
        return false;
    }
}

async function criarCobrancaPix(token, valor, descricao, emailPagador = 'pagador@email.com') {
    const body = {
        transaction_amount: parseFloat(valor.toFixed(2)),
        description: descricao,
        payment_method_id: 'pix',
        payer: {
            email: emailPagador,
            first_name: 'Cliente',
            last_name: 'Bot'
        }
    };

    const res = await requestMP('POST', '/v1/payments', token, body);
    if (res.status === 201) {
        const pix = res.body.point_of_interaction?.transaction_data;
        return {
            id: String(res.body.id),
            qrCode: pix?.qr_code || null,
            qrCodeBase64: pix?.qr_code_base64 || null,
            status: res.body.status,
            valor: res.body.transaction_amount
        };
    }
    throw new Error(`Erro ao criar cobrança: ${res.status} - ${JSON.stringify(res.body)}`);
}

async function verificarPagamento(token, paymentId) {
    const res = await requestMP('GET', `/v1/payments/${paymentId}`, token);
    if (res.status === 200) {
        return {
            id: String(res.body.id),
            status: res.body.status,
            aprovado: res.body.status === 'approved'
        };
    }
    return null;
}

module.exports = { validarToken, criarCobrancaPix, verificarPagamento };
