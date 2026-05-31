// === ÉTAT GLOBAL ===
let isRunning = false;
let isTestingProxies = false;
let checkedCount = 0;
let availableCount = 0;
let takenCount = 0;
let currentMode = '4c';
let proxies = [];
let workingProxies = [];
let proxyFileContent = "";
let abortController = null;

// === ÉLÉMENTS DOM ===
const modeCards = document.querySelectorAll('.mode-card');
const startButton = document.getElementById('startCheck');
const logOutput = document.getElementById('logOutput');
const amountInput = document.getElementById('amount');
const webhookUrlInput = document.getElementById('webhookUrl');
const customSettings = document.getElementById('customSettings');
const checkedCountEl = document.getElementById('checkedCount');
const availableCountEl = document.getElementById('availableCount');
const takenCountEl = document.getElementById('takenCount');
const usernameSettings = document.getElementById('usernameSettings');
const proxyCheckerSection = document.getElementById('proxyCheckerSection');
const settingsDescription = document.getElementById('settingsDescription');

// === CHARGEMENT DES PARAMÈTRES ===
function loadSettings() {
    const saved = localStorage.getItem('discordGenSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        amountInput.value = settings.amount || 100;
        webhookUrlInput.value = settings.webhookUrl || '';
        document.getElementById('length').value = settings.length || 4;
        document.getElementById('charPool').value = settings.charPool || 'alphanum';
        document.getElementById('delay').value = settings.delay || 1000;
    }
}

// === SAUVEGARDE DES PARAMÈTRES ===
function saveSettings() {
    const settings = {
        amount: amountInput.value,
        webhookUrl: webhookUrlInput.value,
        length: document.getElementById('length').value,
        charPool: document.getElementById('charPool').value,
        delay: document.getElementById('delay').value,
        mode: currentMode
    };
    localStorage.setItem('discordGenSettings', JSON.stringify(settings));
}

// === SÉLECTION DU MODE ===
modeCards.forEach(card => {
    card.addEventListener('click', () => {
        modeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        currentMode = card.dataset.mode;

        customSettings.style.display = (currentMode === 'custom') ? 'block' : 'none';

        if (currentMode === 'proxy') {
            usernameSettings.style.display = 'none';
            proxyCheckerSection.style.display = 'block';
            settingsDescription.textContent = "Teste la vie de tes proxys";
        } else {
            usernameSettings.style.display = 'block';
            proxyCheckerSection.style.display = 'none';
            settingsDescription.textContent = "Quantité · proxies · webhook · délai";
        }
    });
});

// === GÉNÉRATION D'UN USERNAME ===
function generateUsername() {
    const length = currentMode === 'custom' ? parseInt(document.getElementById('length').value) : 4;
    const charPool = document.getElementById('charPool').value;
    let chars = '';
    if (charPool === 'letters') {
        chars = 'abcdefghijklmnopqrstuvwxyz';
    } else if (charPool === 'alphanum') {
        chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    } else if (charPool === 'alphanum_underscore') {
        chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
    }
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// === AJOUT D'UN LOG ===
function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = type;
    logEntry.textContent = message;
    logOutput.appendChild(logEntry);
    logOutput.scrollTop = logOutput.scrollHeight;
}

// === MISE À JOUR DES STATS ===
function updateStats() {
    checkedCountEl.textContent = checkedCount;
    availableCountEl.textContent = availableCount;
    takenCountEl.textContent = takenCount;
    checkedCountEl.classList.add('info');
    availableCountEl.classList.add('success');
    takenCountEl.classList.add('error');
}

// === ENVOI À UN WEBHOOK (CORRIGÉ POUR ÉVITER L'ERREUR 400) ===
async function sendToWebhook(username, webhookUrl) {
    if (!webhookUrl || !username) {
        console.error('[Webhook] URL ou username manquant');
        return false;
    }

    // Vérifie le format de l'URL Discord
    const webhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+$/;
    if (!webhookRegex.test(webhookUrl)) {
        addLog(`[!] ❌ URL de webhook INVALIDE: "${webhookUrl}". Format attendu: https://discord.com/api/webhooks/ID/TOKEN`, 'error');
        return false;
    }

    try {
        // Payload SIMPLIFIÉ pour éviter les erreurs 400
        const payload = {
            content: `🎉 **Nouveau pseudo dispo !** : \`${username}\``,
            username: "Karam gen"
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            addLog(`[!] ❌ Erreur webhook (${response.status}): ${errorText.substring(0, 100)}`, 'error');
            return false;
        }

        addLog(`[✉️] Webhook envoyé avec succès: ${username}`, 'success');
        return true;
    } catch (e) {
        addLog(`[!] ❌ Échec réseau webhook: ${e.message}`, 'error');
        return false;
    }
}

// === VÉRIFICATION D'UN USERNAME ===
async function checkUsername(username, proxy = null) {
    try {
        const payload = { username };
        if (proxy) payload.proxy = proxy;

        const response = await fetch('/api/checkUsername', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortController?.signal
        });
        const data = await response.json();
        return data.status;
    } catch (error) {
        if (error.name === 'AbortError') return 'ABORTED';
        console.error('Erreur check username:', error);
        return "ERROR";
    }
}

// === FONCTION PRINCIPALE DE CHECK (AVEC DÉLAI CONFIGURABLE) ===
async function runChecker() {
    if (isRunning) {
        isRunning = false;
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        startButton.textContent = '▶ Lancer le check';
        startButton.disabled = false;
        addLog('⏹️ Check arrêté par l\'utilisateur', 'info');
        return;
    }

    isRunning = true;
    abortController = new AbortController();
    startButton.textContent = '⏹️ Arrêter';
    startButton.disabled = false;

    checkedCount = 0;
    availableCount = 0;
    takenCount = 0;
    logOutput.innerHTML = '';
    updateStats();
    saveSettings();

    const amount = parseInt(amountInput.value);
    const webhookUrl = webhookUrlInput.value.trim();
    const delay = parseInt(document.getElementById('delay').value) || 1000;

    addLog(`🚀 Démarrage du check (délai: ${delay}ms entre chaque requête)...`, 'info');

    const proxiesToUse = proxyFileContent.split('\n').filter(line => line.trim() !== '');
    let proxyIndex = 0;

    for (let i = 0; i < amount && isRunning; i++) {
        const username = generateUsername();
        addLog(`[✓] Check: ${username}`, 'info');

        const currentProxy = proxiesToUse.length > 0 ?
            proxiesToUse[proxyIndex % proxiesToUse.length] : null;
        if (proxiesToUse.length > 0) proxyIndex++;

        const status = await checkUsername(username, currentProxy);
        checkedCount++;

        if (status === 'ABORTED') {
    isRunning = false;
    break;
} else if (status === 'AVAILABLE') {
    availableCount++;
    addLog(`[+] AVAILABLE: ${username}${currentProxy ? ` (Proxy: ${currentProxy})` : ''}`, 'success');
    if (webhookUrl) await sendToWebhook(username, webhookUrl);
} else if (status === 'TAKEN') {
    takenCount++;
    addLog(`[-] TAKEN: ${username}${currentProxy ? ` (Proxy: ${currentProxy})` : ''}`, 'error'); // ⚠️ PROXY AFFICHÉ
} else if (status === 'RATELIMIT') {
    addLog(`[!] RATELIMIT: ${username}${currentProxy ? ` (Proxy: ${currentProxy})` : ''}`, 'error'); // ⚠️ PROXY AFFICHÉ
} else {
    addLog(`[!] ERREUR: ${username}${currentProxy ? ` (Proxy: ${currentProxy})` : ''} (${status})`, 'error'); // ⚠️ PROXY AFFICHÉ
        }
        updateStats();

        if (isRunning && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    isRunning = false;
    abortController = null;
    startButton.textContent = '▶ Lancer le check';
    startButton.disabled = false;
    addLog('✅ Check terminé !', 'info');
}

// === GESTION DU PROXY CHECKER ===
document.getElementById('selectProxyFileBtnUsername')?.addEventListener('click', () => {
    document.getElementById('proxyFileSelectorUsername').click();
});

document.getElementById('proxyFileSelectorUsername')?.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        proxyFileContent = e.target.result;
        document.getElementById('selectedProxyFileName').textContent = `Fichier sélectionné: ${file.name}`;
    };
    reader.readAsText(file);
});

document.getElementById('selectProxyFileBtn')?.addEventListener('click', () => {
    document.getElementById('proxyFileSelector').click();
});

document.getElementById('proxyFileSelector')?.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        proxies = e.target.result.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        workingProxies = [];
        document.getElementById('proxyList').innerHTML = `<div class="info" style="color: var(--primary);">✅ ${proxies.length} proxies chargés. Prêt à tester !</div>`;
        document.getElementById('downloadWorkingProxiesBtn').style.display = 'none';
        document.getElementById('proxyProgress').textContent = '';
        document.getElementById('selectedProxyFileNameProxy').textContent = `Fichier sélectionné: ${file.name}`;
    };
    reader.readAsText(file);
});

async function testProxy(proxy) {
    try {
        const response = await fetch('/api/checkProxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proxy })
        });
        const data = await response.json();
        return data.working;
    } catch (error) {
        console.error('Erreur test proxy:', error);
        return false;
    }
}

async function testAllProxies() {
    if (isTestingProxies || proxies.length === 0) return;
    isTestingProxies = true;

    workingProxies = [];
    const proxyListDiv = document.getElementById('proxyList');
    proxyListDiv.innerHTML = '';
    const progressDiv = document.getElementById('proxyProgress');
    progressDiv.textContent = `Test en cours... (0/${proxies.length})`;

    document.getElementById('testProxiesBtn').disabled = true;

    for (let i = 0; i < proxies.length; i++) {
        const proxy = proxies[i];
        const isWorking = await testProxy(proxy);

        if (isWorking) {
            workingProxies.push(proxy);
            proxyListDiv.innerHTML += `<div class="proxy-valid">✅ ${proxy} - VALIDE</div>`;
        } else {
            proxyListDiv.innerHTML += `<div class="proxy-invalid">❌ ${proxy} - INVALIDE</div>`;
        }

        progressDiv.textContent = `Test en cours... (${i+1}/${proxies.length})`;
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    progressDiv.textContent = `✅ Test terminé ! ${workingProxies.length}/${proxies.length} proxies valides.`;
    document.getElementById('testProxiesBtn').disabled = false;
    isTestingProxies = false;

    if (workingProxies.length > 0) {
        document.getElementById('downloadWorkingProxiesBtn').style.display = 'block';
    }
}

function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// === ÉCOUTEURS D'ÉVÉNEMENTS ===
startButton.addEventListener('click', runChecker);
document.getElementById('testProxiesBtn')?.addEventListener('click', testAllProxies);
document.getElementById('downloadWorkingProxiesBtn')?.addEventListener('click', () => {
    if (workingProxies.length === 0) {
        addLog('❌ Aucun proxy valide à télécharger !', 'error');
        return;
    }
    const content = workingProxies.join('\n');
    downloadFile(content, 'proxies_valides.txt');
    addLog(`✅ Téléchargement de ${workingProxies.length} proxies valides !`, 'success');
});

// === INITIALISATION ===
loadSettings();
updateStats();
