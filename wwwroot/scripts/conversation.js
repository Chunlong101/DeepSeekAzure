const chatBox = document.getElementById('chatBox');
let conversationHistory = [];
let isProcessingRequest = false;

document.addEventListener('DOMContentLoaded', function() {
    // Wait to ensure hljs is fully loaded before configuring marked
    setTimeout(() => {
        // Configure marked.js to use highlight.js for code syntax highlighting with error handling
        marked.setOptions({
            highlight: function(code, language) {
                try {
                    if (typeof hljs !== 'undefined') {
                        const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
                        return hljs.highlight(validLanguage, code).value;
                    }
                    return code; // Fallback if hljs is not available
                } catch (e) {
                    console.warn('Syntax highlighting error:', e);
                    return code; // Return original code on error
                }
            },
            langPrefix: 'hljs language-'
        });
    }, 100); // Small delay to ensure scripts are loaded

    // Setup menu toggle button - fixing the color by removing hardcoded styling
    const menuToggleBtn = document.getElementById('menuToggle');
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', function(event) {
            toggleSecondaryMenu();
            event.stopPropagation();
        });
        // Remove the white color styling to use text-color from CSS
        menuToggleBtn.style.color = 'var(--text-color)';
    }
    
    // Setup send button
    const sendBtn = document.getElementById('sendButton');
    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            sendMessage();
        });
    }

    // Set up dark mode based on saved preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('hljs-dark-theme').disabled = false; 
        document.getElementById('darkModeToggle').innerHTML = '<i class="fa-solid fa-sun"></i> Theme'; // Fixed icon
    }

    // Set up event handlers for other buttons
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Add event listener for themeToggleMenu
    const themeToggleMenu = document.getElementById('themeToggleMenu');
    if (themeToggleMenu) {
        themeToggleMenu.addEventListener('click', toggleDarkMode);
    }
    
    const settingsIcon = document.getElementById('settingsIcon');
    if (settingsIcon) {
        settingsIcon.addEventListener('click', toggleSettingsMenu);
    }
    
    // Add event listener for export button
    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        exportButton.addEventListener('click', exportChat);
    }
    
    // Add event listener for clear button in secondary menu
    const clearButton = document.getElementById('clearButton');
    if (clearButton) {
        clearButton.addEventListener('click', clearHistory);
    }
    
    // Setup input for character counting
    const userInput = document.getElementById('userInput');
    if (userInput) {
        userInput.addEventListener('input', function() {
            updateCharCounter();
        });
        // Initial check
        updateCharCounter();
    }

    // Load conversation history if available
    loadConversationHistory();

    // 添加双击header时滚动到顶部的功能
    const header = document.querySelector('.header');
    if (header) {
        header.addEventListener('dblclick', function() {
            scrollToTop();
        });
    }
});

function scrollToBottom() {
    // Use a longer timeout to ensure DOM updates have completed
    setTimeout(() => {
        if (chatBox) {
            chatBox.scrollTop = chatBox.scrollHeight;
            
            // Add a second scroll attempt for mobile devices
            setTimeout(() => {
                chatBox.scrollTop = chatBox.scrollHeight;
            }, 100);
        }
    }, 50);
}

// 添加一个滚动到顶部的函数
function scrollToTop() {
    setTimeout(() => {
        if (chatBox) {
            chatBox.scrollTop = 0;
            
            // Add a second scroll attempt for mobile devices
            setTimeout(() => {
                chatBox.scrollTop = 0;
            }, 100);
        }
    }, 50);
}

function appendMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + sender;

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.innerHTML = sender === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

    const textContainer = document.createElement('div');
    textContainer.className = 'text-container';

    const text = document.createElement('div');
    text.className = 'text';
    text.innerHTML = marked.parse(content);

    // Add syntax highlighting to code blocks with error handling
    if (sender === 'ai') {
        try {
            if (typeof hljs !== 'undefined') {
                const codeBlocks = text.querySelectorAll('pre code');
                codeBlocks.forEach((codeBlock) => {
                    try {
                        hljs.highlightElement(codeBlock);
                    } catch (e) {
                        console.warn('Code highlighting failed for block:', e);
                    }
                });
            }
        } catch (e) {
            console.warn('Highlight.js is not available:', e);
        }
    }

    messageDiv.setAttribute('role', 'article');
    messageDiv.setAttribute('aria-live', 'polite');

    textContainer.appendChild(text);
    messageDiv.appendChild(icon);
    messageDiv.appendChild(textContainer);
    chatBox.appendChild(messageDiv);
    
    // Use the new scroll function instead of direct scrolling
    scrollToBottom();
    
    // Add a second scroll attempt after a delay
    setTimeout(scrollToBottom, 300);
    
    return messageDiv;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
    }, 100);
}

function handleKeyPress(event) {
    const userInput = document.getElementById('userInput');
    if (event.key === 'Enter' && !event.shiftKey && !userInput.disabled && userInput.value.trim() !== '') {
        event.preventDefault();
        sendMessage();
    }
}

// Update character counter with Twitter-like behavior
function updateCharCounter() {
    const input = document.getElementById('userInput');
    const counter = document.getElementById('charCounter');
    const progressCircle = document.getElementById('charProgressCircle');
    const wrapper = document.getElementById('charCounterWrapper');
    const sendButton = document.getElementById('sendButton');
    
    const charCount = input.value.trim().length;
    const maxLength = 2000; // Set your desired max length
    const warningThreshold = maxLength * 0.8;
    const circumference = 2 * Math.PI * 15.9155; // From the SVG path
    
    // Update counter
    counter.textContent = charCount;
    
    // Enable/disable send button based on content
    if (sendButton) {
        sendButton.disabled = charCount === 0;
    }
    
    // Reset classes
    wrapper.classList.remove('warning', 'limit');
    
    // Update progress circle and counter color
    if (charCount === 0) {
        progressCircle.style.strokeDashoffset = circumference;
        progressCircle.style.stroke = '#2563eb'; // Default blue
    } else if (charCount < warningThreshold) {
        const percentage = (charCount / maxLength) * 100;
        const dashoffset = circumference - (circumference * percentage / 100);
        progressCircle.style.strokeDashoffset = dashoffset;
        progressCircle.style.stroke = '#2563eb'; // Blue
    } else if (charCount < maxLength) {
        wrapper.classList.add('warning');
        const percentage = (charCount / maxLength) * 100;
        const dashoffset = circumference - (circumference * percentage / 100);
        progressCircle.style.strokeDashoffset = dashoffset;
        progressCircle.style.stroke = '#f59e0b'; // Amber/orange
    } else {
        wrapper.classList.add('limit');
        progressCircle.style.strokeDashoffset = 0;
        progressCircle.style.stroke = '#ef4444'; // Red
    }
    
    // Adjust textarea height
    input.style.height = 'auto';
    const newHeight = Math.min(input.scrollHeight, 200);
    input.style.height = newHeight + 'px';
}

function clearHistory() {
    if (confirm('Are you sure you want to clear the conversation history?')) {
        conversationHistory = [];
        chatBox.innerHTML = '';
    }
}

let timerInterval;
let elapsedTime = 0;

function showSpinner() {
    const thinkingIndicator = document.getElementById('thinkingIndicator');
    thinkingIndicator.style.display = 'flex'; // Show thinking indicator
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
        sendButton.disabled = true;
        sendButton.classList.add('loading');
    }

    elapsedTime = 0;
    const timer = document.getElementById('timer');
    timer.textContent = `${elapsedTime} seconds`;
    timerInterval = setInterval(() => {
        elapsedTime += 1;
        timer.textContent = `${elapsedTime} seconds`;
    }, 1000);
}

function hideSpinner() {
    const thinkingIndicator = document.getElementById('thinkingIndicator');
    thinkingIndicator.style.display = 'none'; // Hide thinking indicator
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
        sendButton.disabled = false;
        sendButton.classList.remove('loading');
    }

    clearInterval(timerInterval);
    const timer = document.getElementById('timer');
    timer.textContent = `0 seconds`;
}

async function sendMessage() {
    if (isProcessingRequest) return;
    
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    if (!message) return;

    isProcessingRequest = true;
    showSpinner();
    userInput.disabled = true;
    conversationHistory.push({ role: 'user', content: message });
    appendMessage(message, 'user');
    userInput.value = '';

    const isStream = document.getElementById('stream').checked;
    let aiMessageDiv;
    let buffer = '';

    try {
        if (isStream) {
            // Stream mode
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
                    max_tokens: parseInt(document.getElementById('maxTokens').value, 10),
                    temperature: parseFloat(document.getElementById('temperature').value),
                    top_p: parseFloat(document.getElementById('topP').value),
                    n: parseInt(document.getElementById('n').value, 10),
                    stream: true,
                    logprobs: document.getElementById('logprobs').value || null,
                    stop: document.getElementById('stop').value || null,
                    frequency_penalty: parseFloat(document.getElementById('frequency_penalty').value),
                    presence_penalty: parseFloat(document.getElementById('presence_penalty').value)
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    conversationHistory.push({ role: 'assistant', content: buffer });
                    const textElement = aiMessageDiv.querySelector('.text');
                    textElement.innerHTML = marked.parse(buffer);
                    
                    // Add syntax highlighting to code blocks with error handling
                    try {
                        if (typeof hljs !== 'undefined') {
                            const codeBlocks = textElement.querySelectorAll('pre code');
                            codeBlocks.forEach((codeBlock) => {
                                try {
                                    hljs.highlightElement(codeBlock);
                                } catch (e) {
                                    console.warn('Code highlighting failed for block:', e);
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('Highlight.js is not available:', e);
                    }
                    
                    // Ensure scroll to bottom happens after rendering
                    scrollToBottom();
                    
                    // Add a second scroll attempt after a longer delay for mobile
                    setTimeout(scrollToBottom, 500);
                    break;
                }
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
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
                            aiMessageDiv.querySelector('.text').textContent = buffer + '▌';
                            
                            // Scroll more frequently during streaming (not just on newlines)
                            if (content.length > 0) {
                                scrollToBottom();
                            }
                        } catch (e) {
                            console.error('Stream parsing error:', e);
                        }
                    }
                }
            }
        } else {
            // Non-streaming mode
            const response = await fetch('/openai/deployments/deepseek-r1/Chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': document.getElementById('apiKey').value
                },
                body: JSON.stringify({
                    messages: conversationHistory,
                    model: document.getElementById('model').value,
                    max_tokens: parseInt(document.getElementById('maxTokens').value, 10),
                    temperature: parseFloat(document.getElementById('temperature').value),
                    top_p: parseFloat(document.getElementById('topP').value),
                    n: parseInt(document.getElementById('n').value, 10),
                    stream: false,
                    logprobs: document.getElementById('logprobs').value || null,
                    stop: document.getElementById('stop').value || null,
                    frequency_penalty: parseFloat(document.getElementById('frequency_penalty').value),
                    presence_penalty: parseFloat(document.getElementById('presence_penalty').value)
                })
            });

            if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content || '';
                conversationHistory.push({ role: 'assistant', content });
                appendMessage(content, 'ai');
                // Double scroll to bottom with different timeouts
                scrollToBottom();
                setTimeout(scrollToBottom, 300);
            } else {
                const errorText = await response.text();
                appendMessage('Error: ' + errorText, 'ai');
            }
        }
    } catch (error) {
        appendMessage('Error: ' + (error.message || 'An unknown error occurred.'), 'ai');
    } finally {
        hideSpinner();
        userInput.disabled = false;
        userInput.focus();
        isProcessingRequest = false;
        
        // Multiple scroll attempts with increasing delays
        scrollToBottom();
        setTimeout(scrollToBottom, 200);
        setTimeout(scrollToBottom, 500);
    }
}

// Toggle secondary menu function
function toggleSecondaryMenu() {
    const secondaryMenu = document.getElementById('secondaryMenu');
    secondaryMenu.classList.toggle('active');
    
    // Stop event propagation to prevent immediate closing
    event.stopPropagation();
    
    // Add a global click listener to close the menu when clicking outside
    if (secondaryMenu.classList.contains('active')) {
        setTimeout(() => {
            document.addEventListener('click', closeSecondaryMenuOnClickOutside);
        }, 10);
    } else {
        document.removeEventListener('click', closeSecondaryMenuOnClickOutside);
    }
}

function closeSecondaryMenuOnClickOutside(event) {
    const secondaryMenu = document.getElementById('secondaryMenu');
    const menuToggle = document.getElementById('menuToggle');
    
    if (!secondaryMenu.contains(event.target) && event.target !== menuToggle) {
        secondaryMenu.classList.remove('active');
        document.removeEventListener('click', closeSecondaryMenuOnClickOutside);
    }
}

// Dark mode toggle
function toggleDarkMode(event) {
    // Add if event exists to prevent error, since event might be undefined
    if (event) {
        event.stopPropagation(); // Prevent menu from closing immediately when in menu
    }

    const darkMode = document.body.classList.contains('dark-mode');
    document.body.classList.toggle('dark-mode');
    document.getElementById('hljs-dark-theme').disabled = !darkMode;
    
    // Update icon in the menu - safely check if element exists first
    const themeToggleMenu = document.getElementById('themeToggleMenu');
    if (themeToggleMenu) {
        themeToggleMenu.innerHTML = darkMode ?
            '<i class="fa-solid fa-moon"></i> Theme' :
            '<i class="fa-solid fa-sun"></i> Theme';
    }
    
    // Save preference
    localStorage.setItem('darkMode', !darkMode);
}

// Save conversation history
function saveConversationHistory() {
    localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
}

// Load conversation from localStorage
function loadConversationHistory() {
    const history = localStorage.getItem('conversationHistory');
    
    if (history) {
        conversationHistory = JSON.parse(history);
        
        // Populate chat box with saved messages
        conversationHistory.forEach(msg => {
            appendMessage(msg.content, msg.role === 'user' ? 'user' : 'ai');
        });
    }
}

// Export chat history
function exportChat() {
    if (conversationHistory.length === 0) {
        showToast('No conversation to export');
        return;
    }
    
    // Create formatted text
    let exportText = "# DeepSeek Chat Export\n\n";
    conversationHistory.forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'DeepSeek AI';
        exportText += `## ${role}\n\n${msg.content}\n\n`;
    });
    
    // Create file and download
    const blob = new Blob([exportText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `deepseek-chat-export-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Chat exported successfully');
}

// Handle file uploads
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // For image files, you could upload and include them in the message
    // For text files, you could read their content
    
    const reader = new FileReader();
    
    if (file.type.startsWith('image/')) {
        showToast('Image uploading is not yet implemented');
        // In a real implementation, you would upload the image and include it in the message
    } else if (file.type === 'text/plain' || file.type === 'application/json' || 
              file.name.endsWith('.md') || file.name.endsWith('.csv')) {
        reader.onload = function(e) {
            const content = e.target.result;
            const userInput = document.getElementById('userInput');
            
            // Append file content to the current input
            userInput.value += `\n\nContent from ${file.name}:\n${content}`;
            updateCharCounter();
        };
        reader.readAsText(file);
    } else {
        showToast('Unsupported file type');
    }
    
    // Reset the input so the same file can be selected again
    event.target.value = '';
}

// Settings menu functions
function toggleSettingsMenu() {
    const settingsMenu = document.getElementById('settingsMenu');
    const overlay = document.getElementById('overlay');
    
    if (settingsMenu.style.display === 'none' || !settingsMenu.style.display) {
        settingsMenu.style.display = 'block';
        overlay.style.display = 'block';
        document.body.classList.add('settings-open');
    } else {
        dismissSettingsMenu();
    }
}

function dismissSettingsMenu() {
    const settingsMenu = document.getElementById('settingsMenu');
    const overlay = document.getElementById('overlay');
    
    settingsMenu.style.display = 'none';
    overlay.style.display = 'none';
    document.body.classList.remove('settings-open');
    
    // Save settings to localStorage
    saveSettings();
}

function saveSettings() {
    const settingsFields = [
        'apiKey', 'model', 'maxTokens', 'temperature', 'topP', 
        'n', 'logprobs', 'stop', 'frequency_penalty', 
        'presence_penalty', 'stream'
    ];
    
    const settings = {};
    settingsFields.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            settings[id] = element.type === 'checkbox' ? element.checked : element.value;
        }
    });
    
    localStorage.setItem('chatSettings', JSON.stringify(settings));
}

function updateNumberInput(inputId, value) {
    document.getElementById(inputId).value = value;
    saveSettings();
}

function updateRangeInput(rangeId, value) {
    document.getElementById(rangeId).value = value;
    saveSettings();
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        button.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        button.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
}

// Initialize settings parameters and menu
document.addEventListener('DOMContentLoaded', function() {
    const settingsMenu = document.getElementById('settingsMenu');
    settingsMenu.style.display = 'none';
    
    // Load settings from localStorage
    const savedSettings = JSON.parse(localStorage.getItem('chatSettings') || '{}');
    const settingsFields = [
        'apiKey', 'model', 'maxTokens', 'temperature', 'topP', 
        'n', 'logprobs', 'stop', 'frequency_penalty', 
        'presence_penalty', 'stream'
    ];

    // Apply saved settings or default values
    settingsFields.forEach(id => {
        const element = document.getElementById(id);
        if (element && savedSettings[id] !== undefined) {
            if (element.type === 'checkbox') {
                element.checked = savedSettings[id] === true || savedSettings[id] === 'true';
            } else {
                element.value = savedSettings[id];
            }
            
            // Also update range inputs if they exist
            const rangeElement = document.getElementById(`${id}Range`);
            if (rangeElement) {
                rangeElement.value = element.value;
            }
        }
    });

    // Add event listeners for all range inputs
    const rangeInputs = document.querySelectorAll('input[type="range"]');
    rangeInputs.forEach(input => {
        const targetId = input.id.replace('Range', '');
        input.addEventListener('input', function() {
            updateNumberInput(targetId, this.value);
        });
    });

    // Keep the secondaryMenu reference for the code below
    const secondaryMenu = document.getElementById('secondaryMenu');

    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        if (!secondaryMenu.contains(event.target) && 
            !document.getElementById('menuToggle').contains(event.target) && 
            secondaryMenu.classList.contains('active')) {
            toggleSecondaryMenu();
        }
    });

    // Close menu when a menu item is clicked
    const menuItems = secondaryMenu.querySelectorAll('.secondary-menu-btn');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            toggleSecondaryMenu();
        });
    });
    
    // Setup auto-resize and character counter for textarea
    const textarea = document.getElementById('userInput');
    textarea.addEventListener('input', updateCharCounter);
    
    // Initialize character counter
    updateCharCounter();
    
    // Initial focus on input
    textarea.focus();
});
