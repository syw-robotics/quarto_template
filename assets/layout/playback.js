// Capture identities before Reveal loads lazy media or typesets equations.
(() => {
  const print = /print-pdf|view=print/.test(location.search);
  const editing = new URLSearchParams(location.search).has("edit") && !print;
  if (editing) Reveal.configure({ scrollActivationWidth: 0 });
  const cover = document.getElementById("title-slide");
  const coverImage = document.querySelector('meta[name="slide-cover"]');
  if (cover && coverImage?.content) {
    const photo = document.createElement("img");
    photo.className = "cover-field";
    photo.src = coverImage.content;
    photo.alt = coverImage.dataset.alt || "";
    cover.append(photo);
  }
  const edits = window.slideEdits;
  const citations = window.slideCitations;
  const config = Reveal.getConfig();
  const sharedNumbers = !print && config.slideNumber === "c/t" && config.showSlideNumber === "all";
  const slides = [...document.querySelectorAll(".slides section.slide[id], #title-slide")];
  const logo = document.querySelector("img.slide-logo");
  const originalLogo = logo?.getAttribute("src");
  const settingsKey = '["settings"]';
  const previous = editing && structuredClone(edits);
  const footerIds = new Map();
  const footerPages = slides.filter(slide => slide !== cover);
  function footerStyle(edit = {}) {
    const { group, text, runs, ...style } = edit;
    return style;
  }
  function withFooterStyle(edit = {}, style) {
    const result = { ...style };
    for (const prop of ["group", "text", "runs"]) if (Object.hasOwn(edit, prop)) result[prop] = edit[prop];
    return result;
  }
  function putEdit(target, key, value) {
    if (Object.keys(value).length) target[key] = value;
    else delete target[key];
  }
  // Keep slide-specific identities for selection and undo. Store shared formatting once on disk.
  for (const type of ["logo", "number"]) {
    const shared = JSON.stringify(["footer", type]);
    const ids = footerPages.map(slide => JSON.stringify([slide.id, "footer", type]));
    footerIds.set(shared, ids);
    if (edits[settingsKey]?.footerSync === false) continue;
    const style = edits[shared] ?? ids.map(id => footerStyle(edits[id])).find(value => Object.keys(value).length) ?? {};
    for (const id of ids) putEdit(edits, id, withFooterStyle(edits[id], style));
    delete edits[shared];
  }
  function serializeEdits() {
    const result = { ...edits };
    if (edits[settingsKey]?.footerSync !== false) {
      for (const [shared, ids] of footerIds) {
        putEdit(result, shared, footerStyle(edits[ids[0]]));
        for (const id of ids) putEdit(result, id, withFooterStyle(edits[id], {}));
      }
    }
    return result;
  }
  function appendLogo(slide) {
    const el = document.createElement("img");
    el.className = "layout-footer-logo";
    el.src = originalLogo;
    el.alt = "页脚校徽";
    slide.append(el);
    return el;
  }
  function appendNumber(slide) {
    const number = document.createElement("a");
    number.className = "layout-footer-number";
    number.href = "#/" + slide.id;
    number.setAttribute("aria-label", "页码");
    const current = Reveal.getSlidePastCount(slide) + (slide.dataset.visibility === "uncounted" ? 0 : 1);
    number.textContent = current + " / " + Reveal.getTotalSlides();
    slide.append(number);
    return number;
  }
  if (!editing && !Object.keys(edits).length) {
    for (const slide of slides) {
      if (slide === cover) continue;
      if (logo && !print) appendLogo(slide);
      if (sharedNumbers) appendNumber(slide);
    }
    return;
  }
  if (editing) {
    for (const video of document.querySelectorAll(".slides video")) {
      video.autoplay = false;
      video.removeAttribute("data-autoplay");
      video.preload = "metadata";
      video.pause();
    }
  }

  const objects = new Map();
  const keys = new WeakMap();
  const originals = new WeakMap();
  const templates = new Map();
  const templateKeys = new WeakMap();
  const videoFrames = ".gallery figure,.video-frame,.teleop-video,.algo-hindsight-video";
  const frameFor = el => el.matches("video") && el.parentElement?.matches(videoFrames) ? el.parentElement : el;
  function register(key, el, frame) {
    keys.set(el, key);
    objects.set(key, el);
    const citedText = el.childElementCount > 0 && [...el.children].every(n => n.matches(".citation[data-cites]"));
    originals.set(el, {
      citationNodes: citedText ? [...el.childNodes] : null,
      width: frame.style.width, height: frame.style.height, rotate: frame.style.rotate,
      radius: el.style.borderRadius, clip: el.style.clipPath, family: el.style.fontFamily,
      sizePriority: el.style.getPropertyPriority("font-size"), fontSize: el.style.fontSize, fontWeight: el.style.fontWeight, textAlign: el.style.textAlign,
      fontStyle: el.style.fontStyle, lines: el.style.textDecorationLine,
      position: frame.style.position, left: frame.style.left, top: frame.style.top,
      frame, display: frame.style.display, translate: frame.style.translate, scale: frame.style.scale,
      text: citedText ? citations.source(el) : !el.matches("img,video") && !el.childElementCount && (el.textContent.trim() || el.matches(".layout-textbox")) ? el.textContent : null,
      runs: [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.data.trim())
        .map(node => ({ node, value: node.data }))
    });
  }

  function insert(key, spec) {
    const slide = document.getElementById(JSON.parse(key)[0]);
    if (!slide?.matches(".slides section")) return;
    const frame = document.createElement("div");
    frame.className = "layout-added";
    Object.assign(frame.style, { left: spec.left + "px", top: spec.top + "px", width: spec.width == null ? "fit-content" : spec.width + "px" });
    let el = frame;
    if (spec.kind === "element") {
      const template = templates.get(spec.source);
      if (!template) return;
      el = template.cloneNode(true);
      frame.classList.add(...slideClasses(spec.source));
      frame.style.height = spec.height + "px";
      let host = frame;
      if (spec.viewBox) {
        host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        host.setAttribute("viewBox", spec.viewBox);
        host.style.cssText = "display:block;width:100%;height:100%;overflow:visible";
        frame.append(host);
      }
      host.append(el);
      const nodes = [el, ...el.querySelectorAll("*")];
      const sources = [template, ...template.querySelectorAll("*")];
      // SVG marker references and fragment links must keep pointing into this copy.
      const ids = new Map(nodes.filter(n => n.id).map(n => [n.id, "copy-" + crypto.randomUUID()]));
      nodes.forEach((n, i) => {
        if (n.id) n.id = ids.get(n.id);
        for (const attr of [...n.attributes]) {
          const value = attr.value.replace(/url\(#([^)]+)\)/g, (all, id) => ids.has(id) ? "url(#" + ids.get(id) + ")" : all);
          if (value !== attr.value) n.setAttribute(attr.name, value);
          if (attr.name === "href" && ids.has(value.slice(1)) && value.startsWith("#")) n.setAttribute("href", "#" + ids.get(value.slice(1)));
        }
        if (n.dataset?.src && n.matches("img,video")) n.setAttribute("src", n.dataset.src);
        const sourceKey = templateKeys.get(sources[i]);
        if (!sourceKey) return;
        const id = i ? JSON.stringify([...JSON.parse(key), i]) : key;
        const target = frameFor(n);
        register(id, n, i ? target : frame);
        const base = originals.get(n);
        base.source = sourceKey;
        base.initial = spec.parts?.[i];
        if (base.initial) apply(id, i ? {} : { add: spec });
        if (i && edits[id]) apply(id, edits[id]);
      });
      slide.append(frame);
      if (slide === cover) updateCoverLogos(frame);
      return el;
    } else if (spec.kind === "background") {
      frame.classList.add("layout-background");
      frame.style.cssText += ";" + spec.decoration;
      frame.style.height = spec.height + "px";
      frame.style.zIndex = "-1";
    } else if (spec.kind === "text") {
      frame.classList.add("layout-textbox");
      frame.textContent = spec.content;
      if (spec.height) frame.style.height = spec.height + "px";
      Object.assign(frame.style, { alignContent: "start", color: spec.color, fontSize: spec.size + "px",
        fontStyle: spec.italic == null ? "" : spec.italic ? "italic" : "normal", textDecorationLine: spec.lines ?? "",
        fontWeight: spec.weight, lineHeight: String(spec.leading), textAlign: spec.align });
    } else {
      el = document.createElement(spec.kind === "video" ? "video" : "img");
      frame.style.height = spec.height + "px";
      el.style.objectFit = spec.fit;
      if (spec.border) Object.assign(frame.style, { border: spec.border, borderRadius: spec.borderRadius, overflow: "hidden" });
      el.src = spec.src;
      if (spec.kind === "video") {
        el.controls = el.muted = el.defaultMuted = el.loop = el.playsInline = true;
        if (editing) el.preload = "metadata";
        else el.setAttribute("data-autoplay", "");
        el.setAttribute("aria-label", spec.label || "");
      } else el.alt = spec.label || "";
      frame.append(el);
      for (const [label, cls] of [[spec.caption, spec.bottom ? "bottom" : "tag"], [spec.status, "status"]]) {
        if (!label) continue;
        const span = document.createElement("span");
        span.className = "layout-media-" + cls;
        span.textContent = label;
        frame.append(span);
        const childKey = JSON.stringify([...JSON.parse(key), cls]);
        register(childKey, span, span);
        if (edits[childKey]) apply(childKey, edits[childKey]);
      }
    }
    slide.append(frame);
    if (slide === cover) updateCoverLogos(frame);
    register(key, el, frame);
    return el;
  }

  const candidates = "img, video, h1, h2, h3, h4, h5, p, li, dt, dd, div, span, strong, b, em, a, th, td, figcaption";
  function slideClasses(source) {
    return [...document.getElementById(JSON.parse(source)[0]).classList].filter(c => !["slide","present","past","future"].includes(c));
  }
  const needsTemplates = editing || Object.values(edits).some(edit => edit.add?.kind === "element");
  const inertDocument = needsTemplates && document.createElement("template").content.ownerDocument;
  // A previously repositioned cover logo can be stored as a pasted image or inside a copied author block.
  function updateCoverLogos(root) {
    for (const img of root.querySelectorAll("img")) {
      if (!originalLogo || (img.dataset.layoutLogo || img.getAttribute("src")) !== originalLogo) continue;
      img.dataset.layoutLogo = originalLogo;
      img.setAttribute("src", edits[settingsKey]?.logo || originalLogo);
    }
  }
  for (const slide of slides) {
    slide.querySelectorAll(".agenda ol > li,.steps ol > li").forEach(li => {
      const marker = document.createElement("span");
      marker.className = "layout-list-marker";
      marker.textContent = String([...li.parentElement.children].indexOf(li) + 1).padStart(2, "0");
      li.prepend(marker);
    });
    const counts = new Map();
    for (const el of slide.querySelectorAll(candidates)) {
      if (el.matches(".layout-list-marker") || el.closest(".notes, .citation, .math, svg, [aria-hidden=true]:not(section)")) continue;
      const media = el.matches("img,video");
      const source = media
        ? el.dataset.src || el.getAttribute("src") || el.querySelector("source")?.getAttribute("src")
        : Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent.trim()).join(" ").trim();
      if (!source) continue;
      const identity = JSON.stringify([el.tagName, source]);
      const occurrence = counts.get(identity) || 0;
      counts.set(identity, occurrence + 1);
      const key = JSON.stringify([slide.id, el.tagName, source, occurrence]);
      if (!needsTemplates && !Object.hasOwn(edits, key)) continue;
      const frame = frameFor(el);
      register(key, el, frame);
    }
    // Keep legacy content keys intact. Structural paths also identify objects without direct text.
    for (const el of slide.querySelectorAll("*")) {
      if (keys.has(el) || el.closest(".citation,.notes,defs,annotation,script,style,[hidden]:not(section)") ||
          el.matches("br,source,col,colgroup,semantics,mrow,msub,msup,msubsup,munder,mspace")) continue;
      const path = [];
      for (let n = el; n !== slide; n = n.parentElement)
        path.unshift(Array.prototype.indexOf.call(n.parentElement.children, n));
      const key = JSON.stringify([slide.id, "node", ...path]);
      if (el.matches(videoFrames) && el.querySelector(":scope > video") && !Object.hasOwn(edits, key)) continue;
      if (needsTemplates || Object.hasOwn(edits, key)) register(key, el, el);
    }
    if (slide.id !== "title-slide") {
      const logoKey = JSON.stringify([slide.id, "footer", "logo"]);
      if (logo && (!print || Object.hasOwn(edits, logoKey))) {
        const el = appendLogo(slide);
        register(logoKey, el, el);
      }
      const numberKey = JSON.stringify([slide.id, "footer", "number"]);
      if (sharedNumbers || Object.hasOwn(edits, numberKey)) {
        const el = appendNumber(slide);
        register(numberKey, el, el);
      }
    }
    if (needsTemplates) {
      const nodes = slide.querySelectorAll("*"), copies = inertDocument.importNode(slide, true).querySelectorAll("*");
      nodes.forEach((node, i) => {
        if (keys.has(node)) {
          templates.set(keys.get(node), copies[i]);
          templateKeys.set(copies[i], keys.get(node));
        }
      });
    }
  }

  // A single reserved key participates in the same save and undo operations as an object edit.
  const fonts = {
    en: ["Montserrat", "Gelasio", "Latin Modern Sans", "Newsreader", "Nunito", "PT Serif"],
    zh: ["Noto Sans CJK SC", "LXGW WenKai", "Source Han Sans SC"]
  };
  const deckStyle = document.createElement("style");
  document.head.append(deckStyle);
  const themeFonts = getComputedStyle(document.documentElement).getPropertyValue("--r-main-font").trim().split(",");
  function applySettings(settings) {
    const rules = [];
    function stack(en, zh) {
      for (const font of [en, zh].filter(Boolean)) {
        const dir = font === "Latin Modern Sans" ? "latinmodern-sans" : font.toLowerCase().replaceAll(" ", "-");
        const url = `assets/fonts/${dir}/${dir}.css`;
        if (!document.querySelector(`link[href="${url}"]`)) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = url;
          document.head.append(link);
        }
      }
      return [en && CSS.escape(en) || themeFonts[0], zh && CSS.escape(zh) || themeFonts[1], ...themeFonts.slice(2)].filter(Boolean).join(", ");
    }
    if (settings.en || settings.zh) {
      const family = stack(settings.en, settings.zh);
      rules.push(`.reveal { --r-main-font: ${family}; --r-heading-font: ${family}; }`);
    }
    for (let level = 1; level <= 6; level++) {
      const tag = "h" + level;
      const en = settings[tag + "En"], zh = settings[tag + "Zh"], size = settings[tag + "Size"];
      const selector = `.reveal .slides section:is(#title-slide, [id]) ${tag}`;
      if (en || zh) rules.push(`${selector} { font-family: ${stack(en || settings.en, zh || settings.zh)}; }`);
      if (size) rules.push(`${selector} { font-size: ${size}px; }`);
      for (const [key, property] of [["Weight", "font-weight"], ["Style", "font-style"], ["Lines", "text-decoration-line"]]) {
        const value = settings[tag + key];
        if (value) rules.push(`${selector} { ${property}: ${value}; }`);
      }
    }
    deckStyle.textContent = rules.join("\n");
    if (cover) updateCoverLogos(cover);
    for (const img of document.querySelectorAll(".slide-logo, .layout-footer-logo")) {
      img.src = (edits[keys.get(img)]?.logoSrc ?? settings.logo) || originalLogo;
    }
  }

  function apply(key, edit = {}) {
    if (key === settingsKey) return applySettings(edit);
    let el = objects.get(key);
    if (!el && edit.add) el = insert(key, edit.add);
    if (!el) return;
    const base = originals.get(el);
    if (!edit.add && base.frame.classList.contains("layout-added")) {
      for (const child of base.frame.querySelectorAll("*")) {
        if (child === el || !keys.has(child)) continue;
        objects.delete(keys.get(child));
        keys.delete(child);
      }
      base.frame.remove();
      objects.delete(key);
      keys.delete(el);
      return;
    }
    // Restore the underlying inline declarations before replaying the next edit or undo.
    if (base.beforeBoxStyle !== undefined) {
      el.style.cssText = base.beforeBoxStyle;
      delete base.beforeBoxStyle;
    }
    if (base.initial) edit = { ...base.initial, ...edit };
    base.frame.classList.toggle("layout-deleted", Boolean(edit.deleted));
    if (edit.deleted && el.matches("video")) el.pause();
    el.style.setProperty("font-size", edit.size == null ? base.fontSize : edit.size + "px", edit.size == null ? base.sizePriority : "important");
    el.style.fontFamily = edit.family ?? base.family;
    if (el.matches("img")) {
      if (el.classList.contains("layout-footer-logo")) {
        const src = (edit.logoSrc ?? edits[settingsKey]?.logo) || originalLogo;
        if (el.getAttribute("src") !== src) el.src = src;
      }
      base.frame.style.rotate = edit.angle == null ? base.rotate : edit.angle + "deg";
      el.style.borderRadius = edit.radius == null ? base.radius : edit.radius + "px";
      if (edit.crop || edit.radius != null) {
        const inset = edit.crop ? edit.crop.map(n => n + "%").join(" ") : "0px";
        const radius = edit.radius == null ? getComputedStyle(el).borderTopLeftRadius : edit.radius + "px";
        el.style.clipPath = `inset(${inset} round ${radius})`;
      } else el.style.clipPath = base.clip;
    }
    if (el instanceof HTMLElement && !el.matches("img,video")) {
      base.frame.style.width = edit.boxWidth == null ? base.width : edit.boxWidth + "px";
      base.frame.style.height = edit.boxHeight == null ? base.height : edit.boxHeight + "px";
    }
    el.style.fontWeight = edit.weight ?? base.fontWeight;
    el.style.fontStyle = edit.italic == null ? base.fontStyle : edit.italic ? "italic" : "normal";
    el.style.textDecorationLine = edit.lines ?? base.lines;
    el.style.textAlign = edit.align ?? base.textAlign;
    const moved = Boolean(edit.x || edit.y);
    const frame = base.frame;
    frame.classList.toggle("layout-moved", moved);
    frame.style.display = base.display;
    if ((edit.zoom != null || edit.boxWidth != null || edit.boxHeight != null) && frame instanceof HTMLElement && getComputedStyle(frame).display === "inline")
      frame.style.display = "inline-block";
    frame.style.position = base.position;
    frame.style.left = base.left;
    frame.style.top = base.top;
    frame.style.translate = base.translate;
    if (frame instanceof HTMLElement && getComputedStyle(frame).display === "inline" && !["absolute", "fixed"].includes(getComputedStyle(frame).position)) {
      // Relative positioning also moves inline text split across several lines.
      frame.style.position = moved ? "relative" : base.position;
      frame.style.left = moved ? (edit.x || 0) + "px" : base.left;
      frame.style.top = moved ? (edit.y || 0) + "px" : base.top;
    } else {
      frame.style.translate = moved ? (edit.x || 0) + "px " + (edit.y || 0) + "px" : base.translate;
    }
    base.frame.style.scale = edit.zoom == null ? base.scale : String(edit.zoom / 100);
    if (edit.boxStyle) {
      base.beforeBoxStyle = el.style.cssText;
      const style = document.createElement("span").style;
      style.cssText = edit.boxStyle;
      for (const prop of style) {
        // A later resize takes precedence over a previously authored CSS dimension.
        if (el === frame && (prop === "width" && edit.boxWidth != null || prop === "height" && edit.boxHeight != null)) continue;
        el.style.setProperty(prop, style.getPropertyValue(prop), style.getPropertyPriority(prop));
      }
    }
    if (base.text !== null) {
      let text = edit.text ?? base.text;
      if (base.citationNodes && edit.text == null && edit.runs) {
        let index = 0;
        text = base.citationNodes.map(n => n.nodeType === Node.TEXT_NODE
          ? (n.data.trim() ? edit.runs[index++] ?? n.data : n.data)
          : citations.nodeSource(n)).join("");
      }
      if (citations.source(el) !== text || (!el.childElementCount && text.includes("[@"))) citations.render(el, text);
    }
    if (base.text === null) base.runs.forEach(({ node, value }, i) => {
      const text = edit.runs?.[i] ?? value;
      const run = base.runs[i];
      if (el instanceof HTMLElement && text.includes("[@")) {
        if (!run.field) {
          run.field = document.createElement("span");
          node.replaceWith(run.field);
        }
        if (citations.source(run.field) !== text) citations.render(run.field, text);
      } else {
        run.field?.replaceWith(node);
        delete run.field;
        node.data = text;
      }
    });
  }
  const entries = Object.entries(edits);
  for (const [key, edit] of entries) if (edit.add) apply(key, edit);
  for (const [key, edit] of entries) if (!edit.add) apply(key, edit);
  function syncCitations() {
    citations.sync(editing && edits[settingsKey]?.citationPreview !== "rendered");
  }
  syncCitations();
  if (editing) {
    window.slideLayout = { objects, keys, originals, apply, settingsKey, fonts, originalLogo, themeFonts, deckStyle, syncCitations,
      previous, footerIds, footerStyle, withFooterStyle, putEdit, serializeEdits };
    const script = document.createElement("script");
    script.src = "assets/layout/editor.js";
    document.body.append(script);
  }
})();
