(() => {
  const isPrintExport = () => (
    /print-pdf|view=print/i.test(window.location.search)
    || document.documentElement.classList.contains("reveal-print")
  );
  const editorPort = document.querySelector('meta[name="slide-editor-port"]')?.content;
  const hasPreviewEditor = () => editorPort && window.QuartoPreview && !isPrintExport() &&
    ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);

  function addEditTool() {
    const index = Reveal.getConfig().menu?.custom?.findIndex(panel => panel.title === "Tools");
    const list = document.querySelector(`.slide-menu-panel[data-panel="Custom${index}"] .slide-menu-items`);
    if (!list) return;
    const pdfKey = list.querySelector('a[onclick*="togglePdfExport"] kbd');
    if (pdfKey) pdfKey.textContent = (Reveal.getConfig().pdfExportShortcut || "E").toLowerCase();
    if (!hasPreviewEditor() || list.querySelector(".edit-mode-link")) return;
    const target = new URL(`http://127.0.0.1:${editorPort}/main.html?edit`);
    const preview = new URL(location.href);
    preview.hash = "";
    target.searchParams.set("preview", preview.href);
    const link = document.createElement("a");
    link.className = "edit-mode-link";
    const keycap = document.createElement("kbd");
    keycap.textContent = "e";
    link.append(keycap, " Edit mode");
    const updateLink = () => {
      target.hash = Reveal.getSlidePath();
      link.href = target.href;
    };
    updateLink();
    Reveal.on("slidechanged", updateLink);
    Reveal.addKeyBinding({ keyCode: 69, key: "E", description: "Edit mode" }, () => link.click());
    const item = document.createElement("li");
    item.className = "slide-tool-item";
    item.dataset.item = list.children.length;
    item.append(link);
    item.onclick = event => { if (event.target === item) link.click(); };
    list.append(item);
    setDisplay("div.slide-menu-button", "");
  }

  const setDisplay = (selector, value) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.style.display = value;
    });
  };

  const currentSlide = (event) => (
    event?.currentSlide
    || window.Reveal?.getCurrentSlide?.()
    || null
  );

  const hasCustomFooter = (slide) => (
    Boolean(slide?.querySelector(".footer:not(.footer-default)"))
  );

  const suppressDefaultFooter = (slide) => {
    if (!slide) return false;
    return slide.id === "title-slide"
      || slide.id === "TOC"
      || slide.dataset.footer === "false"
      || hasCustomFooter(slide);
  };

  const updateChrome = (event) => {
    if (isPrintExport()) return;

    const slide = currentSlide(event);
    const isTitleSlide = slide?.id === "title-slide" || event?.indexh === 0;
    setDisplay("div.slide-menu-button", hasPreviewEditor() ? "" : "none");
    setDisplay("div.footer-default", suppressDefaultFooter(slide) ? "none" : "");
    setDisplay("div.has-logo > img.slide-logo", isTitleSlide ? "none" : "");
  };

  Reveal.addEventListener("ready", updateChrome);
  Reveal.addEventListener("slidechanged", updateChrome);
  document.addEventListener("DOMContentLoaded", addEditTool);
  Reveal.on("ready", addEditTool);
})();
