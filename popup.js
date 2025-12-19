// Popup Script for Hanime Downloader

let currentVideoInfo = null;
let selectedQuality = null;
let currentDownloadId = null;
let progressPollInterval = null;

// DOM 元素
const elements = {
    loadingState: null,
    errorState: null,
    errorMessage: null,
    videoInfo: null,
    thumbnail: null,
    videoTitle: null,
    videoId: null,
    qualitySection: null,
    qualityList: null,
    downloadSection: null,
    downloadBtn: null,
    progressSection: null,
    progressFill: null,
    progressPercent: null,
    progressSpeed: null,
    progressEta: null,
    cancelBtn: null,
    successState: null,
    settingsBtn: null,
    activeDownloads: null,
    downloadsList: null
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    await loadVideoInfo();
    startProgressPolling();
});

// 初始化 DOM 元素引用
function initElements() {
    elements.loadingState = document.getElementById('loading-state');
    elements.errorState = document.getElementById('error-state');
    elements.errorMessage = document.getElementById('error-message');
    elements.videoInfo = document.getElementById('video-info');
    elements.thumbnail = document.getElementById('thumbnail');
    elements.videoTitle = document.getElementById('video-title');
    elements.videoId = document.getElementById('video-id');
    elements.qualitySection = document.getElementById('quality-section');
    elements.qualityList = document.getElementById('quality-list');
    elements.downloadSection = document.getElementById('download-section');
    elements.downloadBtn = document.getElementById('download-btn');
    elements.progressSection = document.getElementById('progress-section');
    elements.progressFill = document.getElementById('progress-fill');
    elements.progressPercent = document.getElementById('progress-percent');
    elements.progressSpeed = document.getElementById('progress-speed');
    elements.progressEta = document.getElementById('progress-eta');
    elements.cancelBtn = document.getElementById('cancel-btn');
    elements.successState = document.getElementById('success-state');
    elements.settingsBtn = document.getElementById('settings-btn');
    elements.activeDownloads = document.getElementById('active-downloads');
    elements.downloadsList = document.getElementById('downloads-list');

    // 綁定事件
    elements.downloadBtn.addEventListener('click', handleDownload);
    elements.cancelBtn?.addEventListener('click', handleCancel);
    elements.settingsBtn?.addEventListener('click', openSettings);
}

// 開啟設定頁面
function openSettings() {
    chrome.runtime.openOptionsPage();
}

// 開始進度輪詢
function startProgressPolling() {
    // 每 500ms 獲取一次進度
    progressPollInterval = setInterval(async () => {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getDownloadProgress' });
            if (response.success && response.downloads) {
                updateActiveDownloads(response.downloads);
            }
        } catch (error) {
            console.error('Failed to get progress:', error);
        }
    }, 500);
}

// 停止進度輪詢
function stopProgressPolling() {
    if (progressPollInterval) {
        clearInterval(progressPollInterval);
        progressPollInterval = null;
    }
}

// 更新活動下載列表
function updateActiveDownloads(downloads) {
    if (!elements.activeDownloads || !elements.downloadsList) return;

    if (downloads.length === 0) {
        elements.activeDownloads.classList.add('hidden');
        return;
    }

    elements.activeDownloads.classList.remove('hidden');

    elements.downloadsList.innerHTML = downloads.map(dl => {
        let statusClass = '';
        let statusText = '';

        if (dl.state === 'complete') {
            statusClass = 'complete';
            statusText = '✓ 完成';
        } else if (dl.state === 'failed' || dl.state === 'cancelled') {
            statusClass = 'failed';
            statusText = '✕ 失敗';
        } else {
            statusText = `${dl.progress || 0}%`;
        }

        return `
            <div class="download-item ${statusClass}">
                <div class="download-item-info">
                    <div class="download-item-name">${escapeHtml(dl.filename || 'Unknown')}</div>
                    <div class="download-item-progress">
                        <div class="download-item-bar">
                            <div class="download-item-fill" style="width: ${dl.progress || 0}%"></div>
                        </div>
                        <div class="download-item-stats">
                            <span class="download-item-percent ${statusClass}">${statusText}</span>
                            ${dl.state === 'in_progress' && dl.speed ? `<span class="download-item-speed">${formatBytes(dl.speed)}/s</span>` : ''}
                        </div>
                    </div>
                </div>
                ${dl.state === 'in_progress' ? `
                    <button class="download-item-cancel" data-id="${dl.downloadId}">✕</button>
                ` : ''}
            </div>
        `;
    }).join('');

    // 綁定取消按鈕
    elements.downloadsList.querySelectorAll('.download-item-cancel').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const downloadId = parseInt(btn.dataset.id);
            try {
                await chrome.runtime.sendMessage({
                    action: 'cancelDownload',
                    downloadId
                });
            } catch (error) {
                console.error('Failed to cancel:', error);
            }
        });
    });

    // 更新當前下載進度區塊
    const currentDl = downloads.find(dl => dl.downloadId === currentDownloadId);
    if (currentDl && elements.progressSection && !elements.progressSection.classList.contains('hidden')) {
        elements.progressFill.style.width = `${currentDl.progress || 0}%`;
        elements.progressPercent.textContent = `${currentDl.progress || 0}%`;

        if (currentDl.speed) {
            elements.progressSpeed.textContent = `${formatBytes(currentDl.speed)}/s`;
        }

        if (currentDl.eta) {
            elements.progressEta.textContent = `剩餘 ${formatTime(currentDl.eta)}`;
        }

        if (currentDl.state === 'complete') {
            showSuccess();
        } else if (currentDl.state === 'failed') {
            showError('下載失敗');
        }
    }
}

// 格式化檔案大小
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化時間
function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// HTML 轉義
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 載入影片資訊
async function loadVideoInfo() {
    try {
        showLoading();

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url?.includes('hanime1.me')) {
            throw new Error('請在 hanime1.me 的影片頁面上使用此擴充插件');
        }

        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });

        if (!response.success || !response.data || !response.data.videoId) {
            throw new Error('無法提取影片資訊，請確保您在影片頁面上');
        }

        currentVideoInfo = response.data;

        displayVideoInfo(currentVideoInfo);
        await loadQualities(currentVideoInfo.videoId);

    } catch (error) {
        console.error('Error loading video info:', error);
        showError(error.message);
    }
}

// 顯示影片資訊
function displayVideoInfo(info) {
    elements.videoTitle.textContent = info.title;
    elements.videoId.textContent = `ID: ${info.videoId}`;

    if (info.thumbnail) {
        elements.thumbnail.src = info.thumbnail;
        elements.thumbnail.alt = info.title;
    } else {
        elements.thumbnail.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="225"%3E%3Crect fill="%23667eea" width="400" height="225"/%3E%3Ctext fill="white" font-family="Arial" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Thumbnail%3C/text%3E%3C/svg%3E';
    }

    hideLoading();
    elements.videoInfo.classList.remove('hidden');
}

// 載入解析度選項
async function loadQualities(videoId) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'getVideoInfo',
            videoId: videoId
        });

        if (!response.success || !response.data.qualities || response.data.qualities.length === 0) {
            throw new Error('無法獲取解析度選項');
        }

        displayQualities(response.data.qualities);

    } catch (error) {
        console.error('Error loading qualities:', error);
        displayQualities([
            { quality: '最佳畫質', url: `https://hanime1.me/download?v=${videoId}` }
        ]);
    }
}

// 顯示解析度選項
function displayQualities(qualities) {
    elements.qualityList.innerHTML = '';

    // 獲取預設畫質設定
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        const defaultQuality = response?.settings?.defaultQuality || 'auto';
        let selectedIndex = 0;

        // 根據設定選擇預設項目
        if (defaultQuality !== 'auto') {
            const idx = qualities.findIndex(q =>
                q.quality.includes(defaultQuality) || q.rawQuality === defaultQuality
            );
            if (idx !== -1) selectedIndex = idx;
        }

        qualities.forEach((quality, index) => {
            const card = createQualityCard(quality, index);
            elements.qualityList.appendChild(card);

            // 選擇預設項目
            if (index === selectedIndex || quality.quality.includes('1080')) {
                selectQuality(card, quality);
            }
        });
    });

    elements.qualitySection.classList.remove('hidden');
}

// 建立解析度卡片
function createQualityCard(quality, index) {
    const card = document.createElement('div');
    card.className = 'quality-card';
    card.dataset.quality = quality.quality;
    card.dataset.url = quality.url;

    const isRecommended = quality.quality.includes('1080');

    card.innerHTML = `
    ${isRecommended ? '<div class="quality-badge">推薦</div>' : ''}
    <div class="quality-icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
        <path d="M8 21H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M12 17V21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="quality-name">${quality.quality}</div>
    <div class="quality-check">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

    card.addEventListener('click', () => selectQuality(card, quality));

    return card;
}

// 選擇解析度
function selectQuality(card, quality) {
    document.querySelectorAll('.quality-card').forEach(c => {
        c.classList.remove('selected');
    });

    card.classList.add('selected');
    selectedQuality = quality;

    elements.downloadSection.classList.remove('hidden');

    elements.downloadBtn.style.animation = 'none';
    setTimeout(() => {
        elements.downloadBtn.style.animation = 'slideUp 0.3s ease-out';
    }, 10);
}

// 處理下載
async function handleDownload() {
    if (!selectedQuality || !currentVideoInfo) {
        return;
    }

    try {
        elements.downloadBtn.disabled = true;
        elements.downloadBtn.innerHTML = `
      <div class="spinner-small"></div>
      <span>下載中...</span>
    `;

        // 獲取檔案名稱
        const filenameResponse = await chrome.runtime.sendMessage({
            action: 'generateFilename',
            videoInfo: currentVideoInfo,
            quality: selectedQuality.quality
        });

        const filename = filenameResponse.success
            ? filenameResponse.filename
            : sanitizeFilename(`${currentVideoInfo.title}_${selectedQuality.quality}.mp4`);

        const response = await chrome.runtime.sendMessage({
            action: 'download',
            data: {
                url: selectedQuality.url,
                filename: filename,
                videoId: currentVideoInfo.videoId
            }
        });

        if (response.success) {
            currentDownloadId = response.data.downloadId;

            // 顯示進度區塊
            elements.downloadSection.classList.add('hidden');
            elements.progressSection.classList.remove('hidden');
            elements.progressFill.style.width = '0%';
            elements.progressPercent.textContent = '0%';
            elements.progressSpeed.textContent = '準備中...';
            elements.progressEta.textContent = '剩餘 --:--';

        } else {
            throw new Error(response.error || '下載失敗');
        }

    } catch (error) {
        console.error('Download error:', error);
        alert(`下載失敗: ${error.message}`);

        elements.downloadBtn.disabled = false;
        elements.downloadBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>開始下載</span>
    `;
    }
}

// 處理取消
async function handleCancel() {
    if (!currentDownloadId) return;

    try {
        await chrome.runtime.sendMessage({
            action: 'cancelDownload',
            downloadId: currentDownloadId
        });

        elements.progressSection.classList.add('hidden');
        elements.downloadSection.classList.remove('hidden');
        elements.downloadBtn.disabled = false;
        elements.downloadBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>開始下載</span>
    `;

        currentDownloadId = null;

    } catch (error) {
        console.error('Cancel error:', error);
    }
}

// 清理檔案名稱
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 200);
}

// 顯示載入狀態
function showLoading() {
    elements.loadingState.classList.remove('hidden');
    elements.errorState.classList.add('hidden');
    elements.videoInfo.classList.add('hidden');
    elements.qualitySection.classList.add('hidden');
    elements.downloadSection.classList.add('hidden');
    elements.progressSection.classList.add('hidden');
    elements.successState.classList.add('hidden');
}

// 隱藏載入狀態
function hideLoading() {
    elements.loadingState.classList.add('hidden');
}

// 顯示錯誤
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorState.classList.remove('hidden');
    elements.loadingState.classList.add('hidden');
    elements.videoInfo.classList.add('hidden');
    elements.qualitySection.classList.add('hidden');
    elements.downloadSection.classList.add('hidden');
    elements.progressSection.classList.add('hidden');
}

// 顯示成功狀態
function showSuccess() {
    elements.successState.classList.remove('hidden');
    elements.videoInfo.classList.add('hidden');
    elements.qualitySection.classList.add('hidden');
    elements.downloadSection.classList.add('hidden');
    elements.progressSection.classList.add('hidden');

    const successIcon = elements.successState.querySelector('.success-icon');
    successIcon.style.animation = 'scaleIn 0.5s ease-out';

    setTimeout(() => {
        window.close();
    }, 3000);
}

// 頁面關閉時停止輪詢
window.addEventListener('unload', () => {
    stopProgressPolling();
});
