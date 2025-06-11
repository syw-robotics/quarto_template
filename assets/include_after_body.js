Reveal.addEventListener('ready', (event) => {
  if (event.indexh === 0) {
    document.querySelector("div.slide-menu-button").style.display = "none";
    document.querySelector("div.footer-default").style.display = "none";
    document.querySelector("div.has-logo > img.slide-logo").style.display = "none";
  } else {
    document.querySelector("div.slide-menu-button").style.display = "block"; // Show menu-button
    // document.querySelector("div.slide-menu-button").style.display = "none";  // Hide menu-button when logo is shown
  }
});
Reveal.addEventListener('slidechanged', (event) => {
  if (event.indexh === 0) {
    document.querySelector("div.slide-menu-button").style.display = "none";
    document.querySelector("div.footer-default").style.display = "none";
    document.querySelector("div.has-logo > img.slide-logo").style.display = "none";
  } else {
    document.querySelector("div.slide-menu-button").style.display = "block"; // Show menu-button
    // document.querySelector("div.slide-menu-button").style.display = "none";  // Hide menu-button when logo is shown
    document.querySelector("div.has-logo > img.slide-logo").style.display = null;
  }
});
