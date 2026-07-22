/**
 * ImageOpt — Privacy-first image compressor & resizer
 * Light theme + prominent presets + auto-reprocess
 */

(() => {
  'use strict';

  const PRESETS = {
    indian_passport_seva: {
      label: 'Indian Passport (Seva)',
      short: 'Passport Seva',
      spec: '630 × 810 · JPEG',
      maxWidth: 630,
      maxHeight: 810,
      format: 'jpeg',
      quality: 85
    },
    indian_2x2: {
      label: 'Indian / OCI 2×2"',
      short: '2×2"',
      spec: '600 × 600 · JPEG',
      maxWidth: 600,
      maxHeight: 600,
      format: 'jpeg',
      quality: 90
    },
    us_passport: {
      label: 'US Passport',
      short: 'US Passport',
      spec: '600 × 600 · JPEG',
      maxWidth: 600,
      maxHeight: 600,
      format: 'jpeg',
      quality: 90
    },
    schengen: {
      label: 'Schengen / EU',
      short: 'Schengen',
      spec: '413 × 531 · JPEG',
      maxWidth: 413,
      maxHeight: 531,
      format: 'jpeg',
      quality: 90
    },
    web_hd: {
      label: 'Web HD',
      short: 'Web HD',
      spec: '1920px wide',
      maxWidth: 1920,
      maxHeight: 0,
      format: 'original',
      quality: 82
    },
    instagram: {
      label: 'Instagram',
      short: 'Instagram',
      spec: '1080 × 1080',
      maxWidth: 1080,
      maxHeight: 1080,
      format: 'jpeg',
      quality: 85
    },
    custom: {
      label: 'Custom',
      short: 'Custom',
      spec: 'Manual settings',
      maxWidth: 0,
      maxHeight: 0,
      format: 'original',
      quality: 80
    }
  };

  const state = {
    items: [],
    activeGlobalPreset: null
  };

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const queueSection = document.getElementById('queue');
  const imageList = document.getElementById('imageList');
  const imageCount = document.getElementById('imageCount');
  const clearAllBtn = document.getElementById('clearAll');
  const downloadAllBtn = document.getElementById('downloadAll');
  const globalPresetsEl = document.getElementById('globalPresets');

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)) + ' ' + sizes[i];
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }

  async function processImage(item) {
    const { file, settings } = item;
    const { img } = await loadImage(file);

    let targetW = img.naturalWidth;
    let targetH = img.naturalHeight;
    const maxW = settings.maxWidth || 0;
    const maxH = settings.maxHeight || 0;

    if (maxW > 0 || maxH > 0) {
      const ratio = targetW / targetH;
      if (maxW > 0 && targetW > maxW) {
        targetW = maxW;
        targetH = Math.round(maxW / ratio);
      }
      if (maxH > 0 && targetH > maxH) {
        targetH = maxH;
        targetW = Math.round(maxH * ratio);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    let mime = file.type;
    let quality = settings.quality / 100;

    if (settings.format === 'jpeg') mime = 'image/jpeg';
    else if (settings.format === 'webp') mime = 'image/webp';
    else if (settings.format === 'png') {
      mime = 'image/png';
      quality = undefined;
    } else if (mime === 'image/png' || mime === 'image/gif' || mime === 'image/bmp') {
      quality = undefined;
    }

    const blob = await new Promise(resolve => {
      canvas.toBlob(b => resolve(b), mime, quality);
    });

    return { blob, width: targetW, height: targetH };
  }

  // ---------- Prominent preset cards ----------
  function renderGlobalPresets() {
    const order = ['indian_passport_seva', 'indian_2x2', 'us_passport', 'schengen', 'web_hd', 'instagram'];
    globalPresetsEl.innerHTML = order.map(key => {
      const p = PRESETS[key];
      const active = state.activeGlobalPreset === key ? 'active' : '';
      return `
        <button class="preset-card ${active}" data-preset="${key}">
          <span class="preset-name">${p.short}</span>
          <span class="preset-spec">${p.spec}</span>
        </button>
      `;
    }).join('');

    globalPresetsEl.querySelectorAll('.preset-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.preset;
        state.activeGlobalPreset = key;
        applyPresetToAll(key);   // auto-processes
        renderGlobalPresets();
      });
    });
  }

  function applyPresetToAll(key) {
    const p = PRESETS[key];
    if (!p) return;

    state.items.forEach(item => {
      item.settings.preset = key;
      item.settings.maxWidth = p.maxWidth;
      item.settings.maxHeight = p.maxHeight;
      item.settings.format = p.format;
      item.settings.quality = p.quality;
    });

    // Auto re-process everything
    state.items.forEach(item => processItem(item.id));
  }

  // ---------- Rendering ----------
  function render() {
    const count = state.items.length;
    imageCount.textContent = count;
    queueSection.classList.toggle('hidden', count === 0);
    downloadAllBtn.disabled = !state.items.some(i => i.resultBlob);

    imageList.innerHTML = '';
    state.items.forEach(item => imageList.appendChild(createCard(item)));
  }

  function createCard(item) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.dataset.id = item.id;

    const saved = item.resultSize != null
      ? Math.round((1 - item.resultSize / item.originalSize) * 100)
      : null;

    const sizeBadge = saved != null
      ? `<span class="size-badge ${saved < 0 ? 'worse' : ''}">${saved > 0 ? '−' + saved + '%' : saved + '%'}</span>`
      : '';

    const hasResult = item.resultUrl && item.status === 'done';

    card.innerHTML = `
      <div class="image-card-inner ${hasResult ? 'has-result' : ''}">
        <div class="preview-col">
          <span class="preview-label">Original</span>
          <img src="${item.originalUrl}" alt="Original" />
        </div>
        ${hasResult ? `
        <div class="preview-col result-preview">
          <span class="preview-label">Result</span>
          <img src="${item.resultUrl}" alt="Optimized" />
        </div>` : ''}
        <div class="controls-col">
          <div class="file-meta">
            <span class="file-name">${escapeHtml(item.file.name)}</span>
            <span class="file-size">${formatBytes(item.originalSize)}${item.resultSize != null ? ' → ' + formatBytes(item.resultSize) : ''}</span>
            ${sizeBadge}
          </div>

          <div class="controls-grid">
            <div class="control-group" style="grid-column: 1 / -1;">
              <label>Preset</label>
              <select data-setting="preset">
                ${Object.entries(PRESETS).map(([key, p]) =>
                  `<option value="${key}" ${item.settings.preset === key ? 'selected' : ''}>${p.label}</option>`
                ).join('')}
              </select>
            </div>
            <div class="control-group">
              <label>Quality <span class="range-value" data-qval>${item.settings.quality}%</span></label>
              <input type="range" min="10" max="100" value="${item.settings.quality}" data-setting="quality" ${item.settings.format === 'png' ? 'disabled' : ''} />
            </div>
            <div class="control-group">
              <label>Max width</label>
              <input type="number" min="0" placeholder="Auto" value="${item.settings.maxWidth || ''}" data-setting="maxWidth" />
            </div>
            <div class="control-group">
              <label>Max height</label>
              <input type="number" min="0" placeholder="Auto" value="${item.settings.maxHeight || ''}" data-setting="maxHeight" />
            </div>
            <div class="control-group">
              <label>Format</label>
              <select data-setting="format">
                <option value="original" ${item.settings.format === 'original' ? 'selected' : ''}>Original</option>
                <option value="jpeg" ${item.settings.format === 'jpeg' ? 'selected' : ''}>JPEG</option>
                <option value="webp" ${item.settings.format === 'webp' ? 'selected' : ''}>WebP</option>
                <option value="png" ${item.settings.format === 'png' ? 'selected' : ''}>PNG</option>
              </select>
            </div>
          </div>

          <div class="status-row">
            ${item.status === 'processing' ? '<div class="spinner"></div><span>Processing…</span>' : ''}
            ${item.status === 'done' && item.resultWidth ? `<span>${item.resultWidth} × ${item.resultHeight} px</span>` : ''}
            ${item.status === 'error' ? `<span style="color:var(--danger)">${escapeHtml(item.errorMsg || 'Error')}</span>` : ''}
          </div>

          <div class="card-actions">
            <button class="btn btn-primary btn-sm" data-action="download" ${!item.resultBlob ? 'disabled' : ''}>
              Download
            </button>
            <button class="btn btn-sm btn-danger" data-action="remove">Remove</button>
          </div>
        </div>
      </div>
    `;

    // Quality live update
    const qualityInput = card.querySelector('[data-setting="quality"]');
    const qVal = card.querySelector('[data-qval]');
    if (qualityInput) {
      qualityInput.addEventListener('input', e => {
        qVal.textContent = e.target.value + '%';
        item.settings.quality = Number(e.target.value);
      });
      // Auto-reprocess when user finishes adjusting quality
      qualityInput.addEventListener('change', () => processItem(item.id));
    }

    card.querySelectorAll('[data-setting]').forEach(el => {
      el.addEventListener('change', e => {
        const key = e.target.dataset.setting;
        let val = e.target.value;
        if (key === 'quality' || key === 'maxWidth' || key === 'maxHeight') {
          val = val === '' ? 0 : Number(val);
        }
        item.settings[key] = val;

        if (key === 'preset' && PRESETS[val]) {
          const p = PRESETS[val];
          item.settings.maxWidth = p.maxWidth;
          item.settings.maxHeight = p.maxHeight;
          item.settings.format = p.format;
          item.settings.quality = p.quality;

          // Update UI fields
          const wInput = card.querySelector('[data-setting="maxWidth"]');
          const hInput = card.querySelector('[data-setting="maxHeight"]');
          const fSelect = card.querySelector('[data-setting="format"]');
          const qInput2 = card.querySelector('[data-setting="quality"]');
          if (wInput) wInput.value = p.maxWidth || '';
          if (hInput) hInput.value = p.maxHeight || '';
          if (fSelect) fSelect.value = p.format;
          if (qInput2) {
            qInput2.value = p.quality;
            qInput2.disabled = p.format === 'png';
          }
          if (qVal) qVal.textContent = p.quality + '%';

          // Auto re-process
          processItem(item.id);
          return;
        }

        if (key === 'format') {
          const qInput2 = card.querySelector('[data-setting="quality"]');
          if (qInput2) qInput2.disabled = val === 'png';
        }

        // Manual changes → switch to custom + auto reprocess
        if (['maxWidth', 'maxHeight', 'format'].includes(key)) {
          item.settings.preset = 'custom';
          const pSelect = card.querySelector('[data-setting="preset"]');
          if (pSelect) pSelect.value = 'custom';
          processItem(item.id);
        }
      });
    });

    card.querySelector('[data-action="download"]').addEventListener('click', () => downloadItem(item));
    card.querySelector('[data-action="remove"]').addEventListener('click', () => removeItem(item.id));

    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Actions ----------
  async function addFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;

    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        alert(`Skipping ${file.name}: too large (max ~25 MB).`);
        continue;
      }
      try {
        const { img, url } = await loadImage(file);
        state.items.push({
          id: uid(),
          file,
          originalUrl: url,
          originalSize: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
          settings: {
            quality: 80,
            maxWidth: 0,
            maxHeight: 0,
            format: 'original',
            preset: 'custom'
          },
          resultBlob: null,
          resultUrl: null,
          resultSize: null,
          resultWidth: null,
          resultHeight: null,
          status: 'idle',
          errorMsg: null
        });
      } catch (err) {
        console.error(err);
      }
    }

    render();
    // Auto process with current/default settings
    state.items.filter(i => i.status === 'idle').forEach(i => processItem(i.id));
  }

  async function processItem(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    item.status = 'processing';
    item.errorMsg = null;
    render();

    try {
      const result = await processImage(item);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      item.resultBlob = result.blob;
      item.resultUrl = URL.createObjectURL(result.blob);
      item.resultSize = result.blob.size;
      item.resultWidth = result.width;
      item.resultHeight = result.height;
      item.status = 'done';
    } catch (err) {
      item.status = 'error';
      item.errorMsg = err.message || 'Failed';
    }
    render();
  }

  function downloadItem(item) {
    if (!item.resultBlob) return;
    const a = document.createElement('a');
    a.href = item.resultUrl;
    const ext = (item.resultBlob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const base = item.file.name.replace(/\.[^.]+$/, '');
    a.download = `${base}-optimized.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function removeItem(id) {
    const idx = state.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    const item = state.items[idx];
    if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
    if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    state.items.splice(idx, 1);
    render();
  }

  function clearAll() {
    state.items.forEach(item => {
      if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    state.items = [];
    state.activeGlobalPreset = null;
    render();
    renderGlobalPresets();
  }

  async function downloadAll() {
    for (const item of state.items) {
      if (item.resultBlob) {
        downloadItem(item);
        await new Promise(r => setTimeout(r, 280));
      }
    }
  }

  // Events
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files?.length) addFiles(e.target.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', e => {
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());

  clearAllBtn.addEventListener('click', clearAll);
  downloadAllBtn.addEventListener('click', downloadAll);

  // Init
  renderGlobalPresets();
  render();
})();
