// Run before Reveal initializes its PDF and menu keyboard handlers.
window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey || event.altKey) {
    // The PDF plugin also matches modified letters. Leave browser printing to the browser.
    if (key === "p" && /print-pdf|view=print/.test(location.search)) event.stopImmediatePropagation();
    return;
  }
  if (event.isComposing || event.target.closest?.("input,textarea,select,[contenteditable]") ||
      !document.body.classList.contains("slide-menu-active")) return;
  const panel = document.querySelector(".slide-menu-custom-panel.active-menu-panel");
  const link = key === "e" ? panel?.querySelector(".edit-mode-link") :
    key === "p" ? panel?.querySelector('a[onclick*="togglePdfExport"]') : null;
  if (link) {
    event.preventDefault();
    event.stopImmediatePropagation();
    link.click();
  }
}, true);
