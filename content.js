(async () => {
  try {
    const hostname = location.hostname;

    // Favicon ermitteln (über <link rel="icon"> oder Standard /favicon.ico)
    let iconUrl = null;

    // Versuche <link rel="icon" oder rel="shortcut icon">
    const iconLink = document.querySelector("link[rel~='icon']");
    if (iconLink && iconLink.href) {
      iconUrl = iconLink.href;
    } else {
      // Fallback: /favicon.ico
      iconUrl = location.origin + "/favicon.ico";
    }

    // Icon als Data URL speichern
    const response = await fetch(iconUrl);
    if (!response.ok) throw new Error("Favicon konnte nicht geladen werden");
    const blob = await response.blob();

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      chrome.storage.local.set({ [hostname]: dataUrl });
    };
    reader.readAsDataURL(blob);

  } catch (e) {
    // Falls Fehler, einfach ignorieren oder Debug loggen
    // console.warn("Favicon speichern fehlgeschlagen:", e);
  }
})();
