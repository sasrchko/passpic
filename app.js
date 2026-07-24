// ===== PRESETS =====
const PRESETS = [
  { id: 'indian', name: 'Indian Passport Seva', width: 630, height: 810, format: 'image/jpeg', quality: 0.92 },
  { id: 'us', name: 'US Passport', width: 600, height: 600, format: 'image/jpeg', quality: 0.92 },
  { id: 'schengen', name: 'Schengen / EU', width: 413, height: 531, format: 'image/jpeg', quality: 0.92 },
  { id: 'oci', name: 'Indian / OCI 2×2"', width: 600, height: 600, format: 'image/jpeg', quality: 0.92 },
  { id: 'web', name: 'Web HD', width: 1920, height: 1080, format: 'image/jpeg', quality: 0.85 },
  { id: 'instagram', name: 'Instagram', width: 1080, height: 1080, format: 'image/jpeg', quality: 0.85 }
];

// ===== STATE =====
let images = [];          // { id, file, originalUrl, processedUrl, width, height, name }
let activePreset = null;

// ===== DOM =====
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const presetGrid = document.getElementById('globalPresets');
const queueSection = document.getElementById('queue');
const imageList = document.getElementById('imageList');
const imageCount = document.getElementById('imageCount');
const clearAllBtn = document.getElementById('clearAll');
const downloadAllBtn = document.getElementById('downloadAll');

// ===== ANALYTICS HELPER =====
function track(eventName, label = '') {
  if (typeof gtag === 'function') {
    gtag('event', eventName, {
      event_category: 'tool',
      event_label: label
    });
  }
}

// ===== INIT =====
function init() {
  renderPresets();
  setupEventListeners();
}

function renderPresets() {
  presetGrid.innerHTML = PRESETS.map(p => `
    <button class="preset-card" data-id="${p.id}">
      <span class="preset-name">${p.name}</span>
      <span class="preset-spec">${p.width} × ${p.height}</span>
    </button>
  `).join('');
}

function setupEventListeners() {
  // File select
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFiles);

  // Drag & drop
  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFiles({ target: { files: e.dataTransfer.files } });
    }
  });

  // Preset clicks
  presetGrid.addEventListener('click', e => {
    const btn = e.target.closest('.preset-card');
    if (!btn) return;
    const id = btn.dataset.id;
    const preset = PRESETS.find(p => p.id === id);
    if (preset) applyPreset(preset);
  });

  clearAllBtn.addEventListener('click', clearAll);
  downloadAllBtn.addEventListener('click', downloadAll);
}

// ===== FILE HANDLING =====
function handleFiles(e) {
  const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;

  track('select_images', `${files.length}_files`);

  files.forEach(file => {
    const id = Date.now() + Math.random().toString(36).slice(2);
    const originalUrl = URL.createObjectURL(file);

    images.push({
      id,
      file,
      originalUrl,
      processedUrl: null,
      width: null,
      height: null,
      name: file.name
    });
  });

  renderQueue();
  if (activePreset) {
    processAll(activePreset);
  }
}

// ===== PRESET & PROCESSING =====
function applyPreset(preset) {
  activePreset = preset;

  // Highlight active preset
  document.querySelectorAll('.preset-card').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === preset.id);
  });

  track('apply_preset', preset.id);

  if (images.length) {
    processAll(preset);
  }
}

function processAll(preset) {
  images.forEach(img => processImage(img, preset));
}

function processImage(img, preset) {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = preset.width;
    canvas.height = preset.height;
    const ctx = canvas.getContext('2d');

    // Simple cover fit
    const scale = Math.max(preset.width / image.width, preset.height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    const x = (preset.width - w) / 2;
    const y = (preset.height - h) / 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, preset.width, preset.height);
    ctx.drawImage(image, x, y, w, h);

    canvas.toBlob(blob => {
      if (img.processedUrl) URL.revokeObjectURL(img.processedUrl);
      img.processedUrl = URL.createObjectURL(blob);
      img.width = preset.width;
      img.height = preset.height;
      renderQueue();
    }, preset.format, preset.quality);
  };
  image.src = img.originalUrl;
}

// ===== QUEUE UI =====
function renderQueue() {
  if (!images.length) {
    queueSection.classList.add('hidden');
    downloadAllBtn.disabled = true;
    return;
  }

  queueSection.classList.remove('hidden');
  imageCount.textContent = images.length;
  downloadAllBtn.disabled = !images.some(i => i.processedUrl);

  imageList.innerHTML = images.map(img => `
    <div class="image-card" data-id="${img.id}">
      <div class="image-preview">
        <img src="${img.processedUrl || img.originalUrl}" alt="${img.name}" />
      </div>
      <div class="image-info">
        <div class="image-name">${img.name}</div>
        <div class="image-size">
          ${img.width ? `${img.width} × ${img.height}` : 'Original'}
        </div>
      </div>
      <div class="image-actions">
        ${img.processedUrl ? `<button class="btn btn-primary btn-sm download-one" data-id="${img.id}">Download</button>` : ''}
        <button class="btn btn-ghost btn-sm remove-one" data-id="${img.id}">Remove</button>
      </div>
    </div>
  `).join('');

  // Bind per-image buttons
  imageList.querySelectorAll('.download-one').forEach(btn => {
    btn.addEventListener('click', () => downloadOne(btn.dataset.id));
  });
  imageList.querySelectorAll('.remove-one').forEach(btn => {
    btn.addEventListener('click', () => removeOne(btn.dataset.id));
  });
}

// ===== DOWNLOAD & CLEAR =====
function downloadOne(id) {
  const img = images.find(i => i.id === id);
  if (!img || !img.processedUrl) return;

  track('download', 'single');

  const a = document.createElement('a');
  a.href = img.processedUrl;
  a.download = `passpic_${img.width}x${img.height}_${img.name}`;
  a.click();
}

function downloadAll() {
  const ready = images.filter(i => i.processedUrl);
  if (!ready.length) return;

  track('download', `batch_${ready.length}`);

  ready.forEach(img => {
    const a = document.createElement('a');
    a.href = img.processedUrl;
    a.download = `passpic_${img.width}x${img.height}_${img.name}`;
    a.click();
  });
}

function removeOne(id) {
  const idx = images.findIndex(i => i.id === id);
  if (idx === -1) return;
  if (images[idx].originalUrl) URL.revokeObjectURL(images[idx].originalUrl);
  if (images[idx].processedUrl) URL.revokeObjectURL(images[idx].processedUrl);
  images.splice(idx, 1);
  renderQueue();
}

function clearAll() {
  images.forEach(img => {
    if (img.originalUrl) URL.revokeObjectURL(img.originalUrl);
    if (img.processedUrl) URL.revokeObjectURL(img.processedUrl);
  });
  images = [];
  activePreset = null;
  document.querySelectorAll('.preset-card').forEach(btn => btn.classList.remove('active'));
  renderQueue();
  track('clear_all');
}

// ===== START =====
init();
