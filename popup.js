// Popup Script for Hanime Downloader

let currentVideoInfo = null;
let selectedQuality = null;

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
    successState: null
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    await loadVideoInfo();
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
    elements.successState = document.getElementById('success-state');

    // 綁定下載按鈕事件
    elements.downloadBtn.addEventListener('click', handleDownload);
}

// 載入影片資訊
async function loadVideoInfo() {
    try {
        showLoading();

        // 獲取當前活動的 tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url?.includes('hanime1.me')) {
            throw new Error('請在 hanime1.me 的影片頁面上使用此擴充插件');
        }

        // 向 content script 請求頁面資訊
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });

        if (!response.success || !response.data || !response.data.videoId) {
            throw new Error('無法提取影片資訊，請確保您在影片頁面上');
        }

        currentVideoInfo = response.data;

        // 顯示影片資訊
        displayVideoInfo(currentVideoInfo);

        // 載入可用的解析度
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
        // 向 background script 請求解析度資訊
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
        // 如果獲取解析度失敗，顯示一個預設選項
        displayQualities([
            { quality: '最佳畫質', url: `https://hanime1.me/download?v=${videoId}` }
        ]);
    }
}

// 顯示解析度選項
function displayQualities(qualities) {
    elements.qualityList.innerHTML = '';

    qualities.forEach((quality, index) => {
        const card = createQualityCard(quality, index);
        elements.qualityList.appendChild(card);
    });

    elements.qualitySection.classList.remove('hidden');
}

// 建立解析度卡片
function createQualityCard(quality, index) {
    const card = document.createElement('div');
    card.className = 'quality-card';
    card.dataset.quality = quality.quality;
    card.dataset.url = quality.url;

    // 判斷是否為推薦解析度（1080p）
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

    // 點擊事件
    card.addEventListener('click', () => selectQuality(card, quality));

    // 預設選擇第一個或推薦的解析度
    if (index === 0 || isRecommended) {
        selectQuality(card, quality);
    }

    return card;
}

// 選擇解析度
function selectQuality(card, quality) {
    // 移除其他卡片的選中狀態
    document.querySelectorAll('.quality-card').forEach(c => {
        c.classList.remove('selected');
    });

    // 設定當前卡片為選中
    card.classList.add('selected');
    selectedQuality = quality;

    // 顯示下載按鈕
    elements.downloadSection.classList.remove('hidden');

    // 添加動畫效果
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
        // 禁用下載按鈕
        elements.downloadBtn.disabled = true;
        elements.downloadBtn.innerHTML = `
      <div class="spinner-small"></div>
      <span>下載中...</span>
    `;

        // 生成檔案名稱
        const filename = sanitizeFilename(`${currentVideoInfo.title}_${selectedQuality.quality}.mp4`);

        // 發送下載請求到 background script
        const response = await chrome.runtime.sendMessage({
            action: 'download',
            data: {
                url: selectedQuality.url,
                filename: filename,
                videoId: currentVideoInfo.videoId
            }
        });

        if (response.success) {
            showSuccess();
        } else {
            throw new Error(response.error || '下載失敗');
        }

    } catch (error) {
        console.error('Download error:', error);
        alert(`下載失敗: ${error.message}`);

        // 恢復按鈕狀態
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

// 清理檔案名稱
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 200); // 限制檔案名稱長度
}

// 顯示載入狀態
function showLoading() {
    elements.loadingState.classList.remove('hidden');
    elements.errorState.classList.add('hidden');
    elements.videoInfo.classList.add('hidden');
    elements.qualitySection.classList.add('hidden');
    elements.downloadSection.classList.add('hidden');
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
}

// 顯示成功狀態
function showSuccess() {
    elements.successState.classList.remove('hidden');
    elements.videoInfo.classList.add('hidden');
    elements.qualitySection.classList.add('hidden');
    elements.downloadSection.classList.add('hidden');

    // 添加成功動畫
    const successIcon = elements.successState.querySelector('.success-icon');
    successIcon.style.animation = 'scaleIn 0.5s ease-out';

    // 3秒後自動關閉
    setTimeout(() => {
        window.close();
    }, 3000);
}
