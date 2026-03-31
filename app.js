(function() {
  'use strict';

  const EXTENSION_MAP = {
    'aac': 'audio/aac', 'mp3': 'audio/mpeg', 'mp4': 'audio/mp4',
    'wav': 'audio/wav', 'ogg': 'audio/ogg', 'flac': 'audio/flac',
    'webm': 'audio/webm', 'm4a': 'audio/x-m4a', 'wma': 'audio/x-ms-wma',
    'opus': 'audio/opus'
  };

  let audio = null;
  let currentFile = null;
  let currentFileURL = null;
  let isPlaying = false;
  let bookmarks = [];
  let isDragging = false;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    fileInput: $('#file-input'),
    fileName: $('#file-name'),
    fileStatus: $('#file-status'),
    dropZone: $('#drop-zone'),
    dropZoneContent: $('#drop-zone-content'),
    dropZoneToggle: $('#drop-zone-toggle'),
    langToggle: $('#lang-toggle'),
    progressSection: $('#progress-section'),
    progressBar: $('#progress-bar'),
    progressFill: $('#progress-fill'),
    progressThumb: $('#progress-thumb'),
    currentTime: $('#current-time'),
    totalTime: $('#total-time'),
    remainingTime: $('#remaining-time'),
    controls: $('#controls'),
    playBtn: $('#play-btn'),
    stopBtn: $('#stop-btn'),
    speedSection: $('#speed-section'),
    speedValue: $('#speed-value'),
    speedSlider: $('#speed-slider'),
    speedPresets: $('#speed-presets'),
    bookmarkSection: $('#bookmark-section'),
    bookmarkList: $('#bookmark-list'),
    addBookmarkBtn: $('#add-bookmark-btn'),
    exportBookmarksBtn: $('#export-bookmarks-btn'),
    importBookmarksInput: $('#import-bookmarks-input'),
    deleteBookmarksBtn: $('#delete-bookmarks-btn'),
    convertSection: $('#convert-section'),
    helpModal: $('#help-modal'),
    closeHelp: $('#close-help'),
    helpBtn: $('#help-btn'),
    toastContainer: $('#toast-container'),
    inputMin: $('#input-min'),
    inputSec: $('#input-sec'),
    inputMs: $('#input-ms'),
    timeGoBtn: $('#time-go-btn'),
    skipBackBtn: $('#skip-back-btn'),
    skipForwardBtn: $('#skip-forward-btn'),
    skipDuration: $('#skip-duration'),
    skipBackLabel: $('#skip-back-label'),
    skipForwardLabel: $('#skip-forward-label'),
    floatingMarkBtn: $('#floating-mark-btn'),
    historyList: $('#history-list'),
    clearHistoryBtn: $('#clear-history-btn')
  };

  function init() {
    audio = $('#audio');
    setLang(getCurrentLang());
    setupEventListeners();
    loadBookmarks();
    renderHistory();
    checkSharedFile();
  }

  function setupEventListeners() {
    els.fileInput.addEventListener('change', handleFileSelect);
    els.importBookmarksInput.addEventListener('change', importBookmarks);

    const dropZoneContent = els.dropZoneContent || els.dropZone;
    els.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      els.dropZone.classList.add('drag-over');
    });

    els.dropZone.addEventListener('dragleave', () => {
      els.dropZone.classList.remove('drag-over');
    });

    els.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      els.dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) loadFile(files[0]);
    });

    if (els.dropZoneToggle) {
      els.dropZoneToggle.addEventListener('change', () => {
        const show = els.dropZoneToggle.checked;
        if (els.dropZoneContent) {
          els.dropZoneContent.classList.toggle('hidden', !show);
        }
        localStorage.setItem('speedup-dropzone', show ? '1' : '0');
      });
      const saved = localStorage.getItem('speedup-dropzone');
      if (saved === '0') {
        els.dropZoneToggle.checked = false;
        if (els.dropZoneContent) els.dropZoneContent.classList.add('hidden');
      }
    }

    els.langToggle.addEventListener('click', () => {
      toggleLang();
    });

    els.playBtn.addEventListener('click', togglePlay);
    els.stopBtn.addEventListener('click', stopPlayback);

    els.speedSlider.addEventListener('input', (e) => {
      setSpeed(parseFloat(e.target.value));
    });

    els.speedPresets.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-speed');
      if (!btn) return;
      setSpeed(parseFloat(btn.dataset.speed));
    });

    els.progressBar.addEventListener('mousedown', startDrag);
    els.progressBar.addEventListener('touchstart', startDrag, { passive: false });

    els.addBookmarkBtn.addEventListener('click', addBookmark);
    els.exportBookmarksBtn.addEventListener('click', exportBookmarks);
    els.deleteBookmarksBtn.addEventListener('click', deleteAllBookmarks);

    els.closeHelp.addEventListener('click', () => {
      els.helpModal.hidden = true;
    });

    els.helpBtn.addEventListener('click', () => {
      els.helpModal.hidden = false;
    });

    els.helpModal.addEventListener('click', (e) => {
      if (e.target === els.helpModal) els.helpModal.hidden = true;
    });

    els.timeGoBtn.addEventListener('click', seekToTimeInput);
    els.inputMin.addEventListener('keydown', (e) => { if (e.key === 'Enter') seekToTimeInput(); });
    els.inputSec.addEventListener('keydown', (e) => { if (e.key === 'Enter') seekToTimeInput(); });
    els.inputMs.addEventListener('keydown', (e) => { if (e.key === 'Enter') seekToTimeInput(); });

    els.skipBackBtn.addEventListener('click', () => { skipTime(-getSkipDuration()); });
    els.skipForwardBtn.addEventListener('click', () => { skipTime(getSkipDuration()); });
    els.skipDuration.addEventListener('change', updateSkipLabels);

    els.floatingMarkBtn.addEventListener('click', addBookmark);

    els.clearHistoryBtn.addEventListener('click', clearAllHistory);

    audio.addEventListener('loadedmetadata', onMetadataLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onPlaybackEnded);
    audio.addEventListener('error', onAudioError);
    audio.addEventListener('play', () => { isPlaying = true; updatePlayButton(); updateRemainingTime(); });
    audio.addEventListener('pause', () => { isPlaying = false; updatePlayButton(); if (els.remainingTime) els.remainingTime.textContent = ''; });

    document.addEventListener('keydown', handleKeyboard);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      loadFile(file);
      e.target.value = '';
    }
  }

  async function loadFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!EXTENSION_MAP[ext]) {
      showToast(t('unsupportedFormat'), 'error');
      return;
    }

    if (currentFileURL) {
      URL.revokeObjectURL(currentFileURL);
    }

    const arrayBuffer = await file.arrayBuffer();

    currentFile = file;
    currentFileURL = URL.createObjectURL(file);
    audio.src = currentFileURL;
    audio.load();

    els.fileName.textContent = file.name;
    els.fileStatus.textContent = t('fileLoaded') + ' — ' + file.name;
    els.progressSection.hidden = false;
    els.controls.hidden = false;
    els.speedSection.hidden = false;
    els.bookmarkSection.hidden = false;
    els.convertSection.hidden = false;
    els.floatingMarkBtn.hidden = false;

    loadBookmarksForFile(file.name);
    addHistoryEntry(file.name, audio.duration || 0);
    cacheAudioFileFromArrayBuffer(file, arrayBuffer);
  }

  function onMetadataLoaded() {
    els.fileStatus.textContent = t('fileLoaded');
    els.totalTime.textContent = formatTime(audio.duration);
    setSpeed(1);
  }

  function onTimeUpdate() {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    els.progressFill.style.width = pct + '%';
    els.progressThumb.style.left = pct + '%';
    els.currentTime.textContent = formatTime(audio.currentTime);
    updateTimeInputs(audio.currentTime);
    updateRemainingTime();
  }

  function updateRemainingTime() {
    if (!audio.duration || !isPlaying) {
      if (els.remainingTime) els.remainingTime.textContent = '';
      return;
    }
    const remaining = (audio.duration - audio.currentTime) / audio.playbackRate;
    if (remaining < 1) {
      els.remainingTime.textContent = '';
      return;
    }
    els.remainingTime.textContent = '-' + formatTime(remaining) + ' @' + audio.playbackRate.toFixed(1) + 'x';
  }

  function onPlaybackEnded() {
    isPlaying = false;
    updatePlayButton();
  }

  function onAudioError() {
    els.fileStatus.textContent = t('errorLoading');
    showToast(t('errorLoading'), 'error');
  }

  function togglePlay() {
    if (!audio.src) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {
        showToast(t('errorLoading'), 'error');
      });
    }
  }

  function stopPlayback() {
    audio.pause();
    audio.currentTime = 0;
    isPlaying = false;
    updatePlayButton();
  }

  function updatePlayButton() {
    els.playBtn.innerHTML = isPlaying ? '&#x23F8;' : '&#x25B6;';
    els.playBtn.setAttribute('data-i18n-title', isPlaying ? 'pause' : 'play');
  }

  function setSpeed(rate) {
    rate = Math.max(0.25, Math.min(4, rate));
    audio.playbackRate = rate;
    els.speedValue.textContent = rate.toFixed(2) + 'x';
    els.speedSlider.value = rate;

    $$('.btn-speed').forEach((btn) => {
      btn.classList.toggle('active', parseFloat(btn.dataset.speed) === rate);
    });
  }

  function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    updateDragPosition(e);

    const moveHandler = (ev) => { updateDragPosition(ev); };
    const endHandler = () => {
      isDragging = false;
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', endHandler);
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('touchend', endHandler);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', endHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('touchend', endHandler);
  }

  function updateDragPosition(e) {
    if (!audio.duration) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = els.progressBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  }

  function seekToTimeInput() {
    if (!audio.duration) return;
    const min = parseInt(els.inputMin.value) || 0;
    const sec = parseInt(els.inputSec.value) || 0;
    const ms = parseInt(els.inputMs.value) || 0;
    const totalSec = min * 60 + sec + ms * 0.1;
    if (totalSec >= 0 && totalSec <= audio.duration) {
      audio.currentTime = totalSec;
    }
  }

  function updateTimeInputs(currentTime) {
    if (isDragging) return;
    const min = Math.floor(currentTime / 60);
    const sec = Math.floor(currentTime % 60);
    const ms = Math.floor((currentTime % 1) * 10);
    els.inputMin.value = min;
    els.inputSec.value = sec < 10 ? '0' + sec : sec;
    els.inputMs.value = ms;
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function addBookmark() {
    if (!audio.duration) return;
    const time = audio.currentTime;
    const label = prompt(t('enterLabel'), formatTime(time));
    if (label === null) return;

    const bookmark = {
      time: time,
      label: label || formatTime(time),
      createdAt: Date.now()
    };

    bookmarks.push(bookmark);
    bookmarks.sort((a, b) => a.time - b.time);
    saveBookmarks();
    renderBookmarks();
    showToast(t('success'), 'success');
  }

  function renderBookmarks() {
    if (!els.bookmarkList) return;
    if (bookmarks.length === 0) {
      els.bookmarkList.innerHTML = '<div class="bookmark-empty" data-i18n="noBookmarks">' + t('noBookmarks') + '</div>';
      return;
    }

    els.bookmarkList.innerHTML = bookmarks.map((bm, i) => {
      const numKey = i < 9 ? (i + 1) : '';
      return '<div class="bookmark-item" data-index="' + i + '">' +
        '<span class="bookmark-time" data-time="' + bm.time + '">' + formatTime(bm.time) + '</span>' +
        '<input type="text" class="bookmark-label" value="' + escapeHtml(bm.label) + '" placeholder="' + t('enterLabel') + '" data-index="' + i + '">' +
        '<button class="btn-bookmark-play" data-time="' + bm.time + '" title="' + t('jumpTo') + '">' + (numKey || '&#x25B6;') + '</button>' +
        '<button class="btn-bookmark-delete" data-index="' + i + '" title="' + t('delete') + '">&#x2715;</button>' +
        '</div>';
    }).join('');

    els.bookmarkList.querySelectorAll('.bookmark-time').forEach((el) => {
      el.addEventListener('click', () => {
        audio.currentTime = parseFloat(el.dataset.time);
      });
    });

    els.bookmarkList.querySelectorAll('.btn-bookmark-play').forEach((el) => {
      el.addEventListener('click', () => {
        audio.currentTime = parseFloat(el.dataset.time);
        if (!isPlaying) audio.play();
      });
    });

    els.bookmarkList.querySelectorAll('.btn-bookmark-delete').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        bookmarks.splice(idx, 1);
        saveBookmarks();
        renderBookmarks();
      });
    });

    els.bookmarkList.querySelectorAll('.bookmark-label').forEach((el) => {
      el.addEventListener('change', () => {
        const idx = parseInt(el.dataset.index);
        if (bookmarks[idx]) {
          bookmarks[idx].label = el.value;
          saveBookmarks();
        }
      });
    });
  }

  function saveBookmarks() {
    if (!currentFile) return;
    const all = JSON.parse(localStorage.getItem('speedup-bookmarks') || '{}');
    all[currentFile.name] = bookmarks;
    localStorage.setItem('speedup-bookmarks', JSON.stringify(all));
  }

  function loadBookmarksForFile(fileName) {
    const all = JSON.parse(localStorage.getItem('speedup-bookmarks') || '{}');
    bookmarks = all[fileName] || [];
    renderBookmarks();
  }

  function loadBookmarks() {
    if (!localStorage.getItem('speedup-bookmarks')) {
      localStorage.setItem('speedup-bookmarks', '{}');
    }
  }

  function exportBookmarks() {
    if (!currentFile || bookmarks.length === 0) {
      showToast(t('noBookmarks'), 'info');
      return;
    }
    const data = {
      file: currentFile.name,
      exportedAt: new Date().toISOString(),
      bookmarks: bookmarks
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.name.replace(/\.[^.]+$/, '') + '-bookmarks.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('exportSuccess') || '匯出成功', 'success');
  }

  function importBookmarks(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        let imported = [];
        if (Array.isArray(data)) {
          imported = data;
        } else if (data.bookmarks && Array.isArray(data.bookmarks)) {
          imported = data.bookmarks;
        } else {
          showToast(t('importError') || '無效的標記檔案', 'error');
          return;
        }
        imported.forEach((bm) => {
          if (typeof bm.time === 'number' && !bookmarks.find((b) => b.time === bm.time)) {
            bookmarks.push({
              time: bm.time,
              label: bm.label || formatTime(bm.time),
              createdAt: bm.createdAt || Date.now()
            });
          }
        });
        bookmarks.sort((a, b) => a.time - b.time);
        saveBookmarks();
        renderBookmarks();
        showToast((t('importSuccess') || '匯入成功') + ' (' + imported.length + ')', 'success');
      } catch (err) {
        showToast(t('importError') || '匯入失敗', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function deleteAllBookmarks() {
    if (bookmarks.length === 0) {
      showToast(t('noBookmarks'), 'info');
      return;
    }
    if (confirm((t('confirmDeleteAll') || '確定要刪除所有標記點嗎？'))) {
      bookmarks = [];
      saveBookmarks();
      renderBookmarks();
      showToast(t('deleted') || '已刪除', 'success');
    }
  }

  function addHistoryEntry(fileName, duration) {
    const history = JSON.parse(localStorage.getItem('speedup-history') || '[]');
    const existing = history.findIndex((h) => h.name === fileName);
    if (existing !== -1) {
      history.splice(existing, 1);
    }
    history.unshift({
      name: fileName,
      duration: duration,
      lastOpened: Date.now()
    });
    if (history.length > 20) {
      history.pop();
    }
    localStorage.setItem('speedup-history', JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    if (!els.historyList) return;
    const history = JSON.parse(localStorage.getItem('speedup-history') || '[]');
    if (history.length === 0) {
      els.historyList.innerHTML = '<div class="history-empty" data-i18n="noHistory">' + t('noHistory') + '</div>';
      return;
    }
    els.historyList.innerHTML = history.map((h, i) => {
      const ago = timeAgo(h.lastOpened);
      const dur = h.duration ? formatTime(h.duration) : '';
      return '<div class="history-item" data-index="' + i + '">' +
        '<span class="history-icon">&#x1F3B5;</span>' +
        '<div class="history-info">' +
          '<div class="history-name">' + escapeHtml(h.name) + '</div>' +
          '<div class="history-detail">' + dur + ' &middot; ' + ago + '</div>' +
        '</div>' +
        '<button class="history-pin" data-name="' + escapeHtml(h.name) + '" title="' + (t('pin') || '釘選') + '">&#x1F4CC;</button>' +
        '<button class="history-delete" data-index="' + i + '" title="' + t('delete') + '">&#x2715;</button>' +
        '</div>';
    }).join('');

    els.historyList.querySelectorAll('.history-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.history-delete') || e.target.closest('.history-pin')) return;
        const idx = parseInt(el.dataset.index);
        const item = history[idx];
        if (!item) return;
        loadFromCache(item.name);
      });
    });

    els.historyList.querySelectorAll('.history-pin').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePin(el.dataset.name);
      });
    });

    els.historyList.querySelectorAll('.history-delete').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.index);
        const h = JSON.parse(localStorage.getItem('speedup-history') || '[]');
        h.splice(idx, 1);
        localStorage.setItem('speedup-history', JSON.stringify(h));
        renderHistory();
      });
    });
  }

  function clearAllHistory() {
    if (confirm(t('confirmClearHistory') || '確定要清除所有歷史記錄嗎？')) {
      localStorage.setItem('speedup-history', '[]');
      renderHistory();
      showToast(t('deleted') || '已清除', 'success');
    }
  }

  function timeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('justNow') || '剛剛';
    if (mins < 60) return mins + ' ' + (t('minsAgo') || '分鐘前');
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' ' + (t('hoursAgo') || '小時前');
    const days = Math.floor(hours / 24);
    if (days < 7) return days + ' ' + (t('daysAgo') || '天前');
    return new Date(timestamp).toLocaleDateString();
  }

  function getSkipDuration() {
    return parseInt(els.skipDuration.value) || 5;
  }

  function updateSkipLabels() {
    const dur = getSkipDuration();
    els.skipBackLabel.textContent = '-' + dur + 's';
    els.skipForwardLabel.textContent = '+' + dur + 's';
  }

  function skipTime(seconds) {
    if (!audio.duration) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
  }

  function handleKeyboard(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight':
        e.preventDefault();
        skipTime(getSkipDuration());
        break;
      case 'ArrowLeft':
        e.preventDefault();
        skipTime(-getSkipDuration());
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSpeed(Math.min(4, audio.playbackRate + 0.1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSpeed(Math.max(0.25, audio.playbackRate - 0.1));
        break;
      case 'KeyM':
        e.preventDefault();
        addBookmark();
        break;
      case 'Digit1': case 'Digit2': case 'Digit3':
      case 'Digit4': case 'Digit5': case 'Digit6':
      case 'Digit7': case 'Digit8': case 'Digit9':
        const num = parseInt(e.code.replace('Digit', '')) - 1;
        if (num < bookmarks.length) {
          e.preventDefault();
          audio.currentTime = bookmarks[num].time;
          if (!isPlaying) audio.play();
        }
        break;
    }
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.getCurrentFile = () => currentFile;
  window.showToast = showToast;
  window.t = t;
  window.renderBookmarks = renderBookmarks;

  async function openShareDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('speedup-share', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('shared-files', { keyPath: 'timestamp' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function openAudioDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('speedup-audio', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('audio-files')) {
          db.createObjectStore('audio-files', { keyPath: 'name' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function cacheAudioFileFromArrayBuffer(file, arrayBuffer) {
    try {
      const db = await openAudioDB();
      const tx = db.transaction('audio-files', 'readwrite');
      const store = tx.objectStore('audio-files');
      const existing = await new Promise((res, rej) => {
        const r = store.get(file.name);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      store.put({
        name: file.name,
        type: file.type,
        data: Array.from(new Uint8Array(arrayBuffer)),
        pinned: existing ? existing.pinned : false,
        cachedAt: Date.now()
      });
      await tx.complete;
      const all = await new Promise((res, rej) => {
        const r = store.getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const unpinned = all.filter((f) => !f.pinned).sort((a, b) => a.cachedAt - b.cachedAt);
      if (unpinned.length > 5) {
        const toRemove = unpinned.slice(0, unpinned.length - 5);
        const tx2 = db.transaction('audio-files', 'readwrite');
        toRemove.forEach((item) => tx2.objectStore('audio-files').delete(item.name));
        await tx2.complete;
      }
    } catch (e) {
      console.warn('Failed to cache audio file:', e);
    }
  }

  async function loadFromCache(fileName) {
    try {
      const db = await openAudioDB();
      const tx = db.transaction('audio-files', 'readonly');
      const store = tx.objectStore('audio-files');
      const request = store.get(fileName);

      request.onsuccess = () => {
        const cached = request.result;
        if (cached) {
          const uint8 = new Uint8Array(cached.data);
          const blob = new Blob([uint8], { type: cached.type });
          const file = new File([blob], cached.name, { type: cached.type });
          loadFile(file);
          showToast(cached.name, 'success');
          return;
        }
        showToast(t('fileNotCached') || '檔案未快取，請先開啟一次此音檔', 'info');
      };

      request.onerror = () => {
        showToast(t('fileNotCached') || '檔案未快取，請先開啟一次此音檔', 'info');
      };
    } catch (e) {
      showToast(t('fileNotCached') || '檔案未快取，請先開啟一次此音檔', 'info');
    }
  }

  async function togglePin(fileName) {
    try {
      const db = await openAudioDB();
      const tx = db.transaction('audio-files', 'readwrite');
      const store = tx.objectStore('audio-files');
      const request = store.get(fileName);

      request.onsuccess = () => {
        const cached = request.result;
        if (cached) {
          cached.pinned = !cached.pinned;
          store.put(cached);
          tx.oncomplete = () => {
            renderHistory();
            showToast(cached.pinned ? (t('pinned') || '已釘選') : (t('unpinned') || '已取消釘選'), 'success');
          };
        }
      };
    } catch (e) {
      console.warn('Failed to toggle pin:', e);
    }
  }

  async function checkSharedFile() {
    try {
      const db = await openShareDB();
      const tx = db.transaction('shared-files', 'readonly');
      const store = tx.objectStore('shared-files');
      const request = store.getAll();

      request.onsuccess = async () => {
        const files = request.result;
        if (files && files.length > 0) {
          const latest = files[files.length - 1];
          const uint8 = new Uint8Array(latest.data);
          const blob = new Blob([uint8], { type: latest.type });
          const file = new File([blob], latest.name, { type: latest.type });

          loadFile(file);
          showToast(latest.name, 'success');

          const clearTx = db.transaction('shared-files', 'readwrite');
          clearTx.objectStore('shared-files').clear();
        }
      };

      request.onerror = () => {
        console.warn('Failed to read shared file from IndexedDB');
      };
    } catch (e) {
      console.warn('Shared file check failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
