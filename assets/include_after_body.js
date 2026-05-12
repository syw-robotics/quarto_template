(() => {
  const isPrintExport = () => (
    /print-pdf|view=print/i.test(window.location.search)
    || document.documentElement.classList.contains("reveal-print")
  );

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
    setDisplay("div.slide-menu-button", "none");
    setDisplay("div.footer-default", suppressDefaultFooter(slide) ? "none" : "");
    setDisplay("div.has-logo > img.slide-logo", isTitleSlide ? "none" : "");
  };

  Reveal.addEventListener("ready", updateChrome);
  Reveal.addEventListener("slidechanged", updateChrome);
})();
