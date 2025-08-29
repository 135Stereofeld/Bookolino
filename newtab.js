let draggedFolderId = null;
let draggedBookmarkId = null;

// --- Favicons ---
async function getCachedFavicon(hostname) {
  return new Promise((resolve) => {
    chrome.storage.local.get([hostname], (result) => {
      resolve(result[hostname] || null);
    });
  });
}

async function fetchRealFavicon(url) {
  try {
    const html = await fetch(url).then(res => res.text());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const iconLink = doc.querySelector("link[rel~='icon']");
    if (iconLink && iconLink.href) {
      const iconUrl = new URL(iconLink.href, url).href;
      const imageBlob = await fetch(iconUrl).then(res => res.blob());
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(imageBlob);
      });
    }
  } catch (e) {
    console.warn("Favicon-Fetch fehlgeschlagen:", e);
  }
  return null;
}

// --- Bookmark-Element ---
async function createBookmarkElement(bookmark) {
  const link = document.createElement("a");
  link.href = bookmark.url;
  link.rel = "noopener noreferrer";
  link.textContent = bookmark.title || bookmark.url;
  link.className = "bookmark-link";
  link.draggable = true;

  // Open in new tab setting
  const { openInNewTab = true } = await chrome.storage.local.get('openInNewTab');
  link.target = openInNewTab ? "_blank" : "_self";

  // Favicon
  const favicon = document.createElement("img");
  favicon.className = "favicon";
  try {
    const hostname = new URL(bookmark.url).hostname;
    const cachedIcon = await getCachedFavicon(hostname);
    if (cachedIcon) favicon.src = cachedIcon;
    else {
      const googleFavicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
      favicon.src = googleFavicon;
      favicon.onerror = async () => {
        const realIcon = await fetchRealFavicon(bookmark.url);
        if (realIcon) {
          favicon.src = realIcon;
          chrome.storage.local.set({ [hostname]: realIcon });
        } else favicon.src = "icons/default-favicon.png";
      };
    }
  } catch (e) {
    favicon.src = "icons/default-favicon.png";
  }

  link.prepend(favicon);

  // --- Drag & Drop für Links ---
  link.addEventListener("dragstart", (e) => {
    draggedBookmarkId = bookmark.id;
    e.dataTransfer.effectAllowed = 'move';
  });

  link.addEventListener("dragover", (e) => {
    e.preventDefault();
    link.classList.add("drag-over");
  });

  link.addEventListener("dragleave", () => {
    link.classList.remove("drag-over");
  });

  link.addEventListener("drop", async (e) => {
    e.preventDefault();
    link.classList.remove("drag-over");

    if (!draggedBookmarkId || draggedBookmarkId === bookmark.id) return;

    try {
      const [dragged] = await chrome.bookmarks.get(draggedBookmarkId);
      const [target] = await chrome.bookmarks.get(bookmark.id);
      if (!dragged || !target) return;

      let destIndex = target.index;
      if (dragged.parentId === target.parentId && dragged.index < destIndex) destIndex -= 1;

      await chrome.bookmarks.move(draggedBookmarkId, { parentId: target.parentId, index: destIndex });
      location.reload();
    } catch (err) {
      console.error("Fehler beim Link verschieben:", err);
    }
  });

  return link;
}

function createSeparatorElement() {
  const sep = document.createElement('div');
  sep.className = 'separator';
  sep.setAttribute('role', 'separator');
  return sep;
}

// --- Ordner rendern ---
async function renderFolder(node, container) {
  const folderDiv = document.createElement('div');
  folderDiv.className = 'folder';
  folderDiv.dataset.folderId = node.id;

  const folderTitle = document.createElement('h3');
  folderTitle.textContent = node.title || '📁 ' + (chrome.i18n?.getMessage('folder') || 'Ordner');
  folderDiv.appendChild(folderTitle);

  // Drag nur über h3 für Ordner
  folderTitle.draggable = true;
  folderTitle.addEventListener('dragstart', (e) => {
    draggedFolderId = node.id;
    e.dataTransfer.effectAllowed = 'move';
  });
  folderTitle.addEventListener('dragend', () => {
    draggedFolderId = null;
    folderDiv.classList.remove('drop-after');
  });

  // DragTarget: nur nach dem Ordner
  folderDiv.addEventListener('dragover', (e) => {
    if (!draggedFolderId) return;
    e.preventDefault();
    folderDiv.classList.add('drop-after'); // immer nach dem Ordner
  });

  folderDiv.addEventListener('dragleave', () => {
    folderDiv.classList.remove('drop-after');
  });

  folderDiv.addEventListener('drop', async (e) => {
    if (!draggedFolderId) return;
    e.preventDefault();
    folderDiv.classList.remove('drop-after');

    try {
      await moveFolderAfter(draggedFolderId, node.id);
      location.reload();
    } catch (err) {
      console.error('moveFolderAfter error:', err);
    }
  });

  // Klick: alle Links öffnen
  folderTitle.addEventListener('click', () => {
    for (const child of node.children) {
      if (child.url) chrome.tabs.create({ url: child.url, active: false });
    }
  });

  // Inhalte rendern
  for (const child of node.children) {
    if (child.type === 'separator') folderDiv.appendChild(createSeparatorElement());
    else if (child.url) {
      const bookmarkEl = await createBookmarkElement(child);
      folderDiv.appendChild(bookmarkEl);
    }
  }

  container.appendChild(folderDiv);
}

// --- Ordner nach einem Zielordner verschieben ---
async function moveFolderAfter(draggedId, targetId) {
  const [dragged] = await chrome.bookmarks.get(draggedId);
  const [target] = await chrome.bookmarks.get(targetId);
  if (!dragged || !target) return;

  const parentId = target.parentId;
  let siblings = await chrome.bookmarks.getChildren(parentId);
  const targetIndex = siblings.findIndex(s => s.id === targetId);
  siblings = siblings.filter(s => s.id !== draggedId);
  const newIndex = targetIndex + 1;
  await chrome.bookmarks.move(draggedId, { parentId: parentId, index: newIndex });
}

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', async () => {
  
  // Hintergrundbild laden
  chrome.storage.local.get(['backgroundImage'], (result) => {
    const bgUrl = result.backgroundImage || 'background.jpg';
    document.body.style.background = `url('${bgUrl}') no-repeat center center fixed`;
    document.body.style.backgroundSize = 'cover';
  });

  // Bokmarks rendern
  chrome.bookmarks.getTree(async (tree) => {
    const container = document.getElementById('bookmarks');

    container.innerHTML = ''; // <-- Wichtig: vorher alles entfernen!

    if (
      tree.length > 0 &&
      tree[0].children &&
      tree[0].children[0] &&
      tree[0].children[0].children
    ) {
      const firstTopFolder = tree[0].children[0];

      for (const folder of firstTopFolder.children) {
        if (folder.children && folder.children.length > 0) {
          await renderFolder(folder, container); // ← wichtig!
        }
      }
    }
  });


  // Theme
  chrome.storage.local.get(['theme'], (result) => {
    if (result.theme === 'dark') document.body.classList.add('dark');
  });

// Spalten
chrome.storage.local.get(["columns"], (result) => {
  const bookmarksContainer = document.getElementById("bookmarks");

  if (!result.columns || result.columns === "auto") {
	// Automatisch: nichts ändern, CSS mit media queries übernimmt
	bookmarksContainer.classList.remove("fixed-columns");
  } else {
	// feste Spaltenzahl
	bookmarksContainer.classList.add("fixed-columns");
	bookmarksContainer.style.columnCount = result.columns;
  }
});

  // Options
  document.getElementById('open-options')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
