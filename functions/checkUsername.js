const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
    if (!DISCORD_TOKEN) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Token Discord manquant' })
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Méthode non autorisée' })
        };
    }

    try {
        const { username } = JSON.parse(event.body);
        const url = "https://discord.com/api/v9/users/@me/pomelo-attempt";
        const headers = {
            "Authorization": DISCORD_TOKEN,
            "Content-Type": "application/json"
        };
        const payload = { username };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
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
        } else if (response.status === 429) {
            return {
                statusCode: 429,
                body: JSON.stringify({ username, status: 'RATELIMIT' })
            };
        } else if (response.status === 401) {
            return {
                statusCode: 401,
                body: JSON.stringify({ username, status: 'UNAUTHORIZED' })
            };
        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({ username, status: 'ERROR' })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
