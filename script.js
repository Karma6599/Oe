let isRunning = false;
let checkedCount = 0;
let availableCount = 0;
let takenCount = 0;
let currentMode = '4c';

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

modeCards.forEach(card => {
    card.addEventListener('click', () => {
        modeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        currentMode = card.dataset.mode;
        customSettings.style.display = (currentMode === 'custom') ? 'block' : 'none';
    });
});

function generateUsername() {
    const length = currentMode === 'custom' ? parseInt(document.getElementById('length').value) : 4;
    const charPool = document.getElementById('charPool').value;
    let chars = '';
    if (charPool === 'letters') chars = 'abcdefghijklmnopqrstuvwxyz';
    else if (charPool === 'alphanum') chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    else if (charPool === 'alphanum_underscore') chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = type;
    logEntry.textContent = message;
    logOutput.appendChild(logEntry);
    logOutput.scrollTop = logOutput.scrollHeight;
}

function updateStats() {
    checkedCountEl.textContent = checkedCount;
    availableCountEl.textContent = availableCount;
    takenCountEl.textContent = takenCount;
    checkedCountEl.classList.add('info');
    availableCountEl.classList.add('success');
    takenCountEl.classList.add('error');
}

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
        console.error('Erreur:', error);
        return "ERROR";
    }
}

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

startButton.addEventListener('click', runChecker);
loadSettings();
updateStats();
