const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    try {
        const { username, proxy } = JSON.parse(event.body);
        const url = `https://discord.com/api/v9/auth/register`;

        const headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        };

        const payload = {
            username: username,
            password: "FakePass123!", // ⚠️ Mot de passe bidon (obligatoire pour l'API)
            email: `${username}@example.com`, // ⚠️ Email bidon
            invite: null,
            consent: true,
            date_of_birth: "1990-01-01",
            gift_code_sku_id: null,
            captcha_key: null
        };

        let agent = null;
        if (proxy) {
            try {
                const parts = proxy.split(':');
                if (parts.length >= 2) {
                    const host = parts[0];
                    const port = parts[1];
                    const auth = parts.length > 2 ? `${parts[2]}:${parts.slice(3).join(':')}` : null;
                    agent = auth ?
                        new HttpsProxyAgent(`http://${auth}@${host}:${port}`) :
                        new HttpsProxyAgent(`http://${host}:${port}`);
                }
            } catch (e) {
                console.error('Erreur format proxy:', e);
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            agent: agent,
            timeout: 10000
        });

        const data = await response.json();

        if (response.status === 400) {
            // Discord retourne une erreur si le username est pris
            if (data.errors && data.errors.username) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        username,
                        status: 'TAKEN',
                        proxy
                    })
                };
            }
        } else if (response.status === 200 || response.status === 201) {
            // Si la requête passe, le username est disponible
            return {
                statusCode: 200,
                body: JSON.stringify({
                    username,
                    status: 'AVAILABLE',
                    proxy
                })
            };
        } else if (response.status === 429) {
            return {
                statusCode: 429,
                body: JSON.stringify({
                    username,
                    status: 'RATELIMIT',
                    proxy
                })
            };
        } else {
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    username,
                    status: 'ERROR',
                    proxy,
                    error: data.message || 'Erreur inconnue'
                })
            };
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    username: 'inconnu',
                    status: 'PROXY_ERROR',
                    proxy: error.proxy,
                    error: error.message
                })
            };
        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    username: 'inconnu',
                    status: 'ERROR',
                    proxy: error.proxy,
                    error: error.message
                })
            };
        }
    }
};
