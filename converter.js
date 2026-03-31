(function() {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  let libsLoaded = false;
  let lameLoaded = false;

  const els = {
    convertBtn: $('#convert-btn'),
    convertFormat: $('#convert-format'),
    convertStatus: $('#convert-status'),
    convertProgress: $('#convert-progress'),
    convertFill: $('#convert-fill'),
    convertPercent: $('#convert-percent'),
    convertDownload: $('#convert-download'),
    downloadLink: $('#download-link')
  };

  if (els.convertBtn) {
    els.convertBtn.addEventListener('click', startConversion);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function loadLibs() {
    if (libsLoaded) return;
    if (libsLoaded) return;
    await loadScript('./lib/lame.min.js');
    libsLoaded = true;
    lameLoaded = true;
  }

  function encodeWAV(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = audioBuffer.length * blockAlign;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;
    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);

    function writeString(offset, str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    const channels = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(audioBuffer.getChannelData(ch));
    }

    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  async function encodeMP3(audioBuffer) {
    if (!lameLoaded) {
      await loadLibs();
    }

    const mp3encoder = new lamejs.Mp3Encoder(
      audioBuffer.numberOfChannels,
      audioBuffer.sampleRate,
      192
    );

    const channels = [];
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const floatData = audioBuffer.getChannelData(ch);
      const intData = new Int16Array(floatData.length);
      for (let i = 0; i < floatData.length; i++) {
        const s = Math.max(-1, Math.min(1, floatData[i]));
        intData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      channels.push(intData);
    }

    const mp3Data = [];
    const sampleBlockSize = 1152;
    const totalSamples = channels[0].length;
    let processed = 0;

    for (let i = 0; i < totalSamples; i += sampleBlockSize) {
      const left = channels[0].subarray(i, i + sampleBlockSize);
      const right = audioBuffer.numberOfChannels > 1
        ? channels[1].subarray(i, i + sampleBlockSize)
        : left;

      const mp3buf = audioBuffer.numberOfChannels > 1
        ? mp3encoder.encodeBuffer(left, right)
        : mp3encoder.encodeBuffer(left, left);

      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }

      processed += sampleBlockSize;
      const pct = Math.min(100, Math.round((processed / totalSamples) * 100));
      if (els.convertFill) els.convertFill.style.width = pct + '%';
      if (els.convertPercent) els.convertPercent.textContent = pct + '%';
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    return new Blob(mp3Data, { type: 'audio/mpeg' });
  }

  async function decodeAudioFile(file) {
    return new Promise((resolve, reject) => {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const reader = new FileReader();
      reader.onload = (e) => {
        ctx.decodeAudioData(e.target.result, (buffer) => {
          resolve({ buffer, ctx });
        }, (err) => {
          ctx.close();
          reject(err);
        });
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function startConversion() {
    const file = window.getCurrentFile();
    if (!file) {
      window.showToast(window.t('noFileSelected'), 'error');
      return;
    }

    const outputFormat = els.convertFormat.value;
    const inputExt = file.name.split('.').pop().toLowerCase();
    if (inputExt === outputFormat) {
      window.showToast(window.t('convertError') + ': same format', 'error');
      return;
    }

    els.convertBtn.disabled = true;
    els.convertBtn.textContent = window.t('converting');
    els.convertProgress.hidden = false;
    els.convertDownload.hidden = true;
    els.convertStatus.textContent = window.t('conversionStarted');
    els.convertFill.style.width = '0%';
    els.convertPercent.textContent = '0%';

    try {
      if (els.convertStatus) els.convertStatus.textContent = window.t('ffmpegLoading');
      const { buffer, ctx } = await decodeAudioFile(file);
      if (els.convertStatus) els.convertStatus.textContent = window.t('conversionStarted');

      let blob;
      if (outputFormat === 'wav') {
        blob = encodeWAV(buffer);
      } else if (outputFormat === 'mp3') {
        blob = await encodeMP3(buffer);
      } else {
        window.showToast('Only MP3 and WAV conversion supported', 'error');
        els.convertBtn.disabled = false;
        els.convertBtn.textContent = window.t('convertBtn');
        return;
      }

      ctx.close();

      const url = URL.createObjectURL(blob);
      els.downloadLink.href = url;
      els.downloadLink.download = file.name.replace(/\.[^.]+$/, '') + '.' + outputFormat;
      els.convertDownload.hidden = false;

      els.convertFill.style.width = '100%';
      els.convertPercent.textContent = '100%';
      els.convertStatus.textContent = window.t('convertSuccess');
      window.showToast(window.t('convertSuccess'), 'success');
    } catch (err) {
      console.error('Conversion error:', err);
      els.convertStatus.textContent = window.t('convertFailed') + ': ' + err.message;
      window.showToast(window.t('convertError'), 'error');
    } finally {
      els.convertBtn.disabled = false;
      els.convertBtn.textContent = window.t('convertBtn');
    }
  }
})();
