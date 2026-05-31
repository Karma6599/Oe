// === ÉTAT GLOBAL ===
let isRunning = false;
let checkedCount = 0;
let availableCount = 0;
let takenCount = 0;
let currentMode = '4c';
let proxyFileContent = "";
let abortController = null;
let workingProxies = [];
let currentProxyIndex = 0;

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
    if (charPool === 'letters') chars = 'abcdefghijklmnopqrstuvwxyz';
    else if (charPool === 'alphanum') chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    else if (charPool === 'alphanum_underscore') chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
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
}

// === ENVOI À UN WEBHOOK ===
async function sendToWebhook(username, webhookUrl) {
    if (!webhookUrl || !username) return false;
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `🎉 **Nouveau pseudo dispo !** : \`${username}\``, username: "Kxrma Bot" })
        });
        if (!response.ok) return false;
        addLog(`[✉️] Webhook envoyé: ${username}`, 'info');
        return true;
    } catch (e) { return false; }
}

// === VÉRIFICATION D'UN USERNAME ===
async function checkUsername(username, proxy = null) {
    try {
        const payload = { username, proxy };
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
        return "ERROR";
    }
}

// === FONCTION PRINCIPALE DE CHECK (AVEC GESTION DES PROXIES DÉFECTUEUX) ===
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

    addLog(`🚀 Démarrage du check (délai: ${delay}ms)...`, 'info');

    workingProxies = proxyFileContent.split('\n').filter(line => line.trim() !== '');
    currentProxyIndex = 0;

    for (let i = 0; i < amount && isRunning; i++) {
        const username = generateUsername();
        addLog(`[✓] Check: ${username}`, 'info');

        let currentProxy = null;
        if (workingProxies.length > 0) {
            currentProxy = workingProxies[currentProxyIndex % workingProxies.length];
            currentProxyIndex++;
        }

        try {
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
                addLog(`[-] TAKEN: ${username}${currentProxy ? ` (Proxy: ${currentProxy})` : ''}`, 'error');
            } else if (status === 'PROXY_ERROR' || status === 'ECONNREFUSED' || status === 'ETIMEDOUT' || status === 'ERROR') {
                if (currentProxy && workingProxies.includes(currentProxy)) {
                    const index = workingProxies.indexOf(currentProxy);
                    workingProxies.splice(index, 1);
                    addLog(`[!] Proxy défectueux: ${currentProxy} → Retiré !`, 'error');
                    currentProxyIndex--;
                }
                continue;
            } else {
                addLog(`[!] ERREUR: ${username}${currentProxy ? ` (Proxy: ${currentProxy})` : ''} (${status})`, 'error');
            }
            updateStats();

            if (isRunning && delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (error) {
            if (currentProxy && workingProxies.includes(currentProxy)) {
                const index = workingProxies.indexOf(currentProxy);
                workingProxies.splice(index, 1);
                addLog(`[!] Proxy défectueux (erreur réseau): ${currentProxy} → Retiré !`, 'error');
                currentProxyIndex--;
            }
            continue;
        }
    }

    isRunning = false;
    abortController = null;
    startButton.textContent = '▶ Lancer le check';
    startButton.disabled = false;
    addLog('✅ Check terminé !', 'info');
}

// === GESTION DES PROXIES ===
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

// === INITIALISATION ===
loadSettings();
updateStats();
startButton.addEventListener('click', runChecker);
