const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

    // Vérifie si le token existe
    if (!DISCORD_TOKEN || DISCORD_TOKEN === 'TON_TOKEN_ICI') {
        return {
            statusCode: 401,
            body: JSON.stringify({
                error: 'Token Discord manquant ou invalide. Ajoute-le dans Netlify → Environment Variables (DISCORD_TOKEN).',
                status: 'UNAUTHORIZED'
            })
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    try {
        const { username } = JSON.parse(event.body);
        const url = "https://discord.com/api/v9/users/@me/pomelo-attempt";
        const headers = {
            "Authorization": DISCORD_TOKEN,
            "Content-Type": "application/json"
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ username }),
            timeout: 5000
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
        } else if (response.status === 401) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    username,
                    status: 'UNAUTHORIZED',
                    error: 'Token Discord invalide ou expiré. Récupère un nouveau token utilisateur.'
                })
            };
        } else if (response.status === 429) {
            return { statusCode: 429, body: JSON.stringify({ username, status: 'RATELIMIT' }) };
        } else {
            return { statusCode: 500, body: JSON.stringify({ username, status: 'ERROR' }) };
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
