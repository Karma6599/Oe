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

        // === CONFIGURATION DES HEADERS ===
        const headers = {
            "Authorization": DISCORD_TOKEN,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" // ⚠️ OBLIGATOIRE
        };

        // === CONFIGURATION DU PROXY (ENFIN UTILISÉ !) ===
        let agent = null;
        if (proxy) {
            // Si le proxy a un format IP:PORT:USER:PASS
            if (proxy.includes(':')) {
                const parts = proxy.split(':');
                if (parts.length === 4) {
                    // Format: IP:PORT:USER:PASS
                    agent = new HttpsProxyAgent(`http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`);
                } else if (parts.length === 2) {
                    // Format: IP:PORT
                    agent = new HttpsProxyAgent(`http://${proxy}`);
                }
            }
        }

        // === REQUÊTE AVEC LE PROXY ===
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ username }),
            agent: agent, // ⚠️ ICI, LE PROXY EST ENFIN UTILISÉ !
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
                    retryAfter: parseInt(retryAfter) * 1000 // en millisecondes
                })
            };
        } else {
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    username,
                    status: 'ERROR',
                    error: `Discord API error: ${response.status}`
                })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                username: 'inconnu',
                status: 'ERROR',
                error: error.message
            })
        };
    }
};
