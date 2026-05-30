// === ÉTAT GLOBAL ===
let isRunning = false;
let checkedCount = 0;
let availableCount = 0;
let takenCount = 0;
let currentMode = '4c';
let proxies = [];
let workingProxies = [];
let isTestingProxies = false;

// === ÉLÉMENTS DOM ===
const modeCards = document.querySelectorAll('.mode-card');
const startButton = document.getElementById('startCheck');
const logOutput = document.getElementById('logOutput');
const amountInput = document.getElementById('amount');
const proxyFileInput = document.getElementById('proxyFile');
const webhookUrlInput = document.getElementById('webhookUrl');
const customSettings = document.getElementById('customSettings');
const checkedCountEl = document.getElementById('checkedCount');
const availableCountEl = document.getElementById('availableCount');
const takenCountEl = document.getElementById('takenCount');
const proxyCheckerSection = document.getElementById('proxyCheckerSection');

// === CHARGEMENT DES PARAMÈTRES ===
function loadSettings() {
    const saved = localStorage.getItem('discordGenSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        amountInput.value = settings.amount || 100;
        proxyFileInput.value = settings.proxyFile || '';
        webhookUrlInput.value = settings.webhookUrl || '';
        document.getElementById('length').value = settings.length || 4;
        document.getElementById('charPool').value = settings.charPool || 'alphanum';
    }
}

// === SAUVEGARDE DES PARAMÈTRES ===
function saveSettings() {
    const settings = {
        amount: amountInput.value,
        proxyFile: proxyFileInput.value,
        webhookUrl: webhookUrlInput.value,
        length: document.getElementById('length').value,
        charPool: document.getElementById('charPool').value,
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
        proxyCheckerSection.style.display = (currentMode === 'proxy') ? 'block' : 'none';
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

// === VÉRIFICATION D'UN USERNAME (via Netlify Function) ===
async function checkUsername(username) {
    try {
        const response = await fetch('/api/checkUsername', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await response.json();
        return data.status;
    } catch (error) {
        console.error('Erreur check username:', error);
        return "ERROR";
    }
}

// === ENVOI À UN WEBHOOK ===
async function sendToWebhook(username, webhookUrl) {
    if (!webhookUrl) return;
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `🎉 **Nouveau pseudo dispo !** : \`${username}\``,
                username: "DiscordGen"
            })
        });
    } catch (e) {
        console.error('Erreur webhook:', e);
    }
}

// === FONCTION PRINCIPALE DE CHECK (USERNAMES) ===
async function runChecker() {
    if (isRunning) return;
    isRunning = true;
    startButton.disabled = true;
    startButton.textContent = '⏸️ Arrêter';

    checkedCount = 0;
    availableCount = 0;
    takenCount = 0;
    logOutput.innerHTML = '';
    updateStats();
    saveSettings();

    const amount = parseInt(amountInput.value);
    const webhookUrl = webhookUrlInput.value;
    addLog('🚀 Démarrage du check...', 'info');

    for (let i = 0; i < amount && isRunning; i++) {
        const username = generateUsername();
        addLog(`[✓] Check: ${username}`, 'info');

        const status = await checkUsername(username);
        checkedCount++;

        if (status === 'AVAILABLE') {
            availableCount++;
            addLog(`[+] AVAILABLE: ${username}`, 'success');
            if (webhookUrl) await sendToWebhook(username, webhookUrl);
        } else if (status === 'TAKEN') {
            takenCount++;
            addLog(`[-] TAKEN: ${username}`, 'error');
        } else {
            addLog(`[!] ERREUR: ${username} (${status})`, 'error');
        }
        updateStats();
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    isRunning = false;
    startButton.disabled = false;
    startButton.textContent = '▶ Lancer le check';
    addLog('✅ Check terminé !', 'info');
}

// === GESTION DU PROXY CHECKER ===
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
        const proxyListDiv = document.getElementById('proxyList');
        proxyListDiv.innerHTML = `<div class="info" style="color: var(--primary);">✅ ${proxies.length} proxies chargés. Prêt à tester !</div>`;
        document.getElementById('downloadWorkingProxiesBtn').style.display = 'none';
        document.getElementById('proxyProgress').textContent = '';
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
