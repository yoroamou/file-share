/* ============================================================
   FileShare — Frontend Logic
   ============================================================ */

// ── State ────────────────────────────────────────────────────
let selectedFiles = [];
const MAX_FILES = 20;
const MAX_SIZE_MB = 100;

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab) {
  const tabs   = ['upload', 'download'];
  const panels = { upload: 'panel-upload', download: 'panel-download' };
  const btnIds = { upload: 'tab-upload',   download: 'tab-download' };

  tabs.forEach(t => {
    const btn   = document.getElementById(btnIds[t]);
    const panel = document.getElementById(panels[t]);
    if (t === tab) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      panel.hidden = false;
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
      panel.hidden = true;
    }
  });

  // Auto-focus first code box when switching to download
  if (tab === 'download') {
    setTimeout(() => document.getElementById('cb0')?.focus(), 50);
  }
}

// ── Check URL params on load ──────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initDropZone();
  initCodeBoxes();

  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  if (code) {
    switchTab('download');
    const chars = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    chars.split('').forEach((ch, i) => {
      const box = document.getElementById(`cb${i}`);
      if (box) { box.value = ch; box.classList.add('filled'); }
    });
    updateDownloadBtn();
    previewCode();
  }
});

// ── Drop Zone ─────────────────────────────────────────────────
function initDropZone() {
  const zone  = document.getElementById('drop-zone');
  const input = document.getElementById('file-input');

  ['dragenter', 'dragover'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag-over'); })
  );
  ['dragleave', 'drop'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag-over'); })
  );

  zone.addEventListener('drop', e => {
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  });

  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  zone.addEventListener('click', e => {
    if (!e.target.closest('button')) input.click();
  });

  input.addEventListener('change', () => {
    addFiles(Array.from(input.files));
    input.value = '';
  });
}

function addFiles(newFiles) {
  for (const f of newFiles) {
    if (selectedFiles.length >= MAX_FILES) {
      showToast(`Max ${MAX_FILES} files allowed.`);
      break;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast(`"${f.name}" exceeds ${MAX_SIZE_MB}MB limit.`);
      continue;
    }
    if (!selectedFiles.find(sf => sf.name === f.name && sf.size === f.size)) {
      selectedFiles.push(f);
    }
  }
  renderFileList();
}

function removeFile(idx) {
  selectedFiles.splice(idx, 1);
  renderFileList();
}

function renderFileList() {
  const list    = document.getElementById('file-list');
  const btn     = document.getElementById('upload-btn');
  const dropZone = document.getElementById('drop-zone');

  list.innerHTML = '';

  if (selectedFiles.length === 0) {
    list.hidden = true;
    btn.hidden  = true;
    dropZone.style.display = '';
    return;
  }

  dropZone.style.display = selectedFiles.length >= 3 ? 'none' : '';
  list.hidden = false;
  btn.hidden  = false;

  selectedFiles.forEach((f, i) => {
    const ext  = f.name.split('.').pop().slice(0, 4).toUpperCase() || 'FILE';
    const size = formatSize(f.size);
    const li   = document.createElement('li');
    li.className = 'file-item';
    li.innerHTML = `
      <div class="file-icon">${ext}</div>
      <span class="file-item-name">${escHtml(f.name)}</span>
      <span class="file-item-size">${size}</span>
      <button class="file-remove" onclick="removeFile(${i})" title="Remove" aria-label="Remove ${escHtml(f.name)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    list.appendChild(li);
  });
}

// ── Upload ────────────────────────────────────────────────────
async function uploadFiles() {
  if (!selectedFiles.length) return;

  const btn      = document.getElementById('upload-btn');
  const progress = document.getElementById('upload-progress');
  const fill     = document.getElementById('progress-fill');
  const label    = document.getElementById('progress-label');

  btn.hidden      = true;
  progress.hidden = false;

  const fd = new FormData();
  selectedFiles.forEach(f => fd.append('files', f));

  // Simulate progress (XHR for real progress tracking)
  const xhr = new XMLHttpRequest();

  const uploadPromise = new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 95);
        fill.style.width = pct + '%';
        label.textContent = `Uploading… ${pct}%`;
      }
    });
    xhr.addEventListener('load', () => {
      fill.style.width = '100%';
      label.textContent = 'Processing…';
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
      else reject(JSON.parse(xhr.responseText));
    });
    xhr.addEventListener('error', () => reject({ error: 'Network error' }));
  });

  xhr.open('POST', '/upload');
  xhr.send(fd);

  try {
    const data = await uploadPromise;
    setTimeout(() => showUploadResult(data), 300);
  } catch (err) {
    progress.hidden = true;
    btn.hidden = false;
    showToast(err.error || 'Upload failed. Please try again.');
  }
}

function showUploadResult(data) {
  document.getElementById('upload-progress').hidden = true;
  document.getElementById('drop-zone').style.display = 'none';
  document.getElementById('file-list').hidden = true;

  document.getElementById('code-chars').textContent = data.code;
  document.getElementById('qr-img').src = data.qr_code;

  const meta = data.files.length === 1
    ? `1 file: ${escHtml(data.files[0])}`
    : `${data.files.length} files: ${data.files.map(escHtml).join(', ')}`;
  document.getElementById('result-meta').textContent = meta;

  const mins = Math.round(data.expires_in / 60);
  document.getElementById('result-expiry').textContent = `⏱ Expires in ${mins} minute${mins !== 1 ? 's' : ''}`;

  document.getElementById('upload-result').hidden = false;
}

function resetUpload() {
  selectedFiles = [];
  document.getElementById('upload-result').hidden = true;
  document.getElementById('drop-zone').style.display = '';
  document.getElementById('file-list').hidden = true;
  document.getElementById('upload-btn').hidden = true;
  document.getElementById('upload-progress').hidden = true;
  document.getElementById('progress-fill').style.width = '0%';
}

function copyCode() {
  const code = document.getElementById('code-chars').textContent;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => {
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    }, 2000);
  });
}

// ── Download code boxes ───────────────────────────────────────
function initCodeBoxes() {
  const boxes = Array.from(document.querySelectorAll('.code-box'));

  boxes.forEach((box, i) => {
    box.addEventListener('input', e => {
      let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (val.length > 1) {
        // Handle paste into a single box
        const remaining = val.slice(0, 6 - i);
        remaining.split('').forEach((ch, offset) => {
          const target = boxes[i + offset];
          if (target) { target.value = ch; target.classList.add('filled'); }
        });
        const nextIdx = Math.min(i + remaining.length, 5);
        boxes[nextIdx]?.focus();
      } else {
        box.value = val;
        box.classList.toggle('filled', val !== '');
        if (val) boxes[i + 1]?.focus();
      }
      updateDownloadBtn();
    });

    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value) {
        boxes[i - 1]?.focus();
      } else if (e.key === 'ArrowLeft') {
        boxes[i - 1]?.focus();
      } else if (e.key === 'ArrowRight') {
        boxes[i + 1]?.focus();
      } else if (e.key === 'Enter') {
        downloadFile();
      }
    });

    box.addEventListener('focus', () => box.select());

    // Handle paste on entire group
    box.addEventListener('paste', e => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData)
        .getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      text.split('').forEach((ch, idx) => {
        if (boxes[idx]) { boxes[idx].value = ch; boxes[idx].classList.add('filled'); }
      });
      updateDownloadBtn();
      boxes[Math.min(text.length, 5)]?.focus();
      if (text.length === 6) previewCode();
    });
  });
}

function getEnteredCode() {
  return Array.from(document.querySelectorAll('.code-box')).map(b => b.value).join('');
}

function updateDownloadBtn() {
  const code = getEnteredCode();
  document.getElementById('download-btn').disabled = code.length < 6;
  if (code.length === 6) previewCode();
}

let previewTimeout = null;
function previewCode() {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(async () => {
    const code = getEnteredCode();
    if (code.length < 6) return;
    try {
      const res = await fetch(`/check?code=${encodeURIComponent(code)}`);
      const infoCard = document.getElementById('file-info-card');
      const errDiv   = document.getElementById('download-error');
      if (res.ok) {
        const d = await res.json();
        errDiv.hidden = true;
        const fileList = d.files.map(f => `<li>${escHtml(f)}</li>`).join('');
        const mins = Math.round(d.expires_in / 60);
        infoCard.innerHTML = `<h4>Ready to download</h4><ul>${fileList}</ul><p style="font-size:.75rem;color:var(--muted);margin-top:8px">⏱ Expires in ${mins}m</p>`;
        infoCard.hidden = false;
      } else {
        infoCard.hidden = true;
      }
    } catch (_) { /* ignore network errors during preview */ }
  }, 400);
}

async function downloadFile() {
  const code    = getEnteredCode();
  const errDiv  = document.getElementById('download-error');
  const infoCard = document.getElementById('file-info-card');
  const btn     = document.getElementById('download-btn');

  if (code.length < 6) return;

  errDiv.hidden = true;
  btn.textContent = 'Checking…';
  btn.disabled = true;

  try {
    const check = await fetch(`/check?code=${encodeURIComponent(code)}`);
    if (!check.ok) {
      const errData = check.status === 404
        ? 'Invalid code. Please check and try again.'
        : check.status === 410
          ? 'This share has expired. Ask the sender to re-upload.'
          : 'Something went wrong. Please try again.';
      errDiv.textContent = errData;
      errDiv.hidden = false;
      infoCard.hidden = true;
      return;
    }
    // Trigger download
    window.location.href = `/download?code=${encodeURIComponent(code)}`;
  } catch (_) {
    errDiv.textContent = 'Network error. Please check your connection.';
    errDiv.hidden = false;
  } finally {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download`;
    btn.disabled = false;
  }
}

// ── Utilities ─────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024)         return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(60px);
      background:#161616;border:1.5px solid rgba(255,107,107,.3);color:#ff6b6b;
      padding:12px 24px;border-radius:50px;font-size:.87rem;font-weight:600;
      box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:9999;
      transition:transform .3s cubic-bezier(.4,0,.2,1),opacity .3s;
      opacity:0;pointer-events:none;white-space:nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(60px)';
  }, 3000);
}
