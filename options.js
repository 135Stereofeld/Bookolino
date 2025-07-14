document.addEventListener('DOMContentLoaded', () => {
  const backgroundUrlInput = document.getElementById('backgroundUrlInput');
  const saveUrlBtn = document.getElementById('saveUrlBtn');
  const backgroundFileInput = document.getElementById('backgroundFileInput');
  const preview = document.getElementById('preview');
  const deleteImageBtn = document.getElementById('deleteImageBtn');
  const openInNewTabCheckbox = document.getElementById('openInNewTab');
  const themeToggle = document.getElementById('themeToggle');

  // Vorhandenes Bild laden
  chrome.storage.local.get(['backgroundImage'], (result) => {
    if (result.backgroundImage) {
      preview.src = result.backgroundImage;
    }
  });

  saveUrlBtn.addEventListener('click', () => {
    const url = backgroundUrlInput.value.trim();
    if (url) {
      preview.src = url;
      chrome.storage.local.set({ backgroundImage: url });
    }
  });

  backgroundFileInput.addEventListener('change', () => {
    const file = backgroundFileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        preview.src = e.target.result;
        chrome.storage.local.set({ backgroundImage: e.target.result });
      };
      reader.readAsDataURL(file);
    }
  });

  deleteImageBtn.addEventListener('click', () => {
    chrome.storage.local.remove('backgroundImage', () => {
      preview.src = '';
      backgroundUrlInput.value = '';
      backgroundFileInput.value = '';
      alert('Hintergrundbild wurde gelöscht.');
    });
  });

  // Open in new tab
  chrome.storage.local.get(['openInNewTab'], (result) => {
    openInNewTabCheckbox.checked = result.openInNewTab ?? true; // Default true
  });
  openInNewTabCheckbox.addEventListener('change', (e) => {
    chrome.storage.local.set({ openInNewTab: e.target.checked });
  });

  // Theme Toggle
  chrome.storage.local.get(['theme'], (result) => {
    if (result.theme === 'dark') {
      document.body.classList.add('dark');
      themeToggle.checked = true;
    }
  });

  themeToggle.addEventListener('change', () => {
    if (themeToggle.checked) {
      document.body.classList.add('dark');
      chrome.storage.local.set({ theme: 'dark' });
    } else {
      document.body.classList.remove('dark');
      chrome.storage.local.set({ theme: 'light' });
    }
  });
});
