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

    // Versuche, bestes Favicon zu finden
    const iconLink = doc.querySelector("link[rel~='icon']");
    if (iconLink && iconLink.href) {
      const iconUrl = new URL(iconLink.href, url).href;

      const imageBlob = await fetch(iconUrl).then(res => res.blob());
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result); // Data URL
        reader.readAsDataURL(imageBlob);
      });
    }
  } catch (e) {
    console.warn("Favicon-Fetch fehlgeschlagen:", e);
  }
  return null;
}

async function fetchFaviconDirect(url) {
  try {
    const baseUrl = new URL(url).origin;
    const faviconUrl = baseUrl + "/favicon.ico";

    const response = await fetch(faviconUrl);
    if (!response.ok) throw new Error("Favicon nicht gefunden");

    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("fetchFaviconDirect fehlgeschlagen:", e);
    return null;
  }
}

async function createBookmarkElement(bookmark) {
  const link = document.createElement("a");
  link.href = bookmark.url;
  link.rel = "noopener noreferrer";
  link.textContent = bookmark.title || bookmark.url;

  // Hole Einstellung ob in neuem Tab
  const { openInNewTab = true } = await chrome.storage.local.get('openInNewTab');
  if (openInNewTab) {
    link.target = "_blank";
  } else {   link.target = "_self"; }


  const favicon = document.createElement("img");
  favicon.className = "favicon";

  try {
    const url = new URL(bookmark.url);
    const hostname = url.hostname;

    const cachedIcon = await getCachedFavicon(hostname);

    if (cachedIcon) {
      favicon.src = cachedIcon;
    } else {
      // Favicon von Google laden
      const googleFavicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
      favicon.src = googleFavicon;

      favicon.onerror = async () => {
        // Versuche echtes Favicon (lokal gecachet)
        const realIcon = await fetchRealFavicon(bookmark.url);
        if (realIcon) {
          favicon.src = realIcon;
          chrome.storage.local.set({ [hostname]: realIcon });
        } else {
          // Fallback-Icon setzen, wenn nichts gefunden
          favicon.src = "icons/default-favicon.png";
        }
      };
    }
  } catch (e) {
    favicon.src = "icons/default-favicon.png";
  }

  link.prepend(favicon);
  return link;
}


async function renderFolder(node, container) {
  const folderDiv = document.createElement('div');
  folderDiv.className = 'folder';

  const folderTitle = document.createElement('h3');
  folderTitle.textContent = node.title || '📁 Ordner';

  // Klick-Event: Alle Links im Ordner öffnen
  folderTitle.addEventListener('click', () => {
    for (const child of node.children) {
      if (child.url) {
		chrome.tabs.create({ url: child.url, active: false });
      }
    }
  });
  
  folderDiv.appendChild(folderTitle);

  for (const child of node.children) {
    if (child.url) {
      const bookmarkEl = await createBookmarkElement(child);  // ← wartet auf favicon
      folderDiv.appendChild(bookmarkEl);
    }
  }

  container.appendChild(folderDiv);
}


document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['backgroundImage'], (result) => {
    const bgUrl = result.backgroundImage || 'background.jpg'; // Fallback
    document.body.style.background = `url('${bgUrl}') no-repeat center center fixed`;
    document.body.style.backgroundSize = 'cover';
  });

chrome.storage.local.get(['backgroundImage'], (result) => {
  const bgUrl = result.backgroundImage || 'background.jpg'; // <- hier backgroundImage
  document.body.style.background = `url('${bgUrl}') no-repeat center center fixed`;
  document.body.style.backgroundSize = 'cover';
});

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
});



document.getElementById('open-options')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.local.get(['theme'], (result) => {
  if (result.theme === 'dark') {
    document.body.classList.add('dark');
  }
});