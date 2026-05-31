const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    try {
        const { username, proxy } = JSON.parse(event.body);

        // Le vrai endpoint actuel pour check la dispo d'un pseudo
        const url = `https://discord.com/api/v9/users/@me/pomelo-attempt`;

        // ⚠️ METS LE TOKEN D'UN COMPTE POUBELLE ICI
        const DISCORD_TOKEN = "MTMzMTMzODYwNTY5OTc5MzA0Nw.GabHsJ.Iw5czBWy65Vzl6tdzQk7NYEFzCkZeEz1LCryiY";

        const headers = {
            "Content-Type": "application/json",
            "Authorization": DISCORD_TOKEN, // Essentiel pour cet endpoint
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        };

        const payload = {
            username: username
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

        // L'API pomelo-attempt renvoie un JSON avec { taken: true/false }
        if (response.status === 200) {
            if (data.taken === true) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ username, status: 'TAKEN', proxy })
                };
            } else if (data.taken === false) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ username, status: 'AVAILABLE', proxy })
                };
            }
        } else if (response.status === 429) {
            return {
                statusCode: 429,
                body: JSON.stringify({ username, status: 'RATELIMIT', proxy })
            };
        } else {
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    username,
                    status: 'ERROR',
                    proxy,
                    error: data.message || 'Erreur API'
                })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                username: 'inconnu',
                status: 'PROXY_ERROR',
                error: error.message
            })
        };
    }
};
