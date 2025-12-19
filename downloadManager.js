// Download Manager Module for Hanime Downloader
// 統一管理所有下載狀態和進度

class DownloadManager {
  constructor() {
    // 活動中的下載 { downloadId: { filename, url, startTime, bytesReceived, totalBytes, state } }
    this.activeDownloads = new Map();
    // 進度監聽器
    this.progressListeners = new Set();
    // 設定
    this.settings = {
      defaultQuality: 'auto',
      filenameTemplate: '{title}_{quality}',
      showNotifications: true
    };

    this.init();
  }

  async init() {
    // 載入設定
    await this.loadSettings();

    // 監聽下載狀態變化
    chrome.downloads.onChanged.addListener((delta) => this.handleDownloadChange(delta));

    // 定期更新進度 (每 500ms)
    setInterval(() => this.updateAllProgress(), 500);
  }

  // 載入設定
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['settings']);
      if (result.settings) {
        this.settings = { ...this.settings, ...result.settings };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  // 儲存設定
  async saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    await chrome.storage.sync.set({ settings: this.settings });
    return this.settings;
  }

  // 獲取設定
  getSettings() {
    return this.settings;
  }

  // 開始下載
  async startDownload(url, filename, videoId) {
    try {
      console.log('DownloadManager: Starting download', { url, filename });

      // 確保 URL 是絕對路徑
      let downloadUrl = url;
      if (url.startsWith('/')) {
        downloadUrl = `https://hanime1.me${url}`;
      }

      // 如果不是直接 MP4 連結，先獲取真正的下載 URL
      let finalUrl = downloadUrl;
      if (!downloadUrl.includes('.mp4') || downloadUrl.includes('hanime1.me/download')) {
        console.log('Intermediate URL detected, fetching real video URL...');
        finalUrl = await this.getRealVideoUrl(downloadUrl);
        console.log('Real video URL:', finalUrl);
      }

      // 開始下載
      const downloadId = await chrome.downloads.download({
        url: finalUrl,
        filename: filename,
        saveAs: true,
        conflictAction: 'uniquify'
      });

      // 記錄下載資訊
      this.activeDownloads.set(downloadId, {
        downloadId,
        filename,
        url: finalUrl,
        videoId,
        startTime: Date.now(),
        bytesReceived: 0,
        totalBytes: 0,
        state: 'in_progress',
        speed: 0,
        progress: 0
      });

      console.log(`Download started with ID: ${downloadId}`);
      this.broadcastProgress();

      return { success: true, downloadId, filename };

    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  // 從跳轉頁面獲取真正的影片 URL
  async getRealVideoUrl(intermediateUrl) {
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

      // 方法 1: 尋找 window.location.href 重定向
      let match = html.match(/window\.location\.href\s*=\s*["']([^"']+)/i);
      if (match && match[1]) return match[1];

      // 方法 2: 尋找 meta refresh
      match = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>]+)/i);
      if (match && match[1]) return match[1];

      // 方法 3: 尋找 id="download-link"
      match = html.match(/id=["']download-link["'][^>]*href=["']([^"']+)/i) ||
        html.match(/href=["']([^"']+)["'][^>]*id=["']download-link["']/i);
      if (match && match[1]) {
        let url = match[1];
        if (url.startsWith('/')) url = 'https://hanime1.me' + url;
        return url;
      }

      // 方法 4: 尋找任何 .mp4 連結
      match = html.match(/href=["']([^"']*\.mp4[^"']*)/i);
      if (match && match[1]) {
        let url = match[1];
        if (url.startsWith('/')) url = 'https://hanime1.me' + url;
        return url;
      }

      // 方法 5: 尋找 source 標籤
      match = html.match(/<source[^>]*src=["']([^"']+)/i);
      if (match && match[1]) return match[1];

      // 方法 6: 尋找 video_url 變數
      match = html.match(/(?:video_url|videoUrl|source|src)\s*[=:]\s*["']([^"']+\.mp4[^"']*)/i);
      if (match && match[1]) return match[1];

      return intermediateUrl;

    } catch (error) {
      console.error('Failed to get real video URL:', error);
      return intermediateUrl;
    }
  }

  // 處理下載狀態變化
  handleDownloadChange(delta) {
    const downloadId = delta.id;
    const download = this.activeDownloads.get(downloadId);

    if (!download) return;

    // 更新狀態
    if (delta.state) {
      download.state = delta.state.current;

      if (delta.state.current === 'complete') {
        download.progress = 100;
        this.broadcastProgress();

        // 顯示通知
        if (this.settings.showNotifications) {
          chrome.notifications?.create({
            type: 'basic',
            iconUrl: 'icons/icon-128.png',
            title: 'Hanime Downloader',
            message: `${download.filename} 下載完成！`
          });
        }

        // 5秒後移除記錄
        setTimeout(() => {
          this.activeDownloads.delete(downloadId);
          this.broadcastProgress();
        }, 5000);

      } else if (delta.state.current === 'interrupted') {
        download.state = 'failed';
        download.error = delta.error?.current || 'Unknown error';
        this.broadcastProgress();

        // 10秒後移除記錄
        setTimeout(() => {
          this.activeDownloads.delete(downloadId);
          this.broadcastProgress();
        }, 10000);
      }
    }

    // 更新總大小
    if (delta.totalBytes) {
      download.totalBytes = delta.totalBytes.current;
    }
  }

  // 更新所有活動下載的進度
  async updateAllProgress() {
    if (this.activeDownloads.size === 0) return;

    for (const [downloadId, download] of this.activeDownloads) {
      if (download.state !== 'in_progress') continue;

      try {
        const [item] = await chrome.downloads.search({ id: downloadId });
        if (item) {
          const now = Date.now();
          const elapsed = (now - download.startTime) / 1000; // 秒

          // 更新位元組
          const prevBytes = download.bytesReceived;
          download.bytesReceived = item.bytesReceived || 0;
          download.totalBytes = item.totalBytes || 0;

          // 計算速度 (bytes/sec)
          if (elapsed > 0) {
            download.speed = download.bytesReceived / elapsed;
          }

          // 計算進度
          if (download.totalBytes > 0) {
            download.progress = Math.round((download.bytesReceived / download.totalBytes) * 100);
          }

          // 預估剩餘時間
          if (download.speed > 0 && download.totalBytes > 0) {
            const remaining = download.totalBytes - download.bytesReceived;
            download.eta = Math.round(remaining / download.speed);
          }
        }
      } catch (error) {
        console.error('Failed to get download progress:', error);
      }
    }

    this.broadcastProgress();
  }

  // 取消下載
  async cancelDownload(downloadId) {
    try {
      await chrome.downloads.cancel(downloadId);
      const download = this.activeDownloads.get(downloadId);
      if (download) {
        download.state = 'cancelled';
        this.broadcastProgress();
      }
      this.activeDownloads.delete(downloadId);
      return { success: true };
    } catch (error) {
      console.error('Failed to cancel download:', error);
      throw error;
    }
  }

  // 獲取所有下載狀態
  getAllDownloads() {
    return Array.from(this.activeDownloads.values());
  }

  // 廣播進度給所有監聽者
  broadcastProgress() {
    const downloads = this.getAllDownloads();

    // 發送給所有 tabs
    chrome.tabs.query({ url: 'https://hanime1.me/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'downloadProgress',
          downloads
        }).catch(() => { });
      });
    });
  }

  // 格式化檔案大小
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 格式化時間
  static formatTime(seconds) {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // 根據設定生成檔案名稱
  generateFilename(videoInfo, quality) {
    let template = this.settings.filenameTemplate || '{title}_{quality}';

    // 清理標題
    let title = videoInfo?.title || 'video';
    title = title
      .replace(/\s*[-–—]\s*H動漫.*$/i, '')
      .replace(/\s*[-–—]\s*Hanime1\.me.*$/i, '')
      .replace(/\s*[-–—]\s*裏番.*$/i, '')
      .replace(/\s*[-–—]\s*線上看.*$/i, '')
      .trim();

    const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    const cleanQuality = quality.replace(/[^a-zA-Z0-9]/g, '_');

    let filename = template
      .replace('{title}', cleanTitle)
      .replace('{id}', videoInfo?.videoId || 'unknown')
      .replace('{quality}', cleanQuality);

    return filename + '.mp4';
  }
}

// 創建單例
const downloadManager = new DownloadManager();
