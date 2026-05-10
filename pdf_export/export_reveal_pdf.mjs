import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [browser, url, output] = process.argv.slice(2);

if (!browser || !url || !output) {
  console.error("Usage: node pdf_export/export_reveal_pdf.mjs <browser> <url> <output.pdf>");
  process.exit(1);
}

if (typeof WebSocket === "undefined") {
  console.error("Error: this exporter requires Node.js 22+ or another runtime with built-in WebSocket.");
  process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), "quarto-reveal-pdf-"));
const profileDir = join(tempDir, "profile");
const browserProcess = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  "--allow-file-access-from-files",
  `--user-data-dir=${profileDir}`,
  "--remote-debugging-port=0",
  "about:blank",
], {
  stdio: ["ignore", "ignore", "pipe"],
});

let stderr = "";
let cleaned = false;

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (!browserProcess.killed) browserProcess.kill();
  try {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {
    // Browser shutdown can briefly keep profile files open.
  }
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

function waitForDevtoolsUrl() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for browser DevTools endpoint.\n${stderr}`));
    }, 15000);

    browserProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });

    browserProcess.on("exit", (code) => {
      reject(new Error(`Browser exited before DevTools was ready, code ${code}.\n${stderr}`));
    });
  });
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let id = 0;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject, timeout } = pending.get(message.id);
    clearTimeout(timeout);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(`${message.error.message}: ${message.error.data ?? ""}`));
    } else {
      resolve(message.result ?? {});
    }
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}, sessionId = undefined, timeoutMs = 60000) {
          const requestId = ++id;
          const payload = { id: requestId, method, params };
          if (sessionId) payload.sessionId = sessionId;
          socket.send(JSON.stringify(payload));
          return new Promise((requestResolve, requestReject) => {
            const timeout = setTimeout(() => {
              pending.delete(requestId);
              requestReject(new Error(`Timed out while running ${method}.`));
            }, timeoutMs);
            pending.set(requestId, { resolve: requestResolve, reject: requestReject, timeout });
          });
        },
        close() {
          socket.close();
        },
      });
    });
    socket.addEventListener("error", reject);
  });
}

function printUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  parsed.searchParams.set("print-pdf", "");
  parsed.hash = "";
  return parsed.toString().replace("print-pdf=", "print-pdf");
}

async function readScreenChromeStyles(client, sessionId) {
  const result = await client.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `
      new Promise((resolve) => {
        const started = Date.now();
        const styleOf = (element) => {
          if (!element) return {};
          const style = getComputedStyle(element);
          return {
            backgroundColor: style.backgroundColor,
            bottom: style.bottom,
            color: style.color,
            display: style.display,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            height: style.height,
            left: style.left,
            lineHeight: style.lineHeight,
            maxHeight: style.maxHeight,
            maxWidth: style.maxWidth,
            opacity: style.opacity,
            padding: style.padding,
            position: style.position,
            right: style.right,
            textAlign: style.textAlign,
            top: style.top,
            width: style.width,
            zIndex: style.zIndex,
          };
        };
        const slideNumberHtmlFor = (slide) => {
          if (!slide || slide.id === "title-slide") return "";
          const config = window.Reveal?.getConfig?.() || {};
          const format = typeof config.slideNumber === "string" ? config.slideNumber : "c/t";
          const counted = slide.dataset.visibility === "uncounted" ? 0 : 1;
          const current = (window.Reveal?.getSlidePastCount?.(slide) || 0) + counted;
          const total = window.Reveal?.getTotalSlides?.() || 0;
          if (format === "c") {
            return \`<span class="slide-number-a">\${current}</span>\`;
          }
          if (format === "c/t") {
            return \`<span class="slide-number-a">\${current}</span><span class="slide-number-delimiter">/</span><span class="slide-number-b">\${total}</span>\`;
          }
          const indices = window.Reveal?.getIndices?.(slide) || { h: 0, v: 0 };
          const delimiter = format === "h/v" ? "/" : ".";
          const h = (indices.h || 0) + counted;
          const v = typeof indices.v === "number" ? indices.v + 1 : undefined;
          return typeof v === "number"
            ? \`<span class="slide-number-a">\${h}</span><span class="slide-number-delimiter">\${delimiter}</span><span class="slide-number-b">\${v}</span>\`
            : \`<span class="slide-number-a">\${h}</span>\`;
        };
        const read = () => {
          try {
            const target = [...Reveal.getSlides()]
              .find((slide) => slide.id !== "title-slide" && slide.id !== "TOC" && slide.dataset.footer !== "false");
            if (target) {
              const indices = Reveal.getIndices(target);
              Reveal.slide(indices.h, indices.v || 0);
            }
          } catch (_) {}
          setTimeout(() => {
            const slideNumbers = {};
            try {
              [...Reveal.getSlides()].forEach((slide) => {
                if (slide.id) slideNumbers[slide.id] = slideNumberHtmlFor(slide);
              });
            } catch (_) {}
            resolve({
              footer: styleOf(document.querySelector(".reveal > .footer.footer-default, .footer.footer-default")),
              logo: styleOf(document.querySelector(".reveal .slide-logo, .slide-logo")),
              slideNumber: styleOf(document.querySelector(".reveal .slide-number")),
              slideNumbers,
            });
          }, 300);
        };
        const check = () => {
          if (window.Reveal?.isReady?.() === true) {
            read();
            return;
          }
          if (Date.now() - started > 30000) {
            read();
            return;
          }
          setTimeout(check, 100);
        };
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", check, { once: true });
        } else {
          check();
        }
      })
    `,
  }, sessionId, 45000);

  return result.result.value ?? {};
}

async function waitForPrintReady(client, sessionId, screenStyles) {
  const result = await client.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `
      new Promise((resolve) => {
        const started = Date.now();
        let lastSignature = "";
        let stableSince = 0;
        const finish = async () => {
          try {
            if (window.mermaid?.run) {
              await window.mermaid.run({ querySelector: ".reveal .slides section pre.mermaid" });
            }
          } catch (_) {}

          try {
            if (window.MathJax?.typesetPromise) {
              await window.MathJax.typesetPromise();
            } else if (window.MathJax?.Hub) {
              await new Promise((done) => {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                MathJax.Hub.Queue(done);
              });
            }
          } catch (_) {}

          if (document.fonts?.ready) {
            await Promise.race([
              document.fonts.ready,
              new Promise((done) => setTimeout(done, 8000))
            ]);
          }

          document.querySelectorAll('a[href^="#/"]').forEach((link) => {
            link.setAttribute("href", "#" + link.getAttribute("href").slice(2));
          });

          const firstPage = document.querySelector(".pdf-page");
          const pageWidth = Math.ceil(firstPage?.getBoundingClientRect().width || window.Reveal?.getConfig?.().width || 1600);
          const pageHeight = Math.ceil(firstPage?.getBoundingClientRect().height || window.Reveal?.getConfig?.().height || 900);
          const defaultFooter = document.querySelector(".footer-default");
          const defaultFooterHtml = defaultFooter?.innerHTML?.trim();
          const logo = document.querySelector(".reveal .slide-logo, .slide-logo");
          const logoHtml = logo?.outerHTML?.trim();
          const screenStyles = ${JSON.stringify(screenStyles)};
          const footerStyle = screenStyles.footer || {};
          const logoStyle = screenStyles.logo || {};
          const slideNumberStyle = screenStyles.slideNumber || {};
          const css = (style, key, fallback) => style[key] || fallback;

          const style = document.createElement("style");
          style.textContent = \`
            html.reveal-print .footer-default {
              display: none !important;
            }
            html.reveal-print .reveal .slide-logo {
              display: none !important;
            }
            html.reveal-print .reveal .slides .pdf-page {
              width: \${pageWidth}px !important;
              height: \${pageHeight}px !important;
              max-height: \${pageHeight}px !important;
              overflow: hidden !important;
              contain: paint !important;
              break-after: page !important;
              page-break-after: always !important;
            }
            html.reveal-print .reveal .slides .pdf-page:last-of-type {
              break-after: avoid !important;
              page-break-after: avoid !important;
            }
            html.reveal-print .reveal .slides .pdf-page > section,
            html.reveal-print .reveal .slides .pdf-page section.scrollable {
              max-height: \${pageHeight}px !important;
              overflow: hidden !important;
            }
            html.reveal-print .reveal .slides .pdf-page .pdf-export-footer {
              display: block !important;
              position: absolute !important;
              bottom: 18px !important;
              left: 0 !important;
              right: 0 !important;
              width: 100% !important;
              margin: 0 auto !important;
              color: \${css(footerStyle, "color", "inherit")} !important;
              font-family: \${css(footerStyle, "fontFamily", "inherit")} !important;
              font-size: \${css(footerStyle, "fontSize", "0.5em")} !important;
              font-weight: \${css(footerStyle, "fontWeight", "inherit")} !important;
              line-height: \${css(footerStyle, "lineHeight", "1.2")} !important;
              text-align: \${css(footerStyle, "textAlign", "center")} !important;
              z-index: 20 !important;
              pointer-events: none !important;
            }
            html.reveal-print .reveal .slides .pdf-page .pdf-export-footer > * {
              margin-top: 0 !important;
              margin-bottom: 0 !important;
            }
            html.reveal-print .reveal .slides .pdf-page .pdf-export-logo {
              display: block !important;
              position: absolute !important;
              top: auto !important;
              bottom: \${css(logoStyle, "bottom", "0px")} !important;
              left: \${css(logoStyle, "left", "50px")} !important;
              right: auto !important;
              opacity: \${css(logoStyle, "opacity", "1")} !important;
              z-index: 20 !important;
              pointer-events: none !important;
            }
            html.reveal-print .reveal .slides .pdf-page .slide-number-pdf {
              display: none !important;
            }
            html.reveal-print .reveal .slides .pdf-page .pdf-export-slide-number {
              display: block !important;
              position: absolute !important;
              top: auto !important;
              bottom: \${css(slideNumberStyle, "bottom", "7px")} !important;
              left: auto !important;
              right: \${css(slideNumberStyle, "right", "50px")} !important;
              color: \${css(slideNumberStyle, "color", "inherit")} !important;
              background-color: \${css(slideNumberStyle, "backgroundColor", "transparent")} !important;
              font-family: \${css(slideNumberStyle, "fontFamily", "inherit")} !important;
              font-size: \${css(slideNumberStyle, "fontSize", "0.5em")} !important;
              font-weight: \${css(slideNumberStyle, "fontWeight", "inherit")} !important;
              line-height: \${css(slideNumberStyle, "lineHeight", "1")} !important;
              padding: \${css(slideNumberStyle, "padding", "0")} !important;
              z-index: 20 !important;
            }
            html.reveal-print .reveal .slides .pdf-page .pdf-export-slide-number,
            html.reveal-print .reveal .slides .pdf-page .pdf-export-slide-number * {
              color: \${css(slideNumberStyle, "color", "inherit")} !important;
            }
            html.reveal-print .reveal .slides .pdf-page:has(#title-slide) .pdf-export-slide-number {
              display: none !important;
            }
          \`;
          document.head.appendChild(style);
          document.querySelectorAll(".footer-default").forEach((footer) => {
            footer.style.display = "none";
          });
          document.querySelectorAll(".slide-logo").forEach((logo) => {
            logo.style.display = "none";
          });
          const slideNumbersById = screenStyles.slideNumbers || {};

          const setActiveTab = (page, tabIndex) => {
            page.querySelectorAll(".panel-tabset").forEach((tabset) => {
              const tabs = [...tabset.querySelectorAll(".panel-tabset-tabby a")];
              const panelIds = tabs.map((tab) => {
                const controls = tab.getAttribute("aria-controls");
                if (controls) return controls;
                const href = tab.getAttribute("href") || "";
                return href.startsWith("#") ? href.slice(1) : "";
              });

              tabs.forEach((tab, index) => {
                const active = index === tabIndex;
                tab.setAttribute("aria-selected", active ? "true" : "false");
                tab.setAttribute("tabindex", active ? "0" : "-1");
              });

              panelIds.forEach((id, index) => {
                const panel = id ? tabset.querySelector(\`#\${CSS.escape(id)}\`) : null;
                if (!panel) return;
                if (index === tabIndex) {
                  panel.removeAttribute("hidden");
                  panel.style.display = "";
                } else {
                  panel.setAttribute("hidden", "hidden");
                  panel.style.display = "";
                }
              });
            });
          };

          const expandTabsetsForPrint = () => {
            const pages = [...document.querySelectorAll(".pdf-page")];
            pages.forEach((page) => {
              const firstTabset = page.querySelector(".panel-tabset");
              if (!firstTabset) return;

              const tabCount = firstTabset.querySelectorAll(".panel-tabset-tabby a").length;
              if (tabCount < 2) return;

              setActiveTab(page, 0);
              let insertAfter = page;
              for (let index = 1; index < tabCount; index += 1) {
                const clone = page.cloneNode(true);
                setActiveTab(clone, index);
                insertAfter.after(clone);
                insertAfter = clone;
              }
            });
          };

          expandTabsetsForPrint();

          document.querySelectorAll(".pdf-page").forEach((page) => {
            page.querySelectorAll(".footer-default").forEach((footer) => {
              footer.style.display = "none";
            });

            const slide = [...page.querySelectorAll("section")]
              .find((section) => !section.classList.contains("stack"));
            const customFooter = page.querySelector(".footer:not(.footer-default)");
            if (slide?.id === "title-slide") {
              page.querySelectorAll(".slide-number-pdf").forEach((slideNumber) => {
                slideNumber.style.display = "none";
              });
            }

            if (logoHtml && slide?.id !== "title-slide") {
              const holder = document.createElement("div");
              holder.innerHTML = logoHtml;
              const pageLogo = holder.firstElementChild;
              if (pageLogo) {
                pageLogo.classList.add("pdf-export-logo");
                pageLogo.removeAttribute("style");
                page.appendChild(pageLogo);
              }
            }

            const slideNumberHtml = slide?.id ? slideNumbersById[slide.id] : "";
            if (slideNumberHtml) {
              const slideNumber = document.createElement("div");
              slideNumber.className = "pdf-export-slide-number";
              slideNumber.innerHTML = slideNumberHtml;
              page.appendChild(slideNumber);
            }

            const suppressDefaultFooter = !slide
              || slide.id === "title-slide"
              || slide.id === "TOC"
              || slide.dataset.footer === "false"
              || customFooter;

            if (customFooter) {
              const footer = customFooter.cloneNode(true);
              footer.classList.add("pdf-export-footer");
              page.appendChild(footer);
            } else if (defaultFooterHtml && !suppressDefaultFooter) {
              const footer = document.createElement("div");
              footer.className = "pdf-export-footer";
              footer.innerHTML = defaultFooterHtml;
              page.appendChild(footer);
            }
          });

          resolve({
            width: pageWidth,
            height: pageHeight,
            pages: document.querySelectorAll(".pdf-page").length || window.Reveal?.getTotalSlides?.() || 0,
          });
        };
        const check = () => {
          const revealReady = window.Reveal?.isReady?.() === true;
          const pages = [...document.querySelectorAll(".pdf-page")];
          const firstPage = pages[0];
          const firstPageRect = firstPage?.getBoundingClientRect();
          const textLength = document.body.innerText.trim().length;
          const printReady = document.documentElement.classList.contains("reveal-print")
            && pages.length > 0
            && firstPage?.querySelector("section")
            && textLength > 0;
          const signature = printReady
            ? [
                pages.length,
                Math.round(firstPageRect.width),
                Math.round(firstPageRect.height),
                textLength
              ].join(":")
            : "";

          if (printReady && signature === lastSignature && Date.now() - stableSince > 1000) {
            setTimeout(finish, 500);
            return;
          }
          if (signature !== lastSignature) {
            lastSignature = signature;
            stableSince = Date.now();
          }
          if (Date.now() - started > 30000) {
            finish();
            return;
          }
          setTimeout(check, 100);
        };
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", check, { once: true });
        } else {
          check();
        }
      })
    `,
  }, sessionId, 45000);

  return result.result.value;
}

async function main() {
  const browserWsUrl = await waitForDevtoolsUrl();
  const client = await createCdpClient(browserWsUrl);

  const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });

  await client.send("Page.enable", {}, sessionId);
  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Emulation.setEmulatedMedia", { media: "screen" }, sessionId);

  await client.send("Page.navigate", { url }, sessionId);
  const screenStyles = await readScreenChromeStyles(client, sessionId);

  await client.send("Page.navigate", { url: printUrl(url) }, sessionId);

  const { width, height, pages } = await waitForPrintReady(client, sessionId, screenStyles);
  console.log(`Printing ${pages} pages at ${width}x${height}`);

  const pdf = await client.send("Page.printToPDF", {
    displayHeaderFooter: false,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    paperHeight: height / 96,
    paperWidth: width / 96,
    printBackground: true,
    preferCSSPageSize: false,
    scale: 1,
  }, sessionId);

  writeFileSync(output, Buffer.from(pdf.data, "base64"));
  client.close();
}

main().then(() => {
  cleanup();
  console.log(`Output created: ${output}`);
}).catch((error) => {
  cleanup();
  console.error(error.message);
  process.exitCode = 1;
});
