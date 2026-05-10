(() => {
  const isPrintExport = () => (
    /print-pdf|view=print/i.test(window.location.search)
    || document.documentElement.classList.contains("reveal-print")
  );

  const setDisplay = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.style.display = value;
  };

  const updateChrome = (event) => {
    if (isPrintExport()) return;

    const isTitleSlide = event.indexh === 0;
    setDisplay("div.slide-menu-button", "none");
    setDisplay("div.footer-default", isTitleSlide ? "none" : "");
    setDisplay("div.has-logo > img.slide-logo", isTitleSlide ? "none" : "");
  };

  Reveal.addEventListener("ready", updateChrome);
  Reveal.addEventListener("slidechanged", updateChrome);
})();
