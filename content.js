// Content Script for Hanime Downloader
// 注入到 hanime1.me 頁面

(function () {
    'use strict';

    console.log('Hanime Downloader content script loaded');

    // 當前下載狀態
    let currentDownloads = [];

    // 樣式注入
    function injectStyles() {
        if (document.getElementById('hanime-dl-styles')) return;

        const style = document.createElement('style');
        style.id = 'hanime-dl-styles';
        style.textContent = `
            #hanime-dl-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            #hanime-dl-modal.show {
                opacity: 1;
                visibility: visible;
            }
            
            .hanime-dl-panel {
                background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 16px;
                padding: 24px;
                min-width: 360px;
                max-width: 420px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(102, 126, 234, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.1);
                transform: scale(0.9);
                transition: transform 0.3s ease;
            }
            
            #hanime-dl-modal.show .hanime-dl-panel {
                transform: scale(1);
            }
            
            .hanime-dl-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                padding-bottom: 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .hanime-dl-title {
                font-size: 18px;
                font-weight: 700;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin: 0;
            }
            
            .hanime-dl-close {
                width: 32px;
                height: 32px;
                border: none;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: #fff;
                font-size: 18px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .hanime-dl-close:hover {
                background: rgba(239, 68, 68, 0.3);
                color: #ef4444;
            }
            
            .hanime-dl-loading {
                text-align: center;
                padding: 40px 20px;
                color: #a0aec0;
            }
            
            .hanime-dl-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(102, 126, 234, 0.2);
                border-top-color: #667eea;
                border-radius: 50%;
                animation: hanime-spin 0.8s linear infinite;
                margin: 0 auto 16px;
            }
            
            @keyframes hanime-spin {
                to { transform: rotate(360deg); }
            }
            
            .hanime-dl-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .hanime-dl-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 16px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .hanime-dl-item:hover {
                background: rgba(102, 126, 234, 0.15);
                border-color: rgba(102, 126, 234, 0.3);
                transform: translateX(4px);
            }
            
            .hanime-dl-item.downloading {
                cursor: default;
                transform: none;
            }
            
            .hanime-dl-item.downloading:hover {
                transform: none;
            }
            
            .hanime-dl-quality {
                font-size: 15px;
                font-weight: 600;
                color: #fff;
            }
            
            .hanime-dl-size {
                font-size: 12px;
                color: #718096;
                margin-top: 2px;
            }
            
            .hanime-dl-icon {
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-size: 16px;
                flex-shrink: 0;
            }
            
            .hanime-dl-error {
                text-align: center;
                padding: 20px;
                color: #ef4444;
            }
            
            .hanime-dl-retry {
                margin-top: 12px;
                padding: 8px 20px;
                background: rgba(239, 68, 68, 0.2);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 8px;
                color: #ef4444;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .hanime-dl-retry:hover {
                background: rgba(239, 68, 68, 0.3);
            }

            /* 進度條樣式 */
            .hanime-dl-progress-container {
                margin-top: 10px;
            }

            .hanime-dl-progress-bar {
                width: 100%;
                height: 6px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
                overflow: hidden;
            }

            .hanime-dl-progress-fill {
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 3px;
                transition: width 0.3s ease;
                position: relative;
            }

            .hanime-dl-progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 255, 255, 0.3),
                    transparent
                );
                animation: shimmer 1.5s infinite;
            }

            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }

            .hanime-dl-progress-info {
                display: flex;
                justify-content: space-between;
                margin-top: 6px;
                font-size: 11px;
                color: #718096;
            }

            .hanime-dl-progress-percent {
                color: #667eea;
                font-weight: 600;
            }

            .hanime-dl-progress-speed {
                color: #10b981;
            }

            .hanime-dl-cancel-btn {
                margin-top: 8px;
                padding: 6px 12px;
                background: rgba(239, 68, 68, 0.2);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 6px;
                color: #ef4444;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .hanime-dl-cancel-btn:hover {
                background: rgba(239, 68, 68, 0.3);
            }

            /* 下載狀態區塊 */
            .hanime-dl-active-downloads {
                margin-bottom: 16px;
                padding: 16px;
                background: rgba(102, 126, 234, 0.1);
                border: 1px solid rgba(102, 126, 234, 0.2);
                border-radius: 10px;
            }

            .hanime-dl-active-title {
                font-size: 13px;
                font-weight: 600;
                color: #667eea;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .hanime-dl-active-item {
                padding: 10px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                margin-bottom: 8px;
            }

            .hanime-dl-active-item:last-child {
                margin-bottom: 0;
            }

            .hanime-dl-active-name {
                font-size: 12px;
                color: #e2e8f0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 8px;
            }

            .hanime-dl-complete {
                color: #10b981;
            }

            .hanime-dl-failed {
                color: #ef4444;
            }
        `;
        document.head.appendChild(style);
    }

    // 檢測當前頁面類型
    function detectPageType() {
        const url = window.location.href;
        if (url.includes('/watch?v=')) return 'watch';
        if (url.includes('/download?v=')) return 'download';
        return 'other';
    }

    // 從 URL 提取影片 ID
    function getVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    // 獲取影片資訊
    function getVideoInfo() {
        const pageType = detectPageType();
        const videoId = getVideoId();
        if (!videoId) return null;

        let title = 'Unknown';
        const titleElement = document.querySelector('h1') ||
            document.querySelector('.video-title') ||
            document.querySelector('title');
        if (titleElement) {
            title = titleElement.textContent.trim();
        }

        let thumbnail = '';
        const videoElement = document.querySelector('video');
        if (videoElement) {
            thumbnail = videoElement.poster || '';
        }
        if (!thumbnail) {
            const metaThumb = document.querySelector('meta[property="og:image"]');
            if (metaThumb) thumbnail = metaThumb.content;
        }

        return { videoId, title, thumbnail, pageType, url: window.location.href };
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

    // 創建下載選單 Modal
    function createModal() {
        if (document.getElementById('hanime-dl-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'hanime-dl-modal';
        modal.innerHTML = `
            <div class="hanime-dl-panel">
                <div class="hanime-dl-header">
                    <h3 class="hanime-dl-title">🚀 選擇畫質下載</h3>
                    <button class="hanime-dl-close">✕</button>
                </div>
                <div class="hanime-dl-active-downloads" style="display: none;">
                    <div class="hanime-dl-active-title">
                        <span>📥</span> 下載中
                    </div>
                    <div class="hanime-dl-active-list"></div>
                </div>
                <div class="hanime-dl-content">
                    <div class="hanime-dl-loading">
                        <div class="hanime-dl-spinner"></div>
                        <p>正在載入下載選項...</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.hanime-dl-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // 開啟 Modal
    function openModal() {
        const modal = document.getElementById('hanime-dl-modal');
        if (modal) {
            modal.classList.add('show');
            loadQualities();
            updateActiveDownloadsUI();
        }
    }

    // 關閉 Modal
    function closeModal() {
        const modal = document.getElementById('hanime-dl-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    // 更新活動下載 UI
    function updateActiveDownloadsUI() {
        const container = document.querySelector('.hanime-dl-active-downloads');
        const list = document.querySelector('.hanime-dl-active-list');

        if (!container || !list) return;

        if (currentDownloads.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        list.innerHTML = currentDownloads.map(dl => {
            let statusClass = '';
            let statusText = '';

            if (dl.state === 'complete') {
                statusClass = 'hanime-dl-complete';
                statusText = '✓ 完成';
            } else if (dl.state === 'failed' || dl.state === 'cancelled') {
                statusClass = 'hanime-dl-failed';
                statusText = '✕ 失敗';
            } else {
                statusText = `${dl.progress}%`;
            }

            return `
                <div class="hanime-dl-active-item" data-id="${dl.downloadId}">
                    <div class="hanime-dl-active-name">${dl.filename}</div>
                    <div class="hanime-dl-progress-bar">
                        <div class="hanime-dl-progress-fill" style="width: ${dl.progress}%"></div>
                    </div>
                    <div class="hanime-dl-progress-info">
                        <span class="hanime-dl-progress-percent ${statusClass}">${statusText}</span>
                        ${dl.state === 'in_progress' ? `
                            <span class="hanime-dl-progress-speed">${formatBytes(dl.speed || 0)}/s</span>
                        ` : ''}
                    </div>
                    ${dl.state === 'in_progress' ? `
                        <button class="hanime-dl-cancel-btn" data-id="${dl.downloadId}">取消下載</button>
                    ` : ''}
                </div>
            `;
        }).join('');

        // 綁定取消按鈕
        list.querySelectorAll('.hanime-dl-cancel-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const downloadId = parseInt(btn.dataset.id);
                try {
                    await chrome.runtime.sendMessage({
                        action: 'cancelDownload',
                        downloadId
                    });
                } catch (error) {
                    console.error('Failed to cancel download:', error);
                }
            });
        });
    }

    // 直接從下載頁面獲取畫質
    async function fetchQualitiesFromDownloadPage(videoId) {
        const downloadPageUrl = `https://hanime1.me/download?v=${videoId}`;
        console.log('Fetching download page:', downloadPageUrl);

        try {
            const response = await fetch(downloadPageUrl, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            console.log('Download page HTML length:', html.length);

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const qualities = [];

            const tables = doc.querySelectorAll('table');
            console.log('Found tables:', tables.length);

            tables.forEach(table => {
                const rows = table.querySelectorAll('tr');
                rows.forEach((row, idx) => {
                    if (row.querySelector('th')) return;

                    const cells = row.querySelectorAll('td');
                    console.log(`Row ${idx}: ${cells.length} cells`);

                    if (cells.length >= 3) {
                        let quality = '';
                        let url = '';

                        for (let i = 0; i < cells.length; i++) {
                            const text = cells[i]?.textContent?.trim();
                            if (text && /\d+p/i.test(text)) {
                                quality = text;
                                break;
                            }
                        }

                        const links = row.querySelectorAll('a[href]');
                        for (const link of links) {
                            const href = link.href || link.getAttribute('href');
                            if (href && !href.includes('javascript:')) {
                                url = href;
                                break;
                            }
                        }

                        if (!quality && cells[0]) {
                            quality = cells[0].textContent?.trim() || '未知畫質';
                        }

                        if (url) {
                            if (url.startsWith('/')) {
                                url = 'https://hanime1.me' + url;
                            }

                            // 獲取檔案大小
                            let size = '';
                            for (let i = 0; i < cells.length; i++) {
                                const text = cells[i]?.textContent?.trim();
                                if (text && /\d+(\.\d+)?\s*(MB|GB|KB)/i.test(text)) {
                                    size = text;
                                    break;
                                }
                            }

                            console.log('Found:', quality, url, size);
                            qualities.push({ quality, url, size });
                        }
                    }
                });
            });

            if (qualities.length === 0) {
                const allLinks = doc.querySelectorAll('a.btn, a[download], a[href*="download"]');
                console.log('Fallback links:', allLinks.length);

                allLinks.forEach((link, i) => {
                    let url = link.href || link.getAttribute('href');
                    const text = link.textContent?.trim() || `選項 ${i + 1}`;

                    if (url && !url.includes('javascript:')) {
                        if (url.startsWith('/')) {
                            url = 'https://hanime1.me' + url;
                        }
                        qualities.push({ quality: text, url });
                    }
                });
            }

            return qualities;

        } catch (error) {
            console.error('Failed to fetch download page:', error);
            throw error;
        }
    }

    // 從當前影片頁面直接提取影片源
    function getVideoSourcesFromPage() {
        const qualities = [];

        const sources = document.querySelectorAll('video source');
        sources.forEach(source => {
            const url = source.src || source.getAttribute('src');
            const type = source.type || 'video/mp4';
            if (url) {
                let quality = '影片';
                if (url.includes('1080')) quality = '1080p';
                else if (url.includes('720')) quality = '720p';
                else if (url.includes('480')) quality = '480p';
                else if (url.includes('360')) quality = '360p';

                qualities.push({ quality, url });
            }
        });

        const video = document.querySelector('video');
        if (video && video.src) {
            let quality = '影片';
            if (video.src.includes('1080')) quality = '1080p';
            else if (video.src.includes('720')) quality = '720p';
            qualities.push({ quality, url: video.src });
        }

        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
            const content = script.textContent || '';
            const matches = content.match(/(?:source|src|video_url|videoUrl|url)\s*[=:]\s*["']([^"']+\.mp4[^"']*)/gi);
            if (matches) {
                matches.forEach(match => {
                    const urlMatch = match.match(/["']([^"']+)/);
                    if (urlMatch && urlMatch[1]) {
                        qualities.push({ quality: '影片源', url: urlMatch[1] });
                    }
                });
            }
        });

        const unique = [];
        const seen = new Set();
        qualities.forEach(q => {
            if (!seen.has(q.url)) {
                seen.add(q.url);
                unique.push(q);
            }
        });

        return unique;
    }

    // 載入畫質選項
    async function loadQualities() {
        const content = document.querySelector('.hanime-dl-content');
        const videoId = getVideoId();
        const videoInfo = getVideoInfo();

        if (!videoId) {
            content.innerHTML = `
                <div class="hanime-dl-error">
                    <p>❌ 無法取得影片 ID</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="hanime-dl-loading">
                <div class="hanime-dl-spinner"></div>
                <p>正在載入下載選項...</p>
            </div>
        `;

        try {
            let qualities = [];

            qualities = getVideoSourcesFromPage();
            console.log('Sources from current page:', qualities.length);

            if (qualities.length === 0) {
                qualities = await fetchQualitiesFromDownloadPage(videoId);
                console.log('Sources from download page:', qualities.length);
            }

            if (qualities.length === 0) {
                throw new Error('找不到任何下載選項');
            }

            content.innerHTML = `
                <div class="hanime-dl-list">
                    ${qualities.map((q, i) => `
                        <div class="hanime-dl-item" data-url="${q.url}" data-quality="${q.quality}">
                            <div>
                                <div class="hanime-dl-quality">${q.quality}</div>
                                ${q.size ? `<div class="hanime-dl-size">${q.size}</div>` : ''}
                            </div>
                            <div class="hanime-dl-icon">⬇</div>
                        </div>
                    `).join('')}
                </div>
            `;

            content.querySelectorAll('.hanime-dl-item').forEach(item => {
                item.addEventListener('click', () => {
                    downloadVideo(item, videoInfo);
                });
            });

        } catch (error) {
            console.error('Failed to load qualities:', error);
            content.innerHTML = `
                <div class="hanime-dl-error">
                    <p>❌ ${error.message}</p>
                    <button class="hanime-dl-retry">重試</button>
                </div>
            `;

            content.querySelector('.hanime-dl-retry')?.addEventListener('click', loadQualities);
        }
    }

    // 下載影片
    async function downloadVideo(item, videoInfo) {
        const url = item.dataset.url;
        const quality = item.dataset.quality;

        // 防止重複點擊
        if (item.classList.contains('downloading')) return;

        item.classList.add('downloading');

        // 添加進度 UI
        const progressHtml = `
            <div class="hanime-dl-progress-container">
                <div class="hanime-dl-progress-bar">
                    <div class="hanime-dl-progress-fill" style="width: 0%"></div>
                </div>
                <div class="hanime-dl-progress-info">
                    <span class="hanime-dl-progress-percent">0%</span>
                    <span class="hanime-dl-progress-speed">準備中...</span>
                </div>
            </div>
        `;

        const existingProgress = item.querySelector('.hanime-dl-progress-container');
        if (existingProgress) {
            existingProgress.remove();
        }
        item.insertAdjacentHTML('beforeend', progressHtml);

        item.querySelector('.hanime-dl-icon').textContent = '⏳';

        try {
            let title = videoInfo?.title || 'video';
            title = title
                .replace(/\s*[-–—]\s*H動漫.*$/i, '')
                .replace(/\s*[-–—]\s*Hanime1\.me.*$/i, '')
                .replace(/\s*[-–—]\s*裏番.*$/i, '')
                .replace(/\s*[-–—]\s*線上看.*$/i, '')
                .trim();
            const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
            const filename = `${cleanTitle}_${quality.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;

            const response = await chrome.runtime.sendMessage({
                action: 'download',
                data: { url, filename, videoId: videoInfo?.videoId }
            });

            if (response.success) {
                item.querySelector('.hanime-dl-icon').textContent = '✓';
                item.querySelector('.hanime-dl-icon').style.background = 'linear-gradient(135deg, #10b981 0%, #34d399 100%)';
                item.querySelector('.hanime-dl-progress-percent').textContent = '下載已開始';
                item.querySelector('.hanime-dl-progress-percent').classList.add('hanime-dl-complete');
                item.querySelector('.hanime-dl-progress-speed').textContent = '';
            } else {
                throw new Error(response.error || '下載失敗');
            }

        } catch (error) {
            console.error('Download error:', error);
            item.classList.remove('downloading');
            item.querySelector('.hanime-dl-icon').textContent = '❌';
            item.querySelector('.hanime-dl-icon').style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';

            const progressContainer = item.querySelector('.hanime-dl-progress-container');
            if (progressContainer) {
                progressContainer.innerHTML = `<div style="color: #ef4444; font-size: 12px; margin-top: 8px;">❌ ${error.message}</div>`;
            }

            setTimeout(() => {
                item.querySelector('.hanime-dl-icon').textContent = '⬇';
                item.querySelector('.hanime-dl-icon').style.background = '';
                const pc = item.querySelector('.hanime-dl-progress-container');
                if (pc) pc.remove();
            }, 5000);
        }
    }

    // 監聽來自 background 的進度更新
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'getPageInfo') {
            const info = getVideoInfo();
            sendResponse({ success: true, data: info });
        }

        if (message.action === 'downloadProgress') {
            currentDownloads = message.downloads || [];
            updateActiveDownloadsUI();

            // 更新列表中對應項目的進度
            currentDownloads.forEach(dl => {
                const items = document.querySelectorAll(`.hanime-dl-item.downloading`);
                items.forEach(item => {
                    const progressFill = item.querySelector('.hanime-dl-progress-fill');
                    const progressPercent = item.querySelector('.hanime-dl-progress-percent');
                    const progressSpeed = item.querySelector('.hanime-dl-progress-speed');

                    if (progressFill && dl.progress !== undefined) {
                        progressFill.style.width = `${dl.progress}%`;
                    }
                    if (progressPercent) {
                        if (dl.state === 'complete') {
                            progressPercent.textContent = '✓ 完成';
                            progressPercent.classList.add('hanime-dl-complete');
                        } else if (dl.state === 'failed') {
                            progressPercent.textContent = '✕ 失敗';
                            progressPercent.classList.add('hanime-dl-failed');
                        } else {
                            progressPercent.textContent = `${dl.progress}%`;
                        }
                    }
                    if (progressSpeed && dl.speed) {
                        progressSpeed.textContent = `${formatBytes(dl.speed)}/s`;
                    }
                });
            });
        }

        return true;
    });

    // 在頁面上添加快速下載按鈕
    function addDownloadButton() {
        const pageType = detectPageType();
        if (pageType !== 'watch') return false;
        if (document.getElementById('hanime-dl-btn')) return true;

        const videoId = getVideoId();
        if (!videoId) return false;

        const existingDownloadBtn = document.getElementById('downloadBtn');
        const insertTarget = existingDownloadBtn?.parentElement ||
            document.querySelector('.video-actions') ||
            document.querySelector('.player-wrapper') ||
            document.querySelector('.video-info') ||
            document.querySelector('h1')?.parentElement;

        if (!insertTarget) return false;

        injectStyles();
        createModal();

        const button = document.createElement('button');
        button.id = 'hanime-dl-btn';
        button.innerHTML = '🚀 快速下載';
        button.style.cssText = `
            margin-left: 10px;
            padding: 10px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        `;

        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05) translateY(-2px)';
            button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1) translateY(0)';
            button.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        });

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openModal();
        });

        insertTarget.appendChild(button);
        console.log('Hanime DL button injected!');
        return true;
    }

    // 使用 MutationObserver 監聽 DOM 變化
    function initButtonInjection() {
        if (addDownloadButton()) return;

        const observer = new MutationObserver((mutations, obs) => {
            if (addDownloadButton()) {
                obs.disconnect();
            }
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });

        setTimeout(() => observer.disconnect(), 5000);
    }

    // 頁面載入後立即執行
    if (document.body) {
        initButtonInjection();
    } else {
        document.addEventListener('DOMContentLoaded', initButtonInjection);
    }

})();
