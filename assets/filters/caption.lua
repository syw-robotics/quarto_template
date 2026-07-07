--
-- This file configures customized figure and video caption
--


local function has_class(el, class)
  for _, value in ipairs(el.classes) do
    if value == class then
      return true
    end
  end
  return false
end

local function escape_html(value)
  value = tostring(value or "")
  value = value:gsub("&", "&amp;")
  value = value:gsub("<", "&lt;")
  value = value:gsub(">", "&gt;")
  value = value:gsub('"', "&quot;")
  return value
end

local media_config = {
  figure_style = "text-align: center;",
  media_style = "display: block; margin-left: auto; margin-right: auto;",
  caption_class = "figure-caption"
}

local function caption_html(caption)
  if caption == nil or caption == "" then
    return nil
  end

  return '<figcaption class="' .. media_config.caption_class .. '">' .. escape_html(caption) .. "</figcaption>"
end

local function build_figure(media, caption)
  local html = {
    '<figure style="' .. media_config.figure_style .. '">',
    media
  }

  local caption = caption_html(caption)
  if caption ~= nil then
    table.insert(html, caption)
  end

  table.insert(html, "</figure>")
  return pandoc.RawBlock("html", table.concat(html, "\n"))
end

local function video(el)
  local src = el.attributes.src
  if src == nil or src == "" then
    return nil
  end

  local width = el.attributes.width or "600"
  local caption = el.attributes.caption or ""
  local attrs = {
    'src="' .. escape_html(src) .. '"',
    'width="' .. escape_html(width) .. '"',
    "controls",
    "autoplay",
    "muted",
    "loop",
    "playsinline",
    "data-prevent-swipe",
    'style="' .. media_config.media_style .. '"'
  }

  return build_figure("<video " .. table.concat(attrs, " ") .. "></video>", caption)
end

local function image(el)
  local src = el.attributes.src
  if src == nil or src == "" then
    return nil
  end

  local width = el.attributes.width or "600"
  local alt = el.attributes.alt or ""
  local caption = el.attributes.caption or ""

  local attrs = {
    'src="' .. escape_html(src) .. '"',
    'alt="' .. escape_html(alt) .. '"',
    'width="' .. escape_html(width) .. '"',
    'style="' .. media_config.media_style .. '"'
  }

  return build_figure("<img " .. table.concat(attrs, " ") .. ">", caption)
end

-- A gallery is a Markdown list of captioned links to local images or videos.
local function gallery(el)
  local list = el.content[1]
  if #el.content ~= 1 or not list or list.t ~= "BulletList" then
    error("A .gallery needs a bullet list with one media link per item.")
  end
  local figures = {}
  for _, item in ipairs(list.content) do
    local link = item[1].content[1]
    if #item ~= 1 or #item[1].content ~= 1 or link.t ~= "Link" then
      error("Use - [Caption](path/to/file) for each gallery item.")
    end
    local src = escape_html(link.target)
    local caption = pandoc.utils.stringify(link.content)
    local ext = link.target:lower():match("%.([%w]+)$")
    local videos = {mp4=true, webm=true, mov=true, m4v=true, ogv=true}
    local media
    if videos[ext] then
      media = '<video src="' .. src .. '" aria-label="' .. escape_html(caption)
        .. '" autoplay muted loop playsinline controls data-prevent-swipe></video>'
    else
      media = '<img src="' .. src .. '" alt="' .. escape_html(caption) .. '">'
    end
    table.insert(figures, pandoc.RawBlock("html", "<figure>" .. media .. "<figcaption>"))
    table.insert(figures, pandoc.Plain(link.content))
    table.insert(figures, pandoc.RawBlock("html", "</figcaption></figure>"))
  end
  el.content = figures
  return el
end

-- Each link supplies a video. A Markdown hard break introduces its optional caption.
local function video_pair(el)
  local list = el.content[1]
  if #el.content ~= 1 or not list or list.t ~= "BulletList" then
    error("A .video-pair needs a bullet list of video links.")
  end
  local cards = {}
  for _, item in ipairs(list.content) do
    local inlines = item[1].content
    local link = inlines and inlines[1]
    if #item ~= 1 or not link or link.t ~= "Link" or (#inlines > 1 and inlines[2].t ~= "LineBreak") then
      error("Use - [Title](video) followed by an optional hard break and caption.")
    end
    local state = has_class(link, "bad") and "bad" or has_class(link, "good") and "good"
    local attrs = "autoplay muted loop playsinline controls data-prevent-swipe"
    local poster, fallback = link.attributes.poster, link.attributes.fallback
    if poster then attrs = attrs .. ' poster="' .. escape_html(poster) .. '"' end
    local src = escape_html(link.target)
    local media = fallback and '<video ' .. attrs .. ' preload="metadata"><source src="' .. src
      .. '"><source src="' .. escape_html(fallback) .. '"></video>'
      or '<video ' .. attrs .. ' src="' .. src .. '"></video>'
    local frame = {pandoc.RawBlock("html", media)}
    local caption = pandoc.Inlines({})
    for i = 3, #inlines do caption:insert(inlines[i]) end
    if state or #caption > 0 then
      local label = link.content
      if state then
        label:insert(1, pandoc.Space())
        label:insert(1, pandoc.Str(state == "bad" and "×" or "✓"))
      end
      table.insert(frame, pandoc.Div(pandoc.Plain(label), pandoc.Attr("", {"video-label", state})))
    else
      caption = link.content
    end
    local card = {pandoc.Div(frame, pandoc.Attr("", {"video-frame"}))}
    if #caption > 0 then
      table.insert(card, pandoc.Div(pandoc.Para(caption), pandoc.Attr("", {"video-caption"})))
    end
    table.insert(cards, pandoc.Div(card, pandoc.Attr("", {"video-card"})))
  end
  el.content = cards
  return el
end

-- Inline diagrams retain their selectable SVG labels in the visual editor.
function Image(el)
  if has_class(el, "inline-svg") then
    local mime, svg = pandoc.mediabag.fetch(el.src)
    if mime ~= "image/svg+xml" then error("Expected an SVG diagram: " .. el.src) end
    return pandoc.RawInline("html", svg)
  end
end

function Div(el)
  -- These boxes have saved positions keyed to the text of the div itself.
  if (has_class(el, "card-note") or has_class(el, "section-label"))
      and #el.content == 1 and el.content[1].t == "Para" then
    el.content[1] = pandoc.Plain(el.content[1].content)
    return el
  end
  if has_class(el, "video-pair") then
    return video_pair(el)
  end

  if has_class(el, "gallery") then
    return gallery(el)
  end

  if has_class(el, "video") then
    return video(el)
  end

  if has_class(el, "image") then
    return image(el)
  end

  return nil
end
