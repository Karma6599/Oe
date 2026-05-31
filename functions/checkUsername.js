const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

exports.handler = async (event, context) => {
    const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
    if (!DISCORD_TOKEN) {
        return {
            statusCode: 401,
            body: JSON.stringify({
                error: 'Token Discord manquant dans Netlify (DISCORD_TOKEN)',
                status: 'UNAUTHORIZED'
            })
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    try {
        const { username, proxy } = JSON.parse(event.body);
        const url = "https://discord.com/api/v9/users/@me/pomelo-attempt";

        const headers = {
            "Authorization": DISCORD_TOKEN,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        };

        let agent = null;
        if (proxy) {
            try {
                const parts = proxy.split(':');
                if (parts.length >= 2) {
                    const host = parts[0];
                    const port = parts[1];
                    const auth = parts.length > 2 ? `${parts[2]}:${parts.slice(3).join(':')}` : null;
                    if (auth) {
                        agent = new HttpsProxyAgent(`http://${auth}@${host}:${port}`);
                    } else {
                        agent = new HttpsProxyAgent(`http://${host}:${port}`);
                    }
                }
            } catch (e) {
                console.error('Erreur format proxy:', e);
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ username }),
            agent: agent,
            timeout: 10000
        });

        const data = await response.json();

        if (response.status === 200) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    username,
                    status: data.taken ? 'TAKEN' : 'AVAILABLE'
                })
            };
        } else if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after') || 60;
            return {
                statusCode: 429,
                body: JSON.stringify({
                    username,
                    status: 'RATELIMIT',
                    retryAfter: parseInt(retryAfter) * 1000
                })
            };
        } else if (response.status === 401) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    username,
                    status: 'UNAUTHORIZED'
                })
            };
        } else {
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    username,
                    status: 'ERROR'
                })
            };
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('proxy')) {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    username: error.username || 'inconnu',
                    status: 'PROXY_ERROR',
                    error: error.message
                })
            };
        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    username: 'inconnu',
                    status: 'ERROR',
                    error: error.message
                })
            };
        }
    }
};
