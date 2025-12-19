// Content Script for Hanime Downloader
// 注入到 hanime1.me 頁面

(function () {
    'use strict';

    console.log('Hanime Downloader content script loaded');

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
                min-width: 320px;
                max-width: 400px;
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
                opacity: 0.6;
                pointer-events: none;
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
        }
    }

    // 關閉 Modal
    function closeModal() {
        const modal = document.getElementById('hanime-dl-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    // 直接從下載頁面獲取畫質（在 content script 中執行，有正確的 cookie）
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

            // 找所有表格
            const tables = doc.querySelectorAll('table');
            console.log('Found tables:', tables.length);

            tables.forEach(table => {
                const rows = table.querySelectorAll('tr');
                rows.forEach((row, idx) => {
                    // 跳過表頭
                    if (row.querySelector('th')) return;

                    const cells = row.querySelectorAll('td');
                    console.log(`Row ${idx}: ${cells.length} cells`);

                    if (cells.length >= 3) {
                        // 嘗試多種結構
                        let quality = '';
                        let url = '';

                        // 找解析度文字 (通常包含 "p" 如 720p, 1080p)
                        for (let i = 0; i < cells.length; i++) {
                            const text = cells[i]?.textContent?.trim();
                            if (text && /\d+p/i.test(text)) {
                                quality = text;
                                break;
                            }
                        }

                        // 找下載連結
                        const links = row.querySelectorAll('a[href]');
                        for (const link of links) {
                            const href = link.href || link.getAttribute('href');
                            if (href && !href.includes('javascript:')) {
                                url = href;
                                break;
                            }
                        }

                        // 如果沒找到解析度文字，用第一個 cell
                        if (!quality && cells[0]) {
                            quality = cells[0].textContent?.trim() || '未知畫質';
                        }

                        if (url) {
                            // 確保完整 URL
                            if (url.startsWith('/')) {
                                url = 'https://hanime1.me' + url;
                            }

                            console.log('Found:', quality, url);
                            qualities.push({ quality, url });
                        }
                    }
                });
            });

            // 備選：找所有類似下載按鈕的連結
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

        // 方法 1: 從 video source 標籤
        const sources = document.querySelectorAll('video source');
        sources.forEach(source => {
            const url = source.src || source.getAttribute('src');
            const type = source.type || 'video/mp4';
            if (url) {
                // 嘗試從 URL 判斷畫質
                let quality = '影片';
                if (url.includes('1080')) quality = '1080p';
                else if (url.includes('720')) quality = '720p';
                else if (url.includes('480')) quality = '480p';
                else if (url.includes('360')) quality = '360p';

                qualities.push({ quality, url });
            }
        });

        // 方法 2: 從 video 標籤的 src
        const video = document.querySelector('video');
        if (video && video.src) {
            let quality = '影片';
            if (video.src.includes('1080')) quality = '1080p';
            else if (video.src.includes('720')) quality = '720p';
            qualities.push({ quality, url: video.src });
        }

        // 方法 3: 從頁面 script 中提取
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
            const content = script.textContent || '';
            // 匹配類似 source: "url" 或 src: "url" 的模式
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

        // 去重
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

            // 方法 1: 先嘗試從當前頁面直接獲取影片源
            qualities = getVideoSourcesFromPage();
            console.log('Sources from current page:', qualities.length);

            // 方法 2: 如果沒找到，從下載頁面獲取
            if (qualities.length === 0) {
                qualities = await fetchQualitiesFromDownloadPage(videoId);
                console.log('Sources from download page:', qualities.length);
            }

            if (qualities.length === 0) {
                throw new Error('找不到任何下載選項');
            }

            // 渲染畫質列表
            content.innerHTML = `
                <div class="hanime-dl-list">
                    ${qualities.map((q, i) => `
                        <div class="hanime-dl-item" data-url="${q.url}" data-quality="${q.quality}">
                            <div>
                                <div class="hanime-dl-quality">${q.quality}</div>
                            </div>
                            <div class="hanime-dl-icon">⬇</div>
                        </div>
                    `).join('')}
                </div>
            `;

            // 綁定點擊事件
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

        item.classList.add('downloading');
        item.querySelector('.hanime-dl-icon').textContent = '⏳';

        try {
            let title = videoInfo?.title || 'video';
            // 移除網站後綴
            title = title
                .replace(/\s*[-–—]\s*H動漫.*$/i, '')
                .replace(/\s*[-–—]\s*Hanime1\.me.*$/i, '')
                .replace(/\s*[-–—]\s*裏番.*$/i, '')
                .replace(/\s*[-–—]\s*線上看.*$/i, '')
                .trim();
            const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
            const filename = `${cleanTitle}_${quality.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;

            // 請求 background 下載
            const response = await chrome.runtime.sendMessage({
                action: 'download',
                data: { url, filename, videoId: videoInfo?.videoId }
            });

            if (response.success) {
                item.querySelector('.hanime-dl-icon').textContent = '✓';
                item.querySelector('.hanime-dl-icon').style.background = 'linear-gradient(135deg, #10b981 0%, #34d399 100%)';
                setTimeout(closeModal, 1500);
            } else {
                throw new Error(response.error || '下載失敗');
            }

        } catch (error) {
            console.error('Download error:', error);
            item.classList.remove('downloading');
            item.querySelector('.hanime-dl-icon').textContent = '❌';
            item.querySelector('.hanime-dl-icon').style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';

            setTimeout(() => {
                item.querySelector('.hanime-dl-icon').textContent = '⬇';
                item.querySelector('.hanime-dl-icon').style.background = '';
            }, 3000);
        }
    }

    // 監聽來自 popup 的訊息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'getPageInfo') {
            const info = getVideoInfo();
            sendResponse({ success: true, data: info });
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

        // 尋找插入位置
        const existingDownloadBtn = document.getElementById('downloadBtn');
        const insertTarget = existingDownloadBtn?.parentElement ||
            document.querySelector('.video-actions') ||
            document.querySelector('.player-wrapper') ||
            document.querySelector('.video-info') ||
            document.querySelector('h1')?.parentElement;

        if (!insertTarget) return false;

        // 注入樣式和創建 Modal
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

    // 使用 MutationObserver 監聽 DOM 變化，加速按鈕插入
    function initButtonInjection() {
        // 立即嘗試插入
        if (addDownloadButton()) return;

        // 如果失敗，使用 MutationObserver 監聽 DOM 變化
        const observer = new MutationObserver((mutations, obs) => {
            if (addDownloadButton()) {
                obs.disconnect(); // 成功後停止監聽
            }
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });

        // 5秒後超時停止
        setTimeout(() => observer.disconnect(), 5000);
    }

    // 頁面載入後立即執行
    if (document.body) {
        initButtonInjection();
    } else {
        document.addEventListener('DOMContentLoaded', initButtonInjection);
    }

})();
