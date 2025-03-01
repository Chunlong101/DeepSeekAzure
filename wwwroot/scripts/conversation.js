const chatBox = document.getElementById('chatBox');
let conversationHistory = [];

function appendMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + sender;

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = sender === 'user' ? '👤' : '🤖';

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = content;

    messageDiv.appendChild(icon);
    messageDiv.appendChild(text);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function handleKeyPress(event) {
    const userInput = document.getElementById('userInput');
    if (event.key === 'Enter' && !userInput.disabled) {
        sendMessage();
    }
}

function clearHistory() {
    conversationHistory = [];
    chatBox.innerHTML = '';
}

let timerInterval;
let elapsedTime = 0;

function showSpinner() {
    const progressBarContainer = document.getElementById('progressBarContainer');
    progressBarContainer.style.display = 'block';
    const sendButton = document.querySelector('button[onclick="sendMessage()"]');
    sendButton.disabled = true;

    elapsedTime = 0;
    timer.textContent = `${elapsedTime} seconds`;
    timerInterval = setInterval(() => {
        elapsedTime += 1;
        timer.textContent = `${elapsedTime} seconds`;
    }, 1000);
}

function hideSpinner() {
    const spinner = document.getElementById('spinner');
    const timer = document.getElementById('timer');
    const progressBarContainer = document.getElementById('progressBarContainer');
    progressBarContainer.style.display = 'none';
    const sendButton = document.querySelector('button[onclick="sendMessage()"]');
    sendButton.disabled = false;

    clearInterval(timerInterval);
    timer.textContent = `0 seconds`;
}

async function sendMessage() {
    console.log("sendMessage() triggered");
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    if (!message || userInput.disabled) return;

    showSpinner();
    userInput.disabled = true; // Ensure input is disabled immediately
    conversationHistory.push({ role: 'user', content: message });
    appendMessage(message, 'user');
    userInput.value = '';

    try {
        const response = await fetch('/openai/deployments/deepseek-r1/Chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': document.getElementById('apiKey').value
            },
            body: JSON.stringify({
                messages: conversationHistory,
                model: document.getElementById('model').value,
                maxTokens: parseInt(document.getElementById('maxTokens').value, 10),
                temperature: parseFloat(document.getElementById('temperature').value),
                topP: parseFloat(document.getElementById('topP').value),
                n: parseInt(document.getElementById('n').value, 10),
                stream: document.getElementById('stream').checked,
                logprobs: document.getElementById('logprobs').value,
                stop: document.getElementById('stop').value,
                frequency_penalty: parseFloat(document.getElementById('frequency_penalty').value),
                presence_penalty: parseFloat(document.getElementById('presence_penalty').value)
            })
        });

        if (response.ok) {
            const data = await response.json();
            const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            conversationHistory.push({ role: 'assistant', content: content });
            appendMessage(content || 'No content found in response.', 'ai');
        } else {
            const errorText = await response.text();
            appendMessage('Error: ' + errorText, 'ai');
        }
    } catch (error) {
        appendMessage('Error: ' + (error.message || 'An unknown error occurred.'), 'ai');
    } finally {
        hideSpinner();
        userInput.disabled = false; // Re-enable input after response
    }
}

function toggleSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    const overlay = document.getElementById('overlay');
    if (menu.style.display === 'none') {
        menu.style.display = 'block';
        overlay.style.display = 'block';
    } else {
        menu.style.display = 'none';
        overlay.style.display = 'none';
    }
}

// Save API Key to localStorage when it changes
const apiKeyInput = document.getElementById('apiKey');
apiKeyInput.addEventListener('input', () => {
    localStorage.setItem('apiKey', apiKeyInput.value);
});

// Restore API Key from localStorage on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }
});

function dismissSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    const overlay = document.getElementById('overlay');
    menu.style.display = 'none';
    overlay.style.display = 'none';
}
