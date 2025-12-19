// Background Service Worker for Hanime Downloader
// 整合 DownloadManager 模組

// 導入下載管理器
importScripts('downloadManager.js');

// 監聽來自 content script 或 popup 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 下載請求
  if (message.action === 'download') {
    const { url, filename, videoId, videoInfo } = message.data;

    // 使用 downloadManager 處理下載
    downloadManager.startDownload(url, filename, videoId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // 獲取影片資訊
  if (message.action === 'getVideoInfo') {
    getVideoInfo(message.videoId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // 獲取下載進度
  if (message.action === 'getDownloadProgress') {
    const downloads = downloadManager.getAllDownloads();
    sendResponse({ success: true, downloads });
    return true;
  }

  // 取消下載
  if (message.action === 'cancelDownload') {
    downloadManager.cancelDownload(message.downloadId)
      .then(result => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // 獲取設定
  if (message.action === 'getSettings') {
    sendResponse({ success: true, settings: downloadManager.getSettings() });
    return true;
  }

  // 儲存設定
  if (message.action === 'saveSettings') {
    downloadManager.saveSettings(message.settings)
      .then(settings => sendResponse({ success: true, settings }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // 生成檔案名稱
  if (message.action === 'generateFilename') {
    const filename = downloadManager.generateFilename(message.videoInfo, message.quality);
    sendResponse({ success: true, filename });
    return true;
  }
});

// 獲取影片資訊（從下載頁面解析）
async function getVideoInfo(videoId) {
  try {
    const downloadPageUrl = `https://hanime1.me/download?v=${videoId}`;

    console.log('Fetching download page:', downloadPageUrl);

    const response = await fetch(downloadPageUrl, {
      headers: {
        'Referer': 'https://hanime1.me/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log('Got HTML, length:', html.length);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const qualities = [];

    // 正確的表格結構
    const tables = doc.querySelectorAll('table');
    console.log('Found tables:', tables.length);

    tables.forEach(table => {
      const rows = table.querySelectorAll('tbody tr, tr');
      rows.forEach((row, rowIndex) => {
        if (row.querySelector('th')) return;

        const cells = row.querySelectorAll('td');
        console.log(`Row ${rowIndex} has ${cells.length} cells`);

        if (cells.length >= 3) {
          const quality = cells[0]?.textContent?.trim();
          const fileType = cells[1]?.textContent?.trim();
          const fileSize = cells[2]?.textContent?.trim();

          const downloadCell = cells[3] || cells[cells.length - 1];
          const link = downloadCell?.querySelector('a[href]');

          let url = link?.href || link?.getAttribute('href') || '';

          if (url && url.startsWith('/')) {
            url = `https://hanime1.me${url}`;
          }

          if (quality && url && quality.match(/\d+p/i)) {
            const displayQuality = fileSize ? `${quality} (${fileSize})` : quality;
            qualities.push({
              quality: displayQuality,
              url: url,
              rawQuality: quality,
              size: fileSize
            });
            console.log('Found quality:', quality, url);
          }
        }
      });
    });

    // 備選方案
    if (qualities.length === 0) {
      const allLinks = doc.querySelectorAll('a[href*="download"], a.btn-primary, a.download-btn');
      console.log('Fallback: Found links:', allLinks.length);

      allLinks.forEach((link, index) => {
        let url = link.href || link.getAttribute('href');
        const text = link.textContent?.trim() || link.closest('tr')?.querySelector('td')?.textContent?.trim() || `選項 ${index + 1}`;

        if (url) {
          if (url.startsWith('/')) {
            url = `https://hanime1.me${url}`;
          }
          if (!qualities.find(q => q.url === url)) {
            qualities.push({
              quality: text,
              url: url
            });
          }
        }
      });
    }

    console.log('Total qualities found:', qualities.length);

    if (qualities.length === 0) {
      qualities.push({
        quality: '前往下載頁面',
        url: downloadPageUrl
      });
    }

    return { qualities };

  } catch (error) {
    console.error('Failed to get video info:', error);
    throw error;
  }
}

console.log('Hanime Downloader background service worker loaded with DownloadManager');
