document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const messageName = el.getAttribute('data-i18n');
    const msg = chrome.i18n.getMessage(messageName);
    if (msg) {
      if (el.tagName.toLowerCase() === 'input' && el.type === 'text') {
        el.placeholder = msg;
      } else if (el.tagName.toLowerCase() === 'title') {
        document.title = msg;
      } else {
        el.textContent = msg;
      }
    }
  });
});
