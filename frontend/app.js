(function () {
  const ALLOWED = ['image/png', 'image/jpeg', 'application/pdf', 'text/plain'];
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const saveBtn = document.getElementById('saveBtn');
  const message = document.getElementById('message');
  const refreshBtn = document.getElementById('refreshBtn');
  const filesTbody = document.getElementById('filesTbody');

  let selectedFile = null;

  // IndexedDB setup
  let db;
  const DB_NAME = 'file_uploader_frontend';
  const STORE = 'files';

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          const store = d.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('uploadDate', 'uploadDate');
        }
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2);
  }

  function addRecord(record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function listRecords(limit = 100) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const index = store.index('uploadDate');
      const results = [];
      const direction = 'prev'; // newest first
      const req = index.openCursor(null, direction);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  function getRecord(id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function deleteRecord(id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0; let v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${units[i]}`;
  }

  function setMessage(text, type = 'info') {
    message.textContent = text;
    message.className = `message ${type}`;
  }

  function validateFile(file) {
    if (!file) return 'No file selected';
    if (!ALLOWED.includes(file.type)) return `Unsupported type: ${file.type || 'unknown'}`;
    if (file.size > MAX_SIZE) return `File too large: ${formatBytes(file.size)}`;
    return null;
  }

  function onFileSelected(file) {
    const err = validateFile(file);
    if (err) {
      setMessage(err, 'error');
      selectedFile = null;
      saveBtn.disabled = true;
      return;
    }
    selectedFile = file;
    setMessage(`Ready: ${file.name} (${formatBytes(file.size)})`, 'success');
    saveBtn.disabled = false;
  }

  // Drag & drop
  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); });
  });
  dropzone.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) onFileSelected(f);
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) onFileSelected(f);
  });

  saveBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    try {
      const rec = {
        id: uuid(),
        filename: selectedFile.name,
        contentType: selectedFile.type,
        length: selectedFile.size,
        uploadDate: new Date().toISOString(),
        blob: selectedFile,
      };
      await addRecord(rec);
      setMessage('Saved to browser storage', 'success');
      saveBtn.disabled = true;
      selectedFile = null;
      fileInput.value = '';
      await renderList();
    } catch (err) {
      console.error(err);
      setMessage('Failed to save file', 'error');
    }
  });

  refreshBtn.addEventListener('click', () => renderList());

  async function renderList() {
    const items = await listRecords(200);
    filesTbody.innerHTML = '';
    for (const it of items) {
      const tr = document.createElement('tr');
      const dateStr = new Date(it.uploadDate).toLocaleString();
      tr.innerHTML = `
        <td>${it.filename}</td>
        <td>${it.contentType || 'unknown'}</td>
        <td>${formatBytes(it.length || 0)}</td>
        <td>${dateStr}</td>
        <td class="actions">
          <button class="action-btn" data-action="download" data-id="${it.id}">Download</button>
          <button class="action-btn" data-action="delete" data-id="${it.id}">Delete</button>
        </td>
      `;
      filesTbody.appendChild(tr);
    }
  }

  filesTbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button.action-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (action === 'download') {
      const rec = await getRecord(id);
      if (!rec) return setMessage('File not found', 'error');
      const url = URL.createObjectURL(rec.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = rec.filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else if (action === 'delete') {
      await deleteRecord(id);
      await renderList();
      setMessage('Deleted', 'success');
    }
  });

  // Initialize
  openDb()
    .then(() => renderList())
    .catch((err) => {
      console.error('IndexedDB init failed', err);
      setMessage('Browser storage not available', 'error');
    });
})();
