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
    return messageDiv; // 添加返回值用于流式更新
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
    userInput.disabled = true;
    conversationHistory.push({ role: 'user', content: message });
    appendMessage(message, 'user');
    userInput.value = '';

    const isStream = document.getElementById('stream').checked;
    let aiMessageDiv;

    try {
        if (isStream) {
            // 流式处理模式
            aiMessageDiv = appendMessage('▌', 'ai');
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
                    stream: true,
                    frequency_penalty: parseFloat(document.getElementById('frequency_penalty').value),
                    presence_penalty: parseFloat(document.getElementById('presence_penalty').value)
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    conversationHistory.push({ role: 'assistant', content: buffer });
                    hideSpinner();
                    aiMessageDiv.lastChild.textContent = buffer;
                    break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // 保存未完成的行

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.replace('data: ', '');
                        if (jsonStr === '[DONE]') {
                            continue;
                        }
                        try {
                            const data = JSON.parse(jsonStr);
                            const content = data.choices?.[0]?.delta?.content || '';
                            buffer += content;
                            aiMessageDiv.lastChild.textContent = buffer + '▌';
                        } catch (e) {
                            console.error('Stream parsing error:', e);
                        }
                    }
                }
            }
        }

        // 发送POST请求
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
                stream: isStream,
                logprobs: document.getElementById('logprobs').value,
                stop: document.getElementById('stop').value,
                frequency_penalty: parseFloat(document.getElementById('frequency_penalty').value),
                presence_penalty: parseFloat(document.getElementById('presence_penalty').value)
            })
        });

        if (!isStream) {
            // 非流式处理
            if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content || '';
                conversationHistory.push({ role: 'assistant', content });
                appendMessage(content, 'ai');
            } else {
                const errorText = await response.text();
                appendMessage('Error: ' + errorText, 'ai');
            }
        }
    } catch (error) {
        appendMessage('Error: ' + (error.message || 'An unknown error occurred.'), 'ai');
    } finally {
        if (!isStream) {
            hideSpinner();
        }
        userInput.disabled = false;
    }
}

function toggleSettingsMenu() {
    const settingsMenu = document.getElementById('settingsMenu');
    if (settingsMenu.style.display === 'none' || !settingsMenu.style.display) {
        settingsMenu.style.display = 'block';
    } else {
        settingsMenu.style.display = 'none';
    }
}

function dismissSettingsMenu() {
    const settingsMenu = document.getElementById('settingsMenu');
    settingsMenu.style.display = 'none';
}

// 初始化设置参数和菜单
document.addEventListener('DOMContentLoaded', function() {
    const settingsMenu = document.getElementById('settingsMenu');
    settingsMenu.style.display = 'none';
    
    // 从localStorage加载设置
    const savedSettings = JSON.parse(localStorage.getItem('chatSettings') || '{}');
    const settingsFields = [
        'apiKey', 'model', 'maxTokens', 'temperature', 'topP', 
        'n', 'logprobs', 'stop', 'frequency_penalty', 
        'presence_penalty', 'stream'
    ];

    // 应用保存的设置或默认值
    settingsFields.forEach(id => {
        const element = document.getElementById(id);
        if (element && savedSettings[id] !== undefined) {
            element.value = savedSettings[id];
            if (element.type === 'checkbox') {
                element.checked = savedSettings[id] === 'true';
            }
        }
    });

    // 为所有设置项添加变更监听
    settingsFields.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', function() {
                const currentSettings = JSON.parse(localStorage.getItem('chatSettings') || '{}');
                currentSettings[id] = element.type === 'checkbox' ? element.checked : element.value;
                localStorage.setItem('chatSettings', JSON.stringify(currentSettings));
            });
        }
    });

    // 为OK按钮绑定事件监听
    const okButton = document.getElementById('settingsOK');
    if (okButton) {
        okButton.addEventListener('click', dismissSettingsMenu);
    }
});
