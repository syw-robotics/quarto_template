-- Keep formatted, searchable entries available offline, including works not cited yet.
function Pandoc(doc)
  if not doc.meta.bibliography then return end
  local catalog = pandoc.Pandoc({}, {
    bibliography = doc.meta.bibliography, csl = doc.meta.csl,
    nocite = pandoc.MetaInlines({pandoc.Cite("@*", {pandoc.Citation("*", "NormalCitation")})})
  })
  local entries = pandoc.utils.citeproc(catalog).blocks
  local html = pandoc.write(pandoc.Pandoc(entries), "html5", {wrap_text = "none"})
  doc.blocks:insert(pandoc.RawBlock("html", '<template id="layout-bibliography">' .. html .. '</template>'))
  return doc
end
