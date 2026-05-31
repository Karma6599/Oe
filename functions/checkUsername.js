const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    try {
        const { username, proxy } = JSON.parse(event.body);
        const url = `https://discord.com/users/${username}`;

        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "fr-FR,fr;q=0.9",
            "Connection": "keep-alive"
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

        // ⚠️ On désactive les redirections automatiques
        const response = await fetch(url, {
            method: 'HEAD',
            headers: headers,
            agent: agent,
            timeout: 10000,
            redirect: 'manual' // ⚠️ NE PAS SUIVRE LES REDIRECTIONS
        });

        // ⚠️ NOUVELLE LOGIQUE :
        if (response.status === 404) {
            // 404 = Username N'EXISTE PAS → DISPONIBLE
            return {
                statusCode: 200,
                body: JSON.stringify({ username, status: 'AVAILABLE', proxy })
            };
        } else if (response.status === 200) {
            // 200 = Username EXISTE → PRIS
            return {
                statusCode: 200,
                body: JSON.stringify({ username, status: 'TAKEN', proxy })
            };
        } else if (response.status === 301 || response.status === 302) {
            // ⚠️ Discord redirige souvent vers /login
            const location = response.headers.get('location') || '';
            if (location.includes('/login')) {
                // Redirection vers /login = Username N'EXISTE PAS → DISPONIBLE
                return {
                    statusCode: 200,
                    body: JSON.stringify({ username, status: 'AVAILABLE', proxy })
                };
            } else if (location.includes('/users/')) {
                // Redirection vers /users/... = Username EXISTE → PRIS
                return {
                    statusCode: 200,
                    body: JSON.stringify({ username, status: 'TAKEN', proxy })
                };
            } else {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ username, status: 'ERROR', proxy, error: `Redirection vers ${location}` })
                };
            }
        } else if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after') || 5;
            return {
                statusCode: 429,
                body: JSON.stringify({ username, status: 'RATELIMIT', proxy, retryAfter: parseInt(retryAfter) * 1000 })
            };
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify({ username, status: 'ERROR', proxy, error: `HTTP ${response.status}` })
            };
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return {
                statusCode: 500,
                body: JSON.stringify({ username: 'inconnu', status: 'PROXY_ERROR', proxy: error.proxy, error: error.message })
            };
        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({ username: 'inconnu', status: 'ERROR', proxy: error.proxy, error: error.message })
            };
        }
    }
};
