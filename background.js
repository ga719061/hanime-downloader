// Background Service Worker for Hanime Downloader

// 監聽來自 content script 或 popup 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download') {
    handleDownload(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持訊息通道開放以支持異步響應
  }

  if (message.action === 'getVideoInfo') {
    getVideoInfo(message.videoId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// 處理下載請求 - 兩階段下載
async function handleDownload(data) {
  const { url, filename, videoId } = data;

  try {
    console.log('Starting download process for:', url);

    // 確保 URL 是絕對路徑
    let downloadUrl = url;
    if (url.startsWith('/')) {
      downloadUrl = `https://hanime1.me${url}`;
    }

    // 第一階段：如果不是直接 MP4 連結，先獲取真正的下載 URL
    let finalUrl = downloadUrl;
    if (!downloadUrl.includes('.mp4') || downloadUrl.includes('hanime1.me/download')) {
      console.log('Intermediate URL detected, fetching real video URL...');
      finalUrl = await getRealVideoUrl(downloadUrl);
      console.log('Real video URL:', finalUrl);
    }

    // 第二階段：使用最終 URL 下載
    const downloadId = await chrome.downloads.download({
      url: finalUrl,
      filename: filename,
      saveAs: true,
      conflictAction: 'uniquify'
    });

    console.log(`Download started with ID: ${downloadId}`);
    return { downloadId, filename };

  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}

// 從跳轉頁面獲取真正的影片 URL
async function getRealVideoUrl(intermediateUrl) {
  try {
    const response = await fetch(intermediateUrl, {
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
    console.log('Intermediate page length:', html.length);

    // 方法 1: 尋找 window.location.href 重定向
    let match = html.match(/window\.location\.href\s*=\s*["']([^"']+)/i);
    if (match && match[1]) {
      console.log('Found via window.location.href');
      return match[1];
    }

    // 方法 2: 尋找 meta refresh
    match = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>]+)/i);
    if (match && match[1]) {
      console.log('Found via meta refresh');
      return match[1];
    }

    // 方法 3: 尋找 id="download-link" 或類似的元素
    match = html.match(/id=["']download-link["'][^>]*href=["']([^"']+)/i) ||
      html.match(/href=["']([^"']+)["'][^>]*id=["']download-link["']/i);
    if (match && match[1]) {
      console.log('Found via download-link id');
      let url = match[1];
      if (url.startsWith('/')) {
        url = 'https://hanime1.me' + url;
      }
      return url;
    }

    // 方法 4: 尋找任何 .mp4 連結
    match = html.match(/href=["']([^"']*\.mp4[^"']*)/i);
    if (match && match[1]) {
      console.log('Found via .mp4 href');
      let url = match[1];
      if (url.startsWith('/')) {
        url = 'https://hanime1.me' + url;
      }
      return url;
    }

    // 方法 5: 尋找 source 標籤
    match = html.match(/<source[^>]*src=["']([^"']+)/i);
    if (match && match[1]) {
      console.log('Found via source tag');
      return match[1];
    }

    // 方法 6: 尋找 video_url 或 videoUrl 變數
    match = html.match(/(?:video_url|videoUrl|source|src)\s*[=:]\s*["']([^"']+\.mp4[^"']*)/i);
    if (match && match[1]) {
      console.log('Found via JS variable');
      return match[1];
    }

    // 方法 7: 尋找 data-url 屬性
    match = html.match(/data-(?:url|src|video)=["']([^"']+)/i);
    if (match && match[1]) {
      console.log('Found via data attribute');
      let url = match[1];
      if (url.startsWith('/')) {
        url = 'https://hanime1.me' + url;
      }
      return url;
    }

    // 如果都找不到，返回原始 URL
    console.warn('Could not find real video URL, using original');
    return intermediateUrl;

  } catch (error) {
    console.error('Failed to get real video URL:', error);
    return intermediateUrl;
  }
}

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

    // 正確的表格結構：
    // 第0列: 解析度 (1080p, 720p 等)
    // 第1列: 檔案類型 (mp4)
    // 第2列: 檔案大小 (1.2 GB)
    // 第3列: 下載按鈕/連結
    const tables = doc.querySelectorAll('table');
    console.log('Found tables:', tables.length);

    tables.forEach(table => {
      const rows = table.querySelectorAll('tbody tr, tr');
      rows.forEach((row, rowIndex) => {
        // 跳過表頭
        if (row.querySelector('th')) return;

        const cells = row.querySelectorAll('td');
        console.log(`Row ${rowIndex} has ${cells.length} cells`);

        if (cells.length >= 3) {
          const quality = cells[0]?.textContent?.trim();
          const fileType = cells[1]?.textContent?.trim();
          const fileSize = cells[2]?.textContent?.trim();

          // 找下載連結 - 可能在第3列或最後一列
          const downloadCell = cells[3] || cells[cells.length - 1];
          const link = downloadCell?.querySelector('a[href]');

          let url = link?.href || link?.getAttribute('href') || '';

          // 確保 URL 是完整路徑
          if (url && url.startsWith('/')) {
            url = `https://hanime1.me${url}`;
          }

          // 過濾有效的下載項目
          if (quality && url && quality.match(/\d+p/i)) {
            const displayQuality = fileSize ? `${quality} (${fileSize})` : quality;
            qualities.push({
              quality: displayQuality,
              url: url
            });
            console.log('Found quality:', quality, url);
          }
        }
      });
    });

    // 備選：直接找所有下載連結
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
          // 避免重複
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

// 監聽下載狀態變化
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state) {
    console.log(`Download ${delta.id} state changed to: ${delta.state.current}`);

    if (delta.state.current === 'complete') {
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Hanime Downloader',
        message: '影片下載完成！'
      });
    }
  }
});

console.log('Hanime Downloader background service worker loaded');
