const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Méthode non autorisée' })
        };
    }

    try {
        const { proxy } = JSON.parse(event.body);
        if (!proxy) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Proxy manquant' })
            };
        }

        // Teste le proxy en essayant d'accéder à httpbin.org
        const testUrl = 'https://httpbin.org/ip';
        const agent = new HttpsProxyAgent(`http://${proxy}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5 secondes max

        const response = await fetch(testUrl, {
            method: 'GET',
            agent: agent,
            signal: controller.signal
        });

        clearTimeout(timeout);

        return {
            statusCode: 200,
            body: JSON.stringify({
                proxy,
                working: response.ok
            })
        };
    } catch (error) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                proxy: proxy || 'inconnu',
                working: false
            })
        };
    }
};
