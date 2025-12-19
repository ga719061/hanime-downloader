// Options Page Script for Hanime Downloader

// 預設設定
const defaultSettings = {
    defaultQuality: 'auto',
    filenameTemplate: '{title}_{quality}',
    showNotifications: true
};

// DOM 元素
const elements = {
    defaultQuality: null,
    filenameTemplate: null,
    showNotifications: null,
    saveBtn: null,
    toast: null,
    filenamePreview: null
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    await loadSettings();
    bindEvents();
    updateFilenamePreview();
});

// 初始化 DOM 元素
function initElements() {
    elements.defaultQuality = document.getElementById('defaultQuality');
    elements.filenameTemplate = document.getElementById('filenameTemplate');
    elements.showNotifications = document.getElementById('showNotifications');
    elements.saveBtn = document.getElementById('saveBtn');
    elements.toast = document.getElementById('toast');
    elements.filenamePreview = document.getElementById('filenamePreview');
}

// 載入設定
async function loadSettings() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getSettings' });

        if (response.success && response.settings) {
            const settings = { ...defaultSettings, ...response.settings };

            elements.defaultQuality.value = settings.defaultQuality;
            elements.filenameTemplate.value = settings.filenameTemplate;
            elements.showNotifications.checked = settings.showNotifications;
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        // 使用預設值
        elements.defaultQuality.value = defaultSettings.defaultQuality;
        elements.filenameTemplate.value = defaultSettings.filenameTemplate;
        elements.showNotifications.checked = defaultSettings.showNotifications;
    }
}

// 綁定事件
function bindEvents() {
    // 儲存按鈕
    elements.saveBtn.addEventListener('click', saveSettings);

    // 檔名模板即時預覽
    elements.filenameTemplate.addEventListener('input', updateFilenamePreview);

    // 模板變數點擊插入
    document.querySelectorAll('.template-var').forEach(el => {
        el.addEventListener('click', () => {
            const varText = el.dataset.var;
            const input = elements.filenameTemplate;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const value = input.value;

            input.value = value.substring(0, start) + varText + value.substring(end);
            input.selectionStart = input.selectionEnd = start + varText.length;
            input.focus();
            updateFilenamePreview();
        });
    });
}

// 儲存設定
async function saveSettings() {
    const settings = {
        defaultQuality: elements.defaultQuality.value,
        filenameTemplate: elements.filenameTemplate.value || defaultSettings.filenameTemplate,
        showNotifications: elements.showNotifications.checked
    };

    try {
        elements.saveBtn.disabled = true;
        elements.saveBtn.innerHTML = '<span>⏳</span><span>儲存中...</span>';

        const response = await chrome.runtime.sendMessage({
            action: 'saveSettings',
            settings
        });

        if (response.success) {
            showToast('設定已儲存！');
            elements.saveBtn.classList.add('success');
            elements.saveBtn.innerHTML = '<span>✓</span><span>已儲存</span>';

            setTimeout(() => {
                elements.saveBtn.classList.remove('success');
                elements.saveBtn.innerHTML = '<span>💾</span><span>儲存設定</span>';
                elements.saveBtn.disabled = false;
            }, 2000);
        } else {
            throw new Error(response.error || 'Unknown error');
        }

    } catch (error) {
        console.error('Failed to save settings:', error);
        showToast('儲存失敗：' + error.message);
        elements.saveBtn.innerHTML = '<span>💾</span><span>儲存設定</span>';
        elements.saveBtn.disabled = false;
    }
}

// 更新檔名預覽
function updateFilenamePreview() {
    const template = elements.filenameTemplate.value || defaultSettings.filenameTemplate;

    const preview = template
        .replace('{title}', 'example_video')
        .replace('{id}', '12345')
        .replace('{quality}', '1080p');

    elements.filenamePreview.textContent = preview + '.mp4';
}

// 顯示 Toast 通知
function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}
