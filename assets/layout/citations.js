// Pandoc supplies both the citation keys and the CSL-formatted bibliography.
window.slideCitations = (() => {
  const refs = document.querySelector("#refs");
  const library = document.querySelector("#layout-bibliography")?.content;
  const catalog = new Map();
  for (const entry of (library || refs)?.querySelectorAll(".csl-entry[id]") || []) {
    catalog.set(entry.id.slice(4), entry);
  }
  const group = /\[@([^\s;\[\]]+(?:\s*;\s*@[^\s;\[\]]+)*)\]/g;
  const original = new Map();
  const renderedNodes = new WeakMap();
  const syntax = span => "[@" + span.dataset.cites.trim().split(/\s+/).join(";@") + "]";
  const nodeSource = node => node.matches?.(".citation[data-cites]") ? syntax(node) : node.textContent;
  const source = el => [...el.childNodes].map(nodeSource).join("");
  for (const span of document.querySelectorAll(".slides .citation[data-cites]")) original.set(syntax(span), span.cloneNode(true));

  function fragments(text, makeCitation) {
    const result = document.createDocumentFragment();
    let last = 0;
    for (const match of text.matchAll(group)) {
      const ids = match[1].split(/\s*;\s*@/);
      if (!ids.every(id => catalog.has(id))) continue;
      if (match.index > last) result.append(text.slice(last, match.index));
      result.append(makeCitation(ids));
      last = match.index + match[0].length;
    }
    if (last < text.length) result.append(text.slice(last));
    return result;
  }

  function render(el, text) {
    el.replaceChildren(fragments(text, ids => {
      const formatted = original.get("[@" + ids.join(";@") + "]");
      if (formatted) return formatted.cloneNode(true);
      const span = document.createElement("span");
      span.className = "citation";
      span.dataset.cites = ids.join(" ");
      span.dataset.layoutCitation = "";
      return span;
    }));
  }

  // Number newly cited works after the manuscript's references, in slide order.
  function sync(showSource) {
    if (!refs) return;
    const extra = new Map();
    const fixedCount = refs.querySelectorAll(":scope > .csl-entry:not([data-layout-reference])").length;
    for (const span of document.querySelectorAll(".slides [data-layout-citation]")) {
      if (span.closest(".layout-deleted")) continue;
      const links = [];
      for (const id of span.dataset.cites.split(" ")) {
        let entry = document.getElementById("ref-" + id);
        if (!entry || entry.hasAttribute("data-layout-reference")) {
          if (!extra.has(id)) {
            entry ||= catalog.get(id).cloneNode(true);
            entry.dataset.layoutReference = "";
            entry.querySelector(".csl-left-margin").textContent = "[" + (fixedCount + extra.size + 1) + "] ";
            extra.set(id, entry);
            refs.append(entry);
          }
          entry = extra.get(id);
        }
        const link = document.createElement("a");
        link.href = "#/" + refs.closest("section").id;
        link.setAttribute("role", "doc-biblioref");
        link.textContent = entry.querySelector(".csl-left-margin").textContent.trim();
        if (links.length) links.push(", ");
        links.push(link);
      }
      span.replaceChildren(...links);
    }
    for (const row of refs.querySelectorAll("[data-layout-reference]")) {
      if (!extra.has(row.id.slice(4))) row.remove();
    }
    for (const span of document.querySelectorAll(".slides .citation[data-cites]")) {
      span.toggleAttribute("data-layout-source", showSource);
      if (showSource) {
        const markdown = syntax(span);
        if (span.firstChild?.nodeValue === markdown) continue;
        // Dynamic references are rebuilt above. Keep Pandoc's exact punctuation and links for authored references.
        if (!span.hasAttribute("data-layout-citation")) renderedNodes.set(span, [...span.childNodes]);
        // Keep the link elements in place so copied objects retain their structural paths.
        for (const node of [...span.childNodes]) if (node.nodeType === Node.TEXT_NODE) node.remove();
        span.prepend(markdown);
      } else if (renderedNodes.has(span)) {
        span.replaceChildren(...renderedNodes.get(span));
        renderedNodes.delete(span);
      }
    }
  }
  return { catalog, nodeSource, source, fragments, render, sync };
})();
