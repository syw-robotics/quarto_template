(() => {
  const { objects, keys, originals, apply, settingsKey, fonts, originalLogo, themeFonts, deckStyle, syncCitations,
    footerIds, footerStyle, withFooterStyle, putEdit, serializeEdits } = window.slideLayout;
  const edits = window.slideEdits;
  let saved = structuredClone(edits);
  let savedFile = window.slideLayout.previous;
  let selected = null;
  let members = [];
  let clipboard = null;
  let pasteCount = 0;
  let typing = null;
  let drag = null;
  let marquee = null;
  let saving = false;
  let pendingImports = 0;
  let numberInFlight, cssBatch;
  const history = [];
  const future = [];
  let resize = null;
  let cropping = false;
  const cropOverlay = document.createElement("div");
  cropOverlay.className = "layout-crop-overlay";
  cropOverlay.hidden = true;
  const cropBox = document.createElement("div");
  cropBox.className = "layout-crop-box";
  for (const edge of ["n", "s", "w", "e", "nw", "ne", "sw", "se"]) {
    const grip = document.createElement("span");
    grip.dataset.cropEdge = edge;
    cropBox.append(grip);
  }
  cropOverlay.append(cropBox);
  document.body.append(cropOverlay);
  const handles = ["nw", "ne", "sw", "se"].map(corner => {
    const handle = document.createElement("span");
    handle.className = "layout-resize";
    handle.dataset.corner = corner;
    handle.hidden = true;
    document.body.append(handle);
    return handle;
  });

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "assets/layout/editor.css";
  document.head.append(css);

  const canvas = Reveal.getRevealElement();
  const stage = document.createElement("main");
  stage.className = "layout-stage";
  stage.tabIndex = -1;
  canvas.before(stage);
  stage.append(canvas);
  let selectionFrames = [];
  const guides = ["x", "y"].map(axis => {
    const line = document.createElement("div");
    line.className = "layout-guide guide-" + axis;
    line.hidden = true;
    document.body.append(line);
    return line;
  });

  const bar = document.createElement("div");
  bar.className = "layout-toolbar";
  let language = localStorage.getItem("slide-editor-language") === "en" ? "en" : "zh-CN";
  const t = (zh, en) => language === "en" ? en : zh;
  const fontSelect = (key, script, label) => `<select data-setting="${key}" data-script="${script}" aria-label="${label}">
    <option value=""></option>${fonts[script].map(name => `<option>${name}</option>`).join("")}</select><small class="layout-setting-default" hidden></small>`;
  const headingFormats = [
    ["Weight", "字重", [["normal", "常规"], ["bold", "加粗"]]],
    ["Style", "字形", [["normal", "常规"], ["italic", "斜体"]]],
    ["Lines", "装饰线", [["none", "无"], ["underline", "下划线"], ["line-through", "删除线"], ["underline line-through", "下划线和删除线"]]]
  ];
  const palettes = {
    Nord: [
      ["#2e3440", "深灰", "Charcoal"], ["#eceff4", "雪白", "Snow"], ["#5e81ac", "霜蓝", "Frost blue"],
      ["#88c0d0", "冰蓝", "Ice blue"], ["#8fbcbb", "青绿", "Teal"], ["#a3be8c", "鼠尾草绿", "Sage"],
      ["#ebcb8b", "沙黄", "Sand"], ["#d08770", "陶橙", "Terracotta"], ["#bf616a", "灰红", "Dusty red"],
      ["#b48ead", "灰紫", "Mauve"]
    ],
    "工程配色": ["#171719", "#435261", "#176eb6", "#1966a3", "#8dcaff", "#263644", "#c8cdd1", "#f2f4f6"],
    "柔和色": ["#f2cbc3", "#efdab6", "#e8e3af", "#c5dfc9", "#c1dee2", "#c2cfe6", "#d3c6e2", "#e3c6d4"],
    "灰阶": ["#171717", "#404040", "#626262", "#858585", "#a8a8a8", "#cccccc", "#eeeeee", "#ffffff"]
  };
  bar.innerHTML = `
    <header class="layout-header">
      <h1 class="layout-title">幻灯片编辑</h1>
      <div class="layout-file">
        <button data-act="text">＋ 文本框</button>
        <button data-act="image">＋ 图片</button>
        <button data-act="video">＋ 视频</button>
        <input type="file" hidden>
      </div>
      <div class="layout-file">
        <button data-act="undo">撤销</button>
        <button data-act="redo">重做</button>
      </div>
      <div class="layout-file layout-publish">
        <button data-act="settings" aria-haspopup="dialog">设置</button>
        <a target="_blank" rel="noopener">放映 ↗</a>
        <button data-act="save">保存</button>
        <button data-act="preview" hidden title="保存修改并返回 Quarto 预览">返回预览</button>
      </div>
      <div class="layout-inspector-title" role="group" aria-label="侧栏视图">
        <button type="button" data-act="object-settings" title="对象设置" aria-pressed="true" aria-controls="layout-object-panel">对象</button>
        <button type="button" data-act="source" title="本页源码" aria-pressed="false" aria-controls="layout-source-panel">源码</button>
      </div>
    </header>
    <div class="layout-divider" role="separator" aria-orientation="vertical" aria-label="调整侧栏宽度" aria-controls="layout-inspector" aria-valuemin="256" aria-valuenow="292" tabindex="0"></div>
    <aside class="layout-inspector" id="layout-inspector" aria-label="编辑侧栏">
      <div class="layout-object-panel" id="layout-object-panel">
      <span class="layout-kind ui-pane-heading-meta"></span>
      <label class="layout-layer-label ui-field">本页对象<select aria-label="本页对象" translate="no"></select></label>
      <details class="ui-disclosure layout-frame-library"><summary>＋ 背景框</summary>
        <label>工程背景框样式<select name="backgroundPreset" translate="no"></select></label>
        <div class="layout-frame-actions"><i aria-hidden="true"></i><button data-act="background">插入背景框</button></div>
      </details>
      <div class="layout-object-actions">
        <button data-act="copy">复制</button><button data-act="paste">粘贴</button><button data-act="delete">删除</button>
      </div>
      <div class="layout-object-actions"><button data-act="group">组合</button><button data-act="ungroup">取消组合</button></div>
      <div class="layout-controls">
        <fieldset data-for="text" aria-label="文字"><legend><span class="layout-format" role="group" aria-label="文字样式">文字
          <button data-act="bold" aria-label="加粗" title="加粗" aria-pressed="false"><b>B</b></button>
          <button data-act="italic" aria-label="斜体" title="斜体" aria-pressed="false"><i>I</i></button>
          <button data-act="underline" aria-label="下划线" title="下划线" aria-pressed="false"><u>U</u></button>
          <button data-act="line-through" aria-label="删除线" title="删除线" aria-pressed="false"><s>S</s></button>
        </span></legend>
          <label class="layout-font">字体 <select name="family"><option value="">主题字体</option><option value="'Montserrat', 'Noto Sans CJK SC', sans-serif">Montserrat</option><option value="'Noto Sans CJK SC', sans-serif">Noto Sans CJK SC</option><option value="sans-serif">无衬线</option><option value="serif">衬线</option><option value="monospace">等宽</option></select></label>
          <div class="layout-row"><label>字号 · px <input name="size" type="number" min="8" max="240" aria-label="字号，像素"></label></div>
          <div class="layout-row layout-text-align" role="group" aria-label="框内文字对齐">
            <button data-align="left" aria-pressed="false">左对齐</button>
            <button data-align="center" aria-pressed="false">居中</button>
            <button data-align="right" aria-pressed="false">右对齐</button>
          </div>
        </fieldset>
        <fieldset data-for="box-style"><legend>文本框样式</legend>
          <details class="ui-disclosure" open><summary>边框样式</summary>
            <div class="layout-frame-choices" role="group" aria-label="工程框样式"></div>
            <div class="layout-row" data-frame-options="box"><label>圆角 · px<input type="number" name="frameRadius" min="0" step="any"></label>
              <label>内边距 · px<input type="number" name="framePadding" min="0" step="any"></label></div>
            <div class="layout-row" data-frame-options="border">
              <label>线宽 · px<input type="number" name="frameStroke" min="0.1" step="any"></label>
              <label>线型<select name="frameLine"><option value="solid">实线</option><option value="dashed">虚线</option><option value="dotted">点线</option><option value="double">双线</option></select></label>
            </div>
            <label data-frame-options="edge">强调边<select name="frameEdge"><option value="Top">上</option><option value="Right">右</option><option value="Bottom">下</option></select></label>
            <label data-frame-options="shadow">阴影参数<input class="ui-input" name="frameShadow" spellcheck="false"></label>
          </details>
          <div class="layout-color-target"><label>配色对象<select name="colorTarget">
            <option value="color">文字颜色</option><option value="background-color">背景颜色</option><option value="border-color">边框颜色</option>
          </select></label><button type="button" data-act="eyedropper" title="从幻灯片吸取颜色">吸管</button><button type="button" data-act="no-color" aria-pressed="false">无色</button></div>
          <details class="ui-disclosure layout-palette-menu" open><summary>颜色组</summary>
            <div class="layout-palettes">
              ${Object.entries(palettes).map(([name, colors]) => `<section data-palette="${name}">
                <button class="layout-reorder" aria-label="上下移动颜色组" title="拖动或按上下键排序">↕</button>
                <details class="ui-disclosure" ${name === "Nord" ? "open" : ""}><summary>${name}</summary>
                  <div class="layout-swatches">${colors.map(color => {
                    const [hex, label] = Array.isArray(color) ? color : [color, color];
                    return `<button type="button" data-color="${hex}" style="--swatch:${hex}" title="${label}" aria-label="${label}"></button>`;
                  }).join("")}</div>
                </details>
              </section>`).join("")}
            </div>
          </details>
          <div class="layout-custom-color"><label>自选颜色<input type="color" name="picker"></label>
            <label>HEX<input class="ui-input" name="hex" placeholder="#RRGGBB" spellcheck="false" autocomplete="off"></label></div>
          <details class="ui-disclosure"><summary>自定义 CSS</summary>
            <label>样式声明<textarea class="ui-textarea layout-css" name="boxStyle" rows="4" spellcheck="false" placeholder="padding: 8px; border-radius: 6px;"></textarea></label>
          </details>
        </fieldset>
        <div class="layout-content"></div>
        <fieldset data-for="box"><legend>文本框尺寸 · px</legend><div class="layout-row">
          <label>宽 <input type="number" name="boxWidth" min="1"></label><label>高 <input type="number" name="boxHeight" min="1"></label>
        </div></fieldset>
        <fieldset data-for="image"><legend>图片</legend>
          <label>旋转 ° <input type="number" name="angle"></label>
          <details class="layout-crop ui-disclosure" open><summary>裁剪</summary>
            <button type="button" data-act="crop" aria-pressed="false">鼠标裁剪</button>
            <label>裁剪圆角 · px<input type="number" name="radius" min="0" step="any"></label>
            <div role="group" aria-label="裁边百分比">
            ${["上 · %","右 · %","下 · %","左 · %"].map((name, i) => `<label>${name}<input type="number" data-crop="${i}" min="0" max="99.9" step="any"></label>`).join("")}
          </div></details>
        </fieldset>
        <fieldset data-for="media"><legend>大小</legend>
          <label>缩放 · % <input name="zoom" type="number" min="10" max="500" aria-label="对象缩放百分比"></label>
        </fieldset>
        <fieldset><legend>对齐到幻灯片</legend>
          <div class="layout-row"><button data-act="center-x">水平居中</button><button data-act="center-y">垂直居中</button></div>
        </fieldset>
        <button data-act="reset">复原对象</button>
      </div>
      <p class="layout-hint ui-hint"></p>
      </div>
      <form class="layout-source" id="layout-source-panel" hidden>
        <div class="layout-source-heading"><span></span>
          <button type="button" data-act="vim" aria-label="Vim 模式" aria-pressed="false" disabled>Vim</button>
        </div>
        <div class="layout-source-editor" hidden></div>
        <p role="status"></p>
        <div class="layout-settings-actions"><button type="button" data-act="reload-source">重新读取</button>
          <button type="submit" disabled>保存并渲染</button></div>
      </form>
    </aside>
    <div class="layout-statusbar">
      <output class="layout-sync" aria-live="polite"></output>
      <nav class="layout-pages" aria-label="页面导航">
        <button data-act="prev" aria-label="上一页">‹</button>
        <span class="layout-page-count"></span>
        <button data-act="next" aria-label="下一页">›</button>
      </nav>
    </div>
    <dialog class="layout-settings" aria-labelledby="layout-settings-title"><form>
      <h2 id="layout-settings-title">全局设置</h2>
      <div class="layout-settings-line"><span>界面语言</span><button type="button" data-act="language">English</button></div>
      <fieldset><legend>编辑模式</legend>
        <label>画布引用预览<select data-setting="citationPreview">
          <option value="">原始引用 [@key]</option><option value="rendered">渲染后的引用</option>
        </select></label>
      </fieldset>
      <fieldset><legend>文稿字体</legend><div class="layout-row">
        <label>中文字体${fontSelect("zh", "zh", "中文字体")}</label>
        <label>英文字体${fontSelect("en", "en", "英文字体")}</label>
      </div></fieldset>
      <fieldset><legend>标题样式</legend>
        <table><thead><tr><th>级别</th><th>中文字体</th><th>英文字体</th><th>字号 · px</th>${headingFormats.map(([, label]) => `<th>${label}</th>`).join("")}</tr></thead>
        <tbody>${[1,2,3,4,5,6].map(level => `<tr><th scope="row">H${level}</th>
          <td aria-label="中文字体">${fontSelect("h" + level + "Zh", "zh", "H" + level + " 中文字体")}</td>
          <td aria-label="英文字体">${fontSelect("h" + level + "En", "en", "H" + level + " 英文字体")}</td>
          <td aria-label="字号 · px"><input data-setting="h${level}Size" type="number" min="8" max="240" aria-label="H${level} 字号"><small class="layout-setting-default"></small></td>
          ${headingFormats.map(([key, label, options]) => `<td aria-label="${label}"><select data-setting="h${level}${key}" aria-label="H${level} ${label}">
            <option value="">主题默认</option>${options.map(([value, name]) => `<option value="${value}">${name}</option>`).join("")}</select></td>`).join("")}
        </tr>`).join("")}</tbody></table>
      </fieldset>
      <fieldset><legend>页脚</legend>
        <label><input type="checkbox" name="footerSync" checked> 全局同步 Logo 和页码</label>
        <p class="ui-hint">重新开启时，以当前页的页脚为准。封面使用第一张正文页的页脚作为同步来源。</p>
        <div class="layout-logo-row">
        <img alt="Logo"><input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.avif" aria-label="选择 Logo 图片">
        <button type="button" data-act="reset-logo">恢复默认</button>
      </div></fieldset>
      <p class="layout-settings-error" role="alert"></p>
      <div class="layout-settings-actions"><button type="button" data-act="cancel-settings">取消</button><button type="submit">应用</button></div>
    </form></dialog>`;
  const englishLabels = {
    "对象": "Objects", "源码": "Source", "Vim 模式": "Vim mode",
    "本页源码": "Slide source", "编辑侧栏": "Editor sidebar", "侧栏视图": "Sidebar view",
    "对象设置": "Object settings", "重新读取": "Reload source", "保存并渲染": "Save and render",
    "页脚": "Footer", "全局同步 Logo 和页码": "Sync logo and page number across slides",
    "重新开启时，以当前页的页脚为准。封面使用第一张正文页的页脚作为同步来源。": "Turning sync back on uses this slide’s footer. From the cover, it uses the first content slide.",
    "设置": "Settings", "全局设置": "Global settings", "界面语言": "Interface language",
    "文稿字体": "Deck fonts", "中文字体": "Chinese font", "英文字体": "English font",
    "标题样式": "Heading styles", "级别": "Level",
    "编辑模式": "Edit mode", "画布引用预览": "Citation preview on canvas", "原始引用 [@key]": "Source [@key]", "渲染后的引用": "Rendered citations",
    "字重": "Weight", "字形": "Font style", "装饰线": "Decoration", "常规": "Regular", "主题默认": "Theme default",
    "无": "None", "下划线和删除线": "Underline and strikethrough",
    "选择 Logo 图片": "Choose logo image", "恢复默认": "Use default", "取消": "Cancel", "应用": "Apply",
    ...Object.fromEntries(palettes.Nord.map(([, zh, en]) => [zh, en])),
    "＋ 背景框": "＋ Background frame", "工程背景框样式": "Project frame styles", "插入背景框": "Insert frame",
    "边框样式": "Frame appearance", "工程框样式": "Project frame styles", "圆角 · px": "Corners · px", "内边距 · px": "Padding · px",
    "线宽 · px": "Stroke · px", "线型": "Line style", "实线": "Solid", "虚线": "Dashed", "点线": "Dotted", "双线": "Double",
    "强调边": "Accent side", "上": "Top", "右": "Right", "下": "Bottom", "左": "Left", "阴影参数": "Box shadow",
    "文本框样式": "Text box style", "配色对象": "Apply color to", "文字颜色": "Text", "背景颜色": "Background",
    "边框颜色": "Border", "无色": "No color", "颜色组": "Color palettes", "工程配色": "Project colors",
    "调整侧栏宽度": "Resize sidebar", "吸管": "Eyedropper", "从幻灯片吸取颜色": "Pick a color from the slide",
    "柔和色": "Pastels", "灰阶": "Grayscale", "自选颜色": "Custom color",
    "上下移动颜色组": "Reorder palette", "拖动或按上下键排序": "Drag or use the up and down arrow keys to reorder", "自定义 CSS": "Custom CSS", "样式声明": "CSS declarations",
    "幻灯片编辑": "Slide editor", "页面导航": "Slide navigation", "上一页": "Previous slide",
    "下一页": "Next slide", "＋ 文本框": "＋ Text box", "＋ 图片": "＋ Image",
    "＋ 视频": "＋ Video", "撤销": "Undo", "重做": "Redo",
    "放映 ↗": "Present ↗", "保存": "Save", "返回预览": "Back to preview",
    "保存修改并返回 Quarto 预览": "Save changes and return to Quarto preview", "对象格式": "Object format", "本页对象": "Slide objects",
    "复制": "Copy", "粘贴": "Paste", "删除": "Delete",
    "组合": "Group", "取消组合": "Ungroup", "文字": "Text",
    "文字样式": "Text style", "加粗": "Bold", "斜体": "Italic",
    "下划线": "Underline", "删除线": "Strikethrough", "字体": "Font family",
    "主题字体": "Theme font", "无衬线": "Sans serif", "衬线": "Serif",
    "等宽": "Monospace", "字号 · px": "Font size · px", "字号，像素": "Font size in pixels",
    "框内文字对齐": "Text alignment", "左对齐": "Left", "居中": "Center",
    "右对齐": "Right", "文本框尺寸 · px": "Text box size · px", "宽": "Width",
    "高": "Height", "图片": "Image", "旋转 °": "Rotation °",
    "裁剪": "Crop", "裁剪圆角 · px": "Crop corner radius · px", "裁边百分比": "Crop insets in percent",
    "大小": "Size", "缩放 · %": "Scale · %", "对象缩放百分比": "Object scale in percent",
    "对齐到幻灯片": "Align to slide", "水平居中": "Center horizontally", "垂直居中": "Center vertically",
    "复原对象": "Reset object", "上 · %": "Top · %", "右 · %": "Right · %",
    "下 · %": "Bottom · %", "左 · %": "Left · %",
  };
  // Capture only the static toolbar labels, before adding slide content or object names.
  const localizeLabels = [];
  const walker = document.createTreeWalker(bar, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, zh = node.data.trim(), en = englishLabels[zh];
    if (en) localizeLabels.push(() => { node.data = t(zh, en); });
  }
  for (const el of bar.querySelectorAll("[aria-label], [title], [placeholder]")) {
    for (const attr of ["aria-label", "title", "placeholder"]) {
      const zh = el.getAttribute(attr);
      if (!zh) continue;
      const en = englishLabels[zh] || (/^H[1-6] /.test(zh) && zh.replace(/中文字体|英文字体|字号|字重|字形|装饰线/, s => englishLabels[s] || "Font size"));
      if (en) localizeLabels.push(() => el.setAttribute(attr, t(zh, en)));
    }
  }
  for (const button of bar.querySelectorAll("button, a")) {
    button.classList.add("ui-button");
    if (button.dataset.act === "delete") button.classList.add("ui-button--danger");
    else if (button.dataset.act === "reset") button.classList.add("ui-button--ghost");
    else if (button.dataset.act !== "save" && !button.matches('[type="submit"]')) button.classList.add("ui-button--secondary");
  }
  for (const field of bar.querySelectorAll("select, input[type=number]")) field.classList.add("ui-input");
  document.body.append(bar);
  bar.querySelector("a").href = location.pathname + location.hash;
  const action = name => bar.querySelector('[data-act="' + name + '"]');
  const divider = bar.querySelector(".layout-divider"), inspector = bar.querySelector(".layout-inspector");
  const widthKey = "slide-editor-inspector-width";
  const preferredWidth = Number(localStorage.getItem(widthKey));
  if (preferredWidth > 0) document.documentElement.style.setProperty("--preferred-inspector-width", preferredWidth + "px");
  function setInspectorWidth(width) {
    const value = Math.round(Math.max(256, Math.min(innerWidth * .6, width)));
    document.documentElement.style.setProperty("--preferred-inspector-width", value + "px");
    return value;
  }
  divider.onpointerdown = event => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    const start = inspector.offsetWidth;
    divider.setPointerCapture(event.pointerId);
    divider.onpointermove = move => {
      if (move.pointerId === event.pointerId) setInspectorWidth(start + event.clientX - move.clientX);
    };
    divider.onpointerup = up => {
      if (up.pointerId === event.pointerId) localStorage.setItem(widthKey, setInspectorWidth(start + event.clientX - up.clientX));
    };
    divider.onpointercancel = () => setInspectorWidth(start);
    divider.onlostpointercapture = () => { divider.onpointermove = divider.onpointerup = divider.onpointercancel = null; };
  };
  function setLanguage() {
    bar.lang = language;
    localizeLabels.forEach(update => update());
    const button = action("language");
    button.textContent = t("English", "中文");
    button.lang = t("en", "zh-CN");
    button.setAttribute("aria-label", t("Switch to English", "切换到中文"));
  }
  action("language").onclick = () => {
    language = t("en", "zh-CN");
    localStorage.setItem("slide-editor-language", language);
    setLanguage();
    updateSettingDefaults();
    listLayers();
    showContent();
    refresh();
  };
  setLanguage();
  const previewParam = new URLSearchParams(location.search).get("preview");
  const previewUrl = previewParam && URL.canParse(previewParam) ? new URL(previewParam) : null;
  if (previewUrl?.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(previewUrl.hostname)) {
    action("preview").hidden = false;
    action("preview").onclick = async () => {
      finishText();
      if (dirty()) await save();
      if (dirty() || saving || pendingImports) return;
      previewUrl.hash = Reveal.getSlidePath();
      location.assign(previewUrl.href);
    };
  }
  const header = bar.querySelector("header");
  new ResizeObserver(() => document.documentElement.style.setProperty("--editor-head", header.offsetHeight + "px")).observe(header);
  const formatButtons = bar.querySelectorAll(".layout-format button");
  const size = bar.querySelector('[name="size"]');
  const family = bar.querySelector('[name="family"]');
  const fontOptions = new Map([...family.options].map(option => {
    const style = document.createElement("span").style;
    style.fontFamily = option.value;
    return [style.fontFamily, option.value];
  }));
  const input = name => bar.querySelector('[name="' + name + '"]');
  function liveNumber(field, update) {
    let batch;
    field.onfocus = () => { batch = Symbol(); };
    field.oninput = () => {
      if (!field.value || !field.validity.valid) return;
      numberInFlight = field;
      try { update(field.valueAsNumber, batch); }
      finally { numberInFlight = null; }
    };
    field.onblur = () => refresh();
  }
  function showNumber(field, value) {
    if (field !== numberInFlight) field.value = value;
  }
  const colorTarget = input("colorTarget"), cssField = input("boxStyle");
  const swatches = bar.querySelectorAll("[data-color]");
  const groupOf = el => edits[keys.get(el)]?.group;
  const grouped = () => members.length > 1 && groupOf(selected) && members.every(el => groupOf(el) === groupOf(selected));
  const textBox = el => el instanceof HTMLElement && isText(el);
  const zoom = bar.querySelector('[name="zoom"]');
  const alignGroup = bar.querySelector(".layout-text-align");
  const alignButtons = alignGroup.querySelectorAll("button");
  const status = bar.querySelector("output");
  const dialog = bar.querySelector("dialog");
  const settingsForm = dialog.querySelector("form");
  const settingsFields = dialog.querySelectorAll("[data-setting]");
  const footerSync = input("footerSync");
  function sourceFooter(ids) {
    return ids.find(id => Reveal.getCurrentSlide().contains(objects.get(id))) || ids[0];
  }
  const logoFile = dialog.querySelector('[type="file"]'), logoPreview = dialog.querySelector("img");
  const settingsError = dialog.querySelector('[role="alert"]');
  const [defaultEn, defaultZh] = themeFonts.map(name => name.trim().replace(/^["']|["']$/g, ""));
  const themeFamily = { en: defaultEn, zh: defaultZh };
  function readHeadingDefaults() {
    // Measure the authored headings with the deck and object edits removed.
    const sizes = {};
    const sampleSlide = canvas.querySelector(".slides section.slide") || canvas.querySelector(".slides section");
    deckStyle.sheet.disabled = true;
    try {
      for (let level = 1; level <= 6; level++) {
        const tag = "h" + level;
        const headings = [...canvas.querySelectorAll(".slides section " + tag)].filter(el => !el.closest(".layout-added,.notes"));
        const values = new Set();
        for (const el of headings) {
          const base = originals.get(el), inline = el.style.cssText;
          if (base) el.style.setProperty("font-size", base.fontSize, base.sizePriority);
          values.add(parseFloat(getComputedStyle(el).fontSize));
          if (base) el.style.cssText = inline;
        }
        if (!values.size) {
          const probe = document.createElement(tag);
          sampleSlide.append(probe);
          values.add(parseFloat(getComputedStyle(probe).fontSize));
          probe.remove();
        }
        sizes[tag + "Size"] = [...values].sort((a, b) => a - b).join(" / ");
      }
    } finally { deckStyle.sheet.disabled = false; }
    return sizes;
  }
  let headingDefaults;
  function updateSettingDefaults() {
    for (const field of settingsFields) {
      const key = field.dataset.setting, script = field.dataset.script;
      if (script) {
        const body = key === script;
        const font = body ? themeFamily[script] : dialog.querySelector(`[data-setting="${script}"]`).value || themeFamily[script];
        field.options[0].textContent = font + (body ? t("（默认）", " (default)") : t("（跟随文稿）", " (deck font)"));
        field.nextElementSibling.textContent = field.options[0].textContent;
        field.nextElementSibling.hidden = !field.value;
      } else if (field.type === "number") {
        const sizes = headingDefaults[key];
        field.placeholder = sizes.includes("/") ? t("按页面", "Varies") : sizes;
        field.nextElementSibling.textContent = t("默认 ", "Default ") + sizes + " px";
        field.nextElementSibling.hidden = !field.value && !sizes.includes("/");
      }
    }
    action("reset-logo").title = t("默认 ", "Default ") + originalLogo;
  }
  let headingPreview;
  settingsForm.addEventListener("input", ({ target }) => {
    updateSettingDefaults();
    if (target.type !== "number" || !target.validity.valid) return;
    headingPreview ??= { ...edits[settingsKey] };
    if (target.value) headingPreview[target.dataset.setting] = target.valueAsNumber;
    else delete headingPreview[target.dataset.setting];
    apply(settingsKey, headingPreview);
    placeHandle();
  });
  let logoDraft, logoUrl;
  function updateLogoControls() {
    const coverOnly = !footerSync.checked && Reveal.getCurrentSlide().id === "title-slide";
    logoFile.disabled = action("reset-logo").disabled = coverOnly;
  }
  footerSync.onchange = updateLogoControls;
  function showLogo(src) {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    logoUrl = logoFile.files[0] && URL.createObjectURL(logoFile.files[0]);
    logoPreview.src = logoUrl || src || originalLogo;
  }
  action("settings").onclick = () => {
    const settings = edits[settingsKey] || {};
    for (const field of settingsFields) field.value = settings[field.dataset.setting] ?? "";
    headingDefaults = readHeadingDefaults();
    updateSettingDefaults();
    footerSync.checked = settings.footerSync !== false;
    updateLogoControls();
    const source = sourceFooter(footerIds.get('["footer","logo"]'));
    logoDraft = edits[source]?.logoSrc ?? settings.logo;
    logoFile.value = "";
    showLogo(logoDraft);
    settingsError.textContent = "";
    dialog.showModal();
  };
  logoFile.onchange = () => showLogo(logoDraft);
  action("reset-logo").onclick = () => {
    logoDraft = undefined;
    logoFile.value = "";
    showLogo();
  };
  action("cancel-settings").onclick = () => dialog.close();
  dialog.onclose = () => {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    logoUrl = null;
    if (headingPreview) {
      headingPreview = null;
      apply(settingsKey, edits[settingsKey]);
      placeHandle();
    }
  };
  dialog.oncancel = event => { if (settingsForm.inert) event.preventDefault(); };
  async function applySettingsForm(saveAfter) {
    if (settingsForm.inert || !settingsForm.reportValidity()) return;
    const settings = { ...edits[settingsKey] };
    for (const field of settingsFields) {
      if (field.value) settings[field.dataset.setting] = field.type === "number" ? field.valueAsNumber : field.value;
      else delete settings[field.dataset.setting];
    }
    settingsForm.inert = true;
    try {
      if (!logoFile.disabled && logoFile.files[0]) {
        await logoPreview.decode();
        logoDraft = await uploadFile(logoFile.files[0]);
      }
      const entries = [[settingsKey, settings]];
      if (footerSync.checked) {
        const wasSeparate = settings.footerSync === false;
        delete settings.footerSync;
        if (logoDraft) settings.logo = logoDraft;
        else delete settings.logo;
        if (wasSeparate) {
          for (const ids of footerIds.values()) {
            const id = sourceFooter(ids);
            if (!id) continue;
            const value = { ...edits[id] };
            delete value.logoSrc;
            entries.push([id, value]);
          }
        }
      } else {
        settings.footerSync = false;
        if (!logoFile.disabled) {
          const id = sourceFooter(footerIds.get('["footer","logo"]'));
          const value = { ...edits[id] };
          if ((logoDraft || "") === (settings.logo || "")) delete value.logoSrc;
          else value.logoSrc = logoDraft || "";
          entries.push([id, value]);
        }
      }
      commit(entries);
      dialog.close();
      if (saveAfter) await save();
    } catch (error) { settingsError.textContent = error.message; }
    finally { settingsForm.inert = false; }
  }
  settingsForm.onsubmit = event => { event.preventDefault(); applySettingsForm(false); };
  const layers = bar.querySelector("select");
  const content = bar.querySelector(".layout-content");
  const key = () => keys.get(selected);
  const dirty = () => Object.keys(edits).length !== Object.keys(saved).length ||
    Object.keys(edits).some(id => JSON.stringify(edits[id]) !== JSON.stringify(saved[id]));
  const isMedia = el => el?.matches("img,video");
  const isText = el => originals.get(el).text !== null || originals.get(el).runs.length > 0;
  const backgroundCards = new WeakSet();
  const frameStyles = new Map();
  const frameNames = { none: ["无框", "No frame"], tag: ["左侧标签", "Left tag"], edge: ["单边强调", "Accent edge"], outline: ["描边", "Outline"],
    fill: ["底色", "Fill"], rounded: ["圆角底色", "Rounded fill"], shadow: ["阴影", "Shadow"] };
  const framePicker = input("backgroundPreset");
  const frameChoices = bar.querySelector(".layout-frame-choices");
  const sides = ["Top", "Right", "Bottom", "Left"];
  const borderSides = style => sides.filter(side => parseFloat(style["border" + side + "Width"]) > 0);
  function frameType(style, borders) {
    if (style.backgroundImage.includes("gradient(")) return null;
    if (style.boxShadow !== "none") return "shadow";
    if (borders.length === 1) return borders[0] === "Left" ? "tag" : "edge";
    if (borders.length) return "outline";
    if (style.backgroundColor === "rgba(0, 0, 0, 0)") return "none";
    return parseFloat(style.borderRadius) ? "rounded" : "fill";
  }
  function frameDecoration(style) {
    const decoration = document.createElement("span").style;
    decoration.backgroundColor = style.backgroundColor;
    for (const side of borderSides(style)) decoration["border" + side] = style["border" + side];
    decoration.borderRadius = style.borderRadius;
    decoration.boxShadow = style.boxShadow;
    return decoration.cssText;
  }
  function addFrameChoice(type, style) {
    if (!type || frameStyles.has(type)) return;
    const css = style ? frameDecoration(style) : "";
    frameStyles.set(type, css);
    const button = document.createElement("button"), sample = document.createElement("i"), label = document.createElement("span");
    button.type = "button";
    button.value = type;
    sample.style.cssText = css;
    sample.setAttribute("aria-hidden", "true");
    button.append(sample, label);
    const option = type === "none" ? null : new Option("", type);
    if (option) framePicker.add(option);
    const localize = () => {
      label.textContent = t(...frameNames[type]);
      if (option) option.text = label.textContent;
    };
    localize();
    localizeLabels.push(localize);
    frameChoices.append(button);
  }
  addFrameChoice("none");
  // Read the deck's resolved styles so presets include section-specific colors and borders.
  for (const el of objects.values()) {
    if (!el.matches("div,article,aside,blockquote,figure,p,li,dt,dd,td,th,figcaption,span") ||
        el.closest(".layout-added,.notes,svg,math")) continue;
    const style = getComputedStyle(el);
    const bordered = borderSides(style);
    const type = frameType(style, bordered);
    if (type === "none") continue;
    if (bordered.length >= 3 || style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
        style.backgroundImage !== "none" || style.boxShadow !== "none") backgroundCards.add(el);
    if (type !== "edge" || bordered[0] === "Bottom") addFrameChoice(type, style);
  }
  const frameSample = bar.querySelector(".layout-frame-actions i");
  framePicker.onchange = () => { frameSample.style.cssText = frameStyles.get(framePicker.value) || ""; };
  framePicker.onchange();
  const isFrame = el => backgroundCards.has(el) || el?.classList.contains("layout-background") ||
    (originals.get(el)?.source && backgroundCards.has(objects.get(originals.get(el).source)));
  const canSizeBox = el => textBox(el) || isFrame(el);
  function editableFrameStyle(type = frameChoices.querySelector('[aria-pressed="true"]')?.value) {
    const style = editableStyle(selected);
    // A transparent fill or zero radius still belongs to the chosen fill preset.
    if (type === "rounded" || type === "fill") style.setProperty("--layout-fill", type);
    else style.removeProperty("--layout-fill");
    return style;
  }
  frameChoices.onclick = event => {
    const button = event.target.closest("button");
    if (!button || !selected || button.getAttribute("aria-pressed") === "true") return;
    const style = editableFrameStyle(button.value);
    // Clear all previous decoration, including borders on sides absent in the new preset.
    style.background = "none";
    style.border = "none";
    style.borderRadius = "0";
    style.boxShadow = "none";
    style.cssText += ";" + (frameStyles.get(button.value) || "");
    colorTarget.value = ({ tag: "border-color", edge: "border-color", outline: "border-color", none: "color" })[button.value] || "background-color";
    commit([[key(), withBoxStyle(selected, style.cssText)]]);
  };
  for (const [field, prop] of [["frameRadius", "border-radius"], ["framePadding", "padding"], ["frameStroke", "border-width"]]) {
    liveNumber(input(field), (value, batch) => {
      const style = editableFrameStyle();
      if (field === "frameStroke") {
        for (const side of borderSides(getComputedStyle(selected))) style["border" + side + "Width"] = value + "px";
      } else style.setProperty(prop, value + "px");
      commit([[key(), withBoxStyle(selected, style.cssText)]], undefined, batch);
    });
  }
  for (const name of ["frameLine", "frameEdge", "frameShadow"]) {
    const field = input(name);
    field.onchange = () => {
      if (!field.value || !field.validity.valid) return refresh();
      const style = editableStyle(selected), computed = getComputedStyle(selected);
      const borders = borderSides(computed);
      if (name === "frameShadow") {
        if (!CSS.supports("box-shadow", field.value)) return refresh();
        style.boxShadow = field.value;
      } else if (name === "frameEdge") {
        const edge = computed["border" + borders[0]];
        style.border = "none";
        style["border" + field.value] = edge;
      } else {
        for (const side of borders) style["border" + side + "Style"] = field.value;
      }
      commit([[key(), withBoxStyle(selected, style.cssText)]]);
    };
  }
  function kind(el) {
    if (isFrame(el)) return t("背景框", "Background frame");
    if (el.matches("img,video")) return el.matches("img") ? t("图片", "Image") : t("视频", "Video");
    if (el.matches("table")) return t("表格", "Table");
    if (el.matches("svg,svg *")) return el.matches("text") ? t("图中文字", "Figure text") : t("图形", "Shape");
    if (el.matches("math,math *")) return t("公式", "Equation");
    if (el.matches("h1,h2,h3,h4,h5,h6")) return t("标题", "Heading");
    if (el.matches("figcaption")) return t("图注", "Caption");
    return isText(el) ? t("文字", "Text") : t("组合", "Group");
  }
  function layerName(el) {
    const source = isMedia(el) && (el.dataset.src || el.getAttribute("src") || el.querySelector("source")?.getAttribute("src"));
    const name = edits[keys.get(el)]?.add?.kind === "background" ? edits[keys.get(el)].add.label : el.getAttribute("alt") || el.getAttribute("aria-label") || el.getAttribute("title") ||
      (source && !/^(data|blob):/i.test(source) && source) || el.textContent.trim().replace(/\s+/g, " ").slice(0, 36) ||
      el.id || [...el.classList].find(cls => !cls.startsWith("layout-"));
    return name ? el.localName + " · " + name : el.localName;
  }
  function listLayers() {
    const page = Reveal.getCurrentSlide();
    layers.replaceChildren(new Option(t("选择页面上的对象…", "Select a slide object…"), ""));
    const frames = document.createElement("optgroup");
    frames.label = t("背景框", "Background frames");
    for (const el of page.querySelectorAll("*")) {
      if (!keys.has(el) || el.closest(".layout-deleted") || !el.getClientRects().length) continue;
      const option = new Option(layerName(el), keys.get(el));
      if (isFrame(el)) frames.append(option);
      else layers.add(option);
    }
    if (frames.childElementCount) layers.options[0].after(frames);
    layers.value = key() || "";
  }
  layers.onfocus = listLayers;
  layers.onpointerdown = listLayers;
  layers.onchange = () => select(objects.get(layers.value));

  const citations = window.slideCitations;
  const citeMenu = document.createElement("div");
  citeMenu.className = "layout-cite-menu";
  citeMenu.id = "layout-cite-menu";
  citeMenu.setAttribute("role", "listbox");
  citeMenu.hidden = true;
  document.body.append(citeMenu);
  let citeRange, citePrefix, citeIndex;
  function closeCites() {
    citeMenu.hidden = true;
    citeRange = null;
  }
  function citeChip(ids) {
    const chip = document.createElement("span");
    chip.className = "layout-cite-chip";
    chip.contentEditable = "false";
    chip.textContent = "[@" + ids.join(";@") + "]";
    return chip;
  }
  function editCitations(field, value) {
    field.classList.add("layout-cite-field");
    field.contentEditable = "plaintext-only";
    field.replaceChildren(citations.fragments(value, citeChip));
  }
  function pickCite(id) {
    if (!citeRange) return;
    const field = document.activeElement;
    const chip = citeChip([...new Set([...citePrefix, id])]);
    citeRange.deleteContents();
    citeRange.insertNode(chip);
    citeRange.setStartAfter(chip);
    citeRange.collapse(true);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(citeRange);
    closeCites();
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function showCites(field) {
    closeCites();
    const selection = getSelection();
    const node = selection.anchorNode, end = selection.anchorOffset;
    if (!selection.isCollapsed || node?.nodeType !== Node.TEXT_NODE || !field.contains(node)) return;
    const prefix = node.data.slice(0, end);
    const match = prefix.match(/(\[(?:@[^\s;\[\]]+\s*;\s*)*|;\s*)?@([^\s@;\[\]]*)$/);
    if (!match || (!match[1] && /[\w@]/.test(prefix[match.index - 1] || ""))) return;
    const query = match[2].toLowerCase();
    const hits = [];
    for (const [id, row] of citations.catalog) {
      const description = row.querySelector(".csl-right-inline")?.textContent || row.textContent;
      if ((id + " " + description).toLowerCase().includes(query)) hits.push({ id, description });
      if (hits.length === 12) break;
    }
    if (!hits.length) return;
    citeRange = document.createRange();
    citeRange.setStart(node, match.index);
    citeRange.setEnd(node, end + (node.data[end] === "]" ? 1 : 0));
    citePrefix = [...(match[1] || "").matchAll(/@([^\s;]+)/g)].map(m => m[1]);
    let previous = node.previousSibling;
    while (previous?.nodeType === Node.TEXT_NODE && !previous.data) previous = previous.previousSibling;
    if (match[1]?.startsWith(";") && match.index === 0 && previous?.matches?.(".layout-cite-chip")) {
      citePrefix = previous.textContent.slice(2, -1).split(";@");
      citeRange.setStartBefore(previous);
    } else if (match[1]?.startsWith(";")) citeRange.setStart(node, match.index + match[1].length);
    const box = citeRange.getBoundingClientRect();
    citeMenu.style.left = Math.max(4, Math.min(box.left, innerWidth - Math.min(380, innerWidth - 8) - 4)) + "px";
    citeMenu.style.top = box.bottom + 4 + "px";
    citeMenu.style.bottom = "auto";
    if (innerHeight - box.bottom < 210 && box.top > innerHeight - box.bottom) {
      citeMenu.style.top = "auto";
      citeMenu.style.bottom = innerHeight - box.top + 4 + "px";
    }
    citeIndex = 0;
    citeMenu.replaceChildren(...hits.map(({id, description}, i) => {
      const option = document.createElement("button");
      option.type = "button";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(i === 0));
      option.tabIndex = -1;
      option.dataset.key = id;
      option.textContent = id;
      const detail = document.createElement("small");
      detail.textContent = description;
      option.append(detail);
      option.onpointerdown = e => e.preventDefault();
      option.onclick = () => pickCite(id);
      return option;
    }));
    citeMenu.hidden = false;
    citeMenu.scrollTop = 0;
  }
  document.addEventListener("input", e => {
    if (!e.isComposing && e.target.matches(".layout-cite-field")) showCites(e.target);
  });
  document.addEventListener("focusout", closeCites);
  document.addEventListener("pointerdown", e => { if (!citeMenu.contains(e.target)) closeCites(); }, true);

  function showContent() {
    content.replaceChildren();
    if (members.length !== 1 || !isText(selected)) return;
    const base = originals.get(selected);
    const fields = base.text === null ? base.runs.map(run => run.field ? citations.source(run.field) : run.node.data)
      : [typing?.el === selected ? typing.before : citations.source(selected)];
    fields.forEach((value, i) => {
      const label = document.createElement("label");
      const title = fields.length === 1 ? t("文字内容", "Text content") : t("文字片段 ", "Text run ") + (i + 1);
      label.textContent = title;
      const html = selected instanceof HTMLElement;
      const field = document.createElement(html ? "div" : "textarea");
      field.className = "ui-textarea";
      field.defaultValue = value;
      if (html) {
        field.setAttribute("role", "textbox");
        field.setAttribute("aria-label", title);
        field.setAttribute("aria-multiline", "true");
        field.setAttribute("aria-autocomplete", "list");
        field.setAttribute("aria-controls", citeMenu.id);
        editCitations(field, value);
      }
      field.onblur = () => {
        const text = html ? field.innerText : field.value;
        if (text === value) return;
        change(base.text !== null ? { text } : { runs: fields.map((v, j) => j === i ? text : v) });
      };
      label.append(field);
      content.append(label);
    });
  }
  const round = n => Math.round(n * 10) / 10;

  // Include typography saved by older editor versions in the editable declarations.
  const fontProperties = { family: "font-family", size: "font-size", weight: "font-weight",
    italic: "font-style", lines: "text-decoration-line", align: "text-align" };
  function setFontProperty(style, name, value) {
    if (name === "size") value += "px";
    if (name === "italic") value = value ? "italic" : "normal";
    style.setProperty(fontProperties[name], value, name === "size" ? "important" : "");
  }
  function editableStyle(el) {
    const patch = { ...originals.get(el).initial, ...edits[keys.get(el)] };
    const style = document.createElement("span").style;
    for (const prop of Object.keys(fontProperties)) {
      if (patch[prop] != null) setFontProperty(style, prop, patch[prop]);
    }
    style.cssText += ";" + (patch.boxStyle || "");
    return style;
  }
  function withBoxStyle(el, css) {
    const patch = { ...edits[keys.get(el)] };
    for (const prop of Object.keys(fontProperties)) delete patch[prop];
    if (css || originals.get(el).initial?.boxStyle) patch.boxStyle = css;
    else delete patch.boxStyle;
    return patch;
  }
  const selectedTexts = () => members.filter(el => !isMedia(el) && isText(el));
  function formatText(properties, batch) {
    commit(selectedTexts().map(el => {
      const id = keys.get(el), changes = typeof properties === "function" ? properties(el) : properties;
      if (!textBox(el) || !(edits[id]?.boxStyle || originals.get(el).initial?.boxStyle))
        return [id, { ...edits[id], ...changes }];
      const style = editableStyle(el);
      for (const [name, value] of Object.entries(changes)) setFontProperty(style, name, value);
      return [id, withBoxStyle(el, style.cssText)];
    }), undefined, batch);
  }

  function bounds(el) {
    const frame = originals.get(el).frame;
    const autoText = frame.classList.contains("layout-textbox") && frame.style.width === "fit-content" && !frame.style.height;
    const styledBox = originals.get(el).beforeBoxStyle !== undefined &&
      (el.style.backgroundColor || el.style.borderStyle || el.style.padding || !autoText && (el.style.width || el.style.height));
    if (isFrame(el) || !textBox(el) || styledBox || resize?.text === el || !autoText && frame.classList.contains("layout-added") || edits[keys.get(el)]?.boxWidth || edits[keys.get(el)]?.boxHeight) return frame.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const ink = range.getBoundingClientRect();
    return ink.width && ink.height ? ink : el.getBoundingClientRect();
  }

  function groupBox() {
    const boxes = members.map(bounds);
    const left = Math.min(...boxes.map(b => b.left)), top = Math.min(...boxes.map(b => b.top));
    return new DOMRect(left, top, Math.max(...boxes.map(b => b.right)) - left,
      Math.max(...boxes.map(b => b.bottom)) - top);
  }

  function placeHandle() {
    cropOverlay.hidden = !cropping;
    stage.classList.toggle("layout-cropping", cropping);
    if (cropping) placeCrop();
    members.forEach((el, i) => {
      const frame = selectionFrames[i];
      frame.hidden = Boolean(typing) || cropping;
      if (frame.hidden) return;
      const box = bounds(el);
      Object.assign(frame.style, { left: box.left + "px", top: box.top + "px",
        width: box.width + "px", height: box.height + "px" });
    });
    const box = selected && !typing && !cropping ? groupBox() : null;
    for (const handle of handles) {
      handle.hidden = !box;
      if (!box) continue;
      handle.title = members.length === 1 && canSizeBox(selected) ? t("拖动以调整框的宽高", "Drag to resize the box") : t("拖动以等比缩放", "Drag to scale proportionally");
      handle.style.left = box[handle.dataset.corner.endsWith("w") ? "left" : "right"] + "px";
      handle.style.top = box[handle.dataset.corner.startsWith("n") ? "top" : "bottom"] + "px";
    }
  }

  function fitCanvas() {
    divider.setAttribute("aria-valuenow", inspector.offsetWidth);
    divider.setAttribute("aria-valuemax", Math.round(innerWidth * .6));
    const ratio = Reveal.getConfig().width / Reveal.getConfig().height;
    const width = Math.min(stage.clientWidth - 32, (stage.clientHeight - 32) * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = width / ratio + "px";
    Reveal.layout();
    placeHandle();
  }
  new ResizeObserver(fitCanvas).observe(stage);

  function refresh(message) {
    placeHandle();
    const texts = selectedTexts();
    const style = selected && getComputedStyle(selected);
    size.disabled = !texts.length;
    const styles = texts.map(el => getComputedStyle(el));
    const sizes = new Set(styles.map(s => Math.round(parseFloat(s.fontSize))));
    showNumber(size, sizes.size === 1 ? [...sizes][0] : "");
    size.placeholder = sizes.size > 1 ? t("混合", "Mixed") : "";
    const families = new Set(texts.map(el => editableStyle(el).fontFamily));
    const chosenFamily = families.size === 1 ? [...families][0] : "";
    family.querySelector("[data-custom]")?.remove();
    if (!fontOptions.has(chosenFamily)) {
      const option = new Option(chosenFamily, chosenFamily);
      option.dataset.custom = "";
      family.add(option);
    }
    family.value = fontOptions.get(chosenFamily) ?? chosenFamily;
    const inherited = new Set(styles.map((style, i) => {
      const el = texts[i], inline = el.style.getPropertyValue("font-family");
      if (!inline) return style.fontFamily;
      const priority = el.style.getPropertyPriority("font-family");
      el.style.removeProperty("font-family");
      const fallback = getComputedStyle(el).fontFamily;
      el.style.setProperty("font-family", inline, priority);
      return fallback;
    }));
    family.options[0].textContent = families.size > 1 || inherited.size > 1 ? t("混合字体", "Mixed fonts") :
      [...inherited].join("") || t("主题字体", "Theme font");
    const box = members.length === 1 && canSizeBox(selected);
    const batchColor = members.length > 1 && texts.some(textBox);
    const panel = box && isFrame(selected);
    bar.querySelector('[data-for="box"] legend').textContent = panel ? t("背景框尺寸 · px", "Frame size · px") : t("文本框尺寸 · px", "Text box size · px");
    bar.querySelector('[data-for="box-style"] legend').textContent = batchColor ? t("文字颜色", "Text color") :
      panel ? t("背景框样式", "Frame style") : t("文本框样式", "Text box style");
    frameChoices.closest("details").hidden = cssField.closest("details").hidden = batchColor;
    colorTarget.querySelector('[value="background-color"]').disabled = batchColor;
    if (batchColor) {
      colorTarget.value = "color";
      colorTarget.querySelector('[value="border-color"]').disabled = true;
      updateSwatches();
    }
    const textColor = colorTarget.querySelector('[value="color"]');
    textColor.disabled = panel && !selected.textContent.trim();
    if (textColor.disabled && colorTarget.value === "color") colorTarget.value = "background-color";
    bar.querySelector('[data-for="box"]').hidden = !box;
    bar.querySelector('[data-for="box-style"]').hidden = !box && !batchColor;
    if (box) {
      if (document.activeElement !== cssField) cssField.value = edits[key()]?.boxStyle ?? editableStyle(selected).cssText;
      const borders = borderSides(style);
      const detected = frameType(style, borders);
      const fill = selected.style.getPropertyValue("--layout-fill");
      const type = ["none", "fill", "rounded"].includes(detected) && ["fill", "rounded"].includes(fill) ? fill : detected;
      addFrameChoice(type, style);
      for (const button of frameChoices.children) button.setAttribute("aria-pressed", String(button.value === type));
      const visible = { box: type !== "none", border: borders.length, edge: type === "edge", shadow: type === "shadow" };
      for (const row of frameChoices.parentElement.querySelectorAll("[data-frame-options]")) row.hidden = !visible[row.dataset.frameOptions];
      if (borders.length) {
        showNumber(input("frameStroke"), parseFloat(style["border" + borders[0] + "Width"]));
        input("frameLine").value = style["border" + borders[0] + "Style"];
        input("frameEdge").value = borders[0];
      }
      if (type === "shadow") input("frameShadow").value = style.boxShadow;
      for (const [field, value] of [["frameRadius", style.borderRadius], ["framePadding", style.padding]]) {
        showNumber(input(field), /^\d+(?:\.\d+)?px$/.test(value) ? parseFloat(value) : "");
        input(field).placeholder = input(field).value ? "" : t("混合", "Mixed");
      }
      colorTarget.querySelector('[value="border-color"]').disabled = !borders.length;
      if (colorTarget.selectedOptions[0].disabled) colorTarget.value = "background-color";
      updateSwatches();
      const frame = originals.get(selected).frame;
      showNumber(input("boxWidth"), frame.offsetWidth);
      showNumber(input("boxHeight"), frame.offsetHeight);
    }
    const image = members.length === 1 && selected.matches("img");
    bar.querySelector('[data-for="image"]').hidden = !image;
    if (image) {
      const edit = { ...originals.get(selected).initial, ...edits[key()] };
      showNumber(input("angle"), edit.angle ?? 0);
      showNumber(input("radius"), edit.radius ?? Math.round(parseFloat(style.borderTopLeftRadius) || 0));
      for (const field of cropInputs) {
        const value = edit.crop?.[field.dataset.crop] ?? 0;
        if (field.valueAsNumber !== value) field.value = value;
      }
      action("crop").textContent = cropping ? t("完成裁剪", "Done cropping") : t("鼠标裁剪", "Crop on canvas");
      action("crop").setAttribute("aria-pressed", String(cropping));
    }
    action("group").disabled = members.length < 2 || Boolean(grouped());
    action("ungroup").disabled = !members.some(groupOf);
    for (const button of formatButtons) {
      const name = button.dataset.act;
      const active = styles.filter(s => {
        if (name === "bold") return Number(s.fontWeight) >= 600;
        if (name === "italic") return s.fontStyle !== "normal";
        return s.textDecorationLine.split(" ").includes(name);
      }).length;
      button.disabled = !texts.length;
      button.setAttribute("aria-pressed", active === 0 ? "false" : active === styles.length ? "true" : "mixed");
    }
    const alignments = new Set();
    alignGroup.hidden = !texts.length || !texts.every(el => {
      const { display, textAlign, direction } = getComputedStyle(el);
      if (!["block", "inline-block", "flow-root", "list-item", "table-cell"].includes(display)) return false;
      let align = textAlign;
      if (align === "start") align = direction === "rtl" ? "right" : "left";
      if (align === "end") align = direction === "rtl" ? "left" : "right";
      alignments.add(align);
      return true;
    });
    for (const button of alignButtons) {
      button.setAttribute("aria-pressed", String(!alignGroup.hidden && alignments.size === 1 && alignments.has(button.dataset.align)));
    }
    zoom.disabled = !selected;
    showNumber(zoom, selected ? edits[key()]?.zoom ?? 100 : "");
    action("reset").disabled = !members.some(el => Object.keys(edits[keys.get(el)] || {}).some(k => k !== "add" && k !== "group"));
    action("copy").disabled = action("delete").disabled = !selected;
    action("paste").disabled = !clipboard;
    action("preview").disabled = saving || pendingImports > 0;
    action("center-x").disabled = action("center-y").disabled = !selected;
    const index = Reveal.getSlidePastCount() + 1;
    const count = Reveal.getTotalSlides();
    bar.querySelector(".layout-page-count").textContent = index + " / " + count;
    action("prev").disabled = index <= 1;
    action("next").disabled = index >= count;
    bar.querySelector(".layout-kind").textContent = !selected ? "" : members.length > 1 ? (grouped() ? t("组合 · ", "Group · ") : "") + members.length + t(" 个对象", " objects") :
      kind(selected);
    bar.querySelector(".layout-controls").hidden = !selected;
    bar.querySelector('[data-for="text"]').hidden = !texts.length;
    bar.querySelector(".layout-hint").textContent = !selected
      ? t("从空白处拖动框选，按住 Shift 可追加选择。", "Drag from empty space to select objects. Hold Shift to add to the selection.")
      : (box ? t("拖动任一角点可调整宽高。", "Drag any corner to change width and height.")
             : t("拖动任一角点可等比缩放。", "Drag any corner to scale proportionally.")) +
        t("按住 Alt 可暂停吸附。", " Hold Alt to pause snapping.") +
        (box && originals.get(selected).text !== null ? t("双击可改字。", " Double-click to edit text.") : "");
    updateStatus(message);
  }

  function unsavedText() {
    return Boolean(typing && typing.el.innerText !== typing.before) ||
      [...content.querySelectorAll("textarea,.layout-cite-field")].some(field => (field.value ?? field.innerText) !== field.defaultValue);
  }
  function updateStatus(message) {
    const pendingText = unsavedText();
    updateHistoryButtons(pendingText);
    const unsaved = dirty() || pendingText || (!sourceForm.hidden && drafts.has(Reveal.getCurrentSlide()?.id));
    status.classList.toggle("is-dirty", unsaved || saving);
    status.textContent = message || (saving ? t("保存中…", "Saving…") : unsaved ? t("未保存", "Unsaved") : t("已同步", "Up to date"));
    action("save").disabled = saving || !unsaved;
  }
  stage.addEventListener("input", () => updateStatus());
  content.addEventListener("input", () => updateStatus());

  function write(id, value) {
    putEdit(edits, id, value);
    apply(id, value);
  }

  function commit(entries, nextSelection = members.map(el => keys.get(el)), batch) {
    const settings = entries.find(([id]) => id === settingsKey)?.[1] ?? edits[settingsKey];
    if (settings?.footerSync !== false) {
      const expanded = new Map(entries);
      for (const [id, value] of entries) {
        for (const ids of footerIds.values()) {
          if (!ids.includes(id)) continue;
          const style = footerStyle(value);
          for (const peer of ids) if (peer !== id) expanded.set(peer, withFooterStyle(edits[peer], style));
        }
      }
      entries = [...expanded];
    }
    const updates = entries.filter(([id, value]) => JSON.stringify(edits[id] || {}) !== JSON.stringify(value));
    if (!updates.length) return;
    if (sourceForm.contains(document.activeElement)) stage.focus({ preventScroll: true });
    sourceHistoryActive = false;
    const last = history.at(-1);
    if (batch && last?.batch === batch && nextSelection.length === last.newSelection.length &&
        nextSelection.every((id, i) => id === last.newSelection[i])) {
      last.after = entries;
    } else {
      history.push({ before: entries.map(([id]) => [id, edits[id] || {}]), after: updates, batch,
        oldSelection: members.map(el => keys.get(el)), newSelection: nextSelection });
    }
    future.length = 0;
    updates.forEach(([id, value]) => write(id, value));
    syncCitations();
    selectMany(nextSelection.map(id => objects.get(id)));
  }

  function change(changes, batch) {
    commit(members.map(el => {
      const id = keys.get(el), before = edits[id] || {};
      if (changes !== null) return [id, { ...before, ...changes }];
      const reset = before.add ? { add: before.add } : {};
      if (before.group) reset.group = before.group;
      return [id, reset];
    }), undefined, batch);
  }

  function undo(redo = false) {
    const entry = (redo ? future : history).pop();
    if (!entry) return;
    (redo ? history : future).push(entry);
    const values = redo ? entry.after : entry.before;
    if (redo) {
      const current = Reveal.getCurrentSlide().id;
      const pages = values.map(([id]) => id === settingsKey ? current : JSON.parse(id)[0]);
      if (!pages.includes(current)) {
        const { h, v } = Reveal.getIndices(document.getElementById(pages[0]));
        Reveal.slide(h, v);
        sourceHistoryActive = false;
      }
    }
    values.forEach(([id, value]) => write(id, value));
    syncCitations();
    selectMany((redo ? entry.newSelection : entry.oldSelection).map(id => objects.get(id)));
  }

  async function save() {
    if (saving || !dirty()) return;
    const snapshot = structuredClone(edits);
    const file = serializeEdits();
    saving = true;
    refresh();
    let message;
    try {
      const result = await fetch("/save-layout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previous: savedFile, edits: file })
      });
      if (!result.ok) throw new Error(result.status === 409 ?
        t("其他窗口已保存，请刷新核对", "Another window saved changes. Refresh to review.") : t("保存失败，请用 ./preview.sh --edit 启动", "Save failed. Start the editor with ./preview.sh --edit."));
      saved = snapshot;
      savedFile = file;
    } catch (error) { message = error.message; }
    saving = false;
    refresh(message);
  }

  function selectMany(elements) {
    if (document.activeElement === cssField && (elements.length !== 1 || elements[0] !== selected)) cssField.blur();
    if (content.contains(document.activeElement)) document.activeElement.blur();
    members.forEach(el => el.classList.remove("layout-selected"));
    selectionFrames.forEach(frame => frame.remove());
    const groups = new Set(elements.filter(Boolean).map(groupOf).filter(Boolean));
    const expanded = groups.size ? [...elements, ...[...objects.values()].filter(el => groups.has(groupOf(el)))] : elements;
    members = [...new Set(expanded)].filter(el => el && Reveal.getCurrentSlide()?.contains(el) && !el.closest(".layout-deleted"));
    if (members.length !== 1 || members[0] !== selected) cropping = false;
    selected = members.at(-1) || null;
    selectionFrames = members.map(el => {
      el.classList.add("layout-selected");
      const frame = document.createElement("div");
      frame.className = "layout-selection";
      document.body.append(frame);
      return frame;
    });
    if (selected && ![...layers.options].some(option => option.value === key())) {
      if (isFrame(selected)) listLayers();
      else layers.add(new Option(layerName(selected), key()));
    }
    layers.value = key() || "";
    showContent();
    refresh();
  }
  function select(el) { selectMany(el ? [el] : []); }

  function objectAt(target) {
    for (let el = target; el && el !== Reveal.getCurrentSlide(); el = el.parentElement)
      if (keys.has(el) && groupOf(el)) return el;
    for (let el = target; el && el !== Reveal.getCurrentSlide(); el = el.parentElement) {
      if (keys.has(el) && Reveal.getCurrentSlide()?.contains(el) &&
          (isText(el) || isMedia(el) || isFrame(el) || el.closest("svg,math") || members.includes(el))) return el;
    }
    return null;
  }

  function finishText(cancel = false) {
    if (!typing) return;
    const { el, before, nodes } = typing;
    typing = null;
    const value = el.innerText;
    el.removeAttribute("contenteditable");
    el.classList.remove("layout-cite-field");
    el.replaceChildren(...nodes);
    closeCites();
    if (!cancel && value !== before) change({ text: value });
    refresh();
  }

  const slides = canvas.querySelector(".slides");
  const anchors = (box, axis) => axis === 0
    ? [box.left, (box.left + box.right) / 2, box.right]
    : [box.top, (box.top + box.bottom) / 2, box.bottom];

  function parentScale(el) {
    // A caption can live inside a video frame resized in the editor.
    if (el.ownerSVGElement) return Math.abs(el.ownerSVGElement.getScreenCTM().a) || Reveal.getScale();
    let scale = Reveal.getScale();
    for (let p = originals.get(el).frame.parentElement; p && p !== slides; p = p.parentElement) {
      const value = parseFloat(getComputedStyle(p).scale);
      if (Number.isFinite(value)) scale *= value;
    }
    return scale;
  }

  function center(axis) {
    if (!selected) return;
    const distance = anchors(canvas.getBoundingClientRect(), axis)[1] - anchors(groupBox(), axis)[1];
    const prop = axis === 0 ? "x" : "y";
    commit(members.map(el => {
      const id = keys.get(el), before = edits[id] || {};
      return [id, { ...before, [prop]: round((before[prop] || 0) + distance / parentScale(el)) }];
    }));
  }
  action("center-x").onclick = () => center(0);
  action("center-y").onclick = () => center(1);

  function hideGuides() {
    for (const line of guides) line.hidden = true;
  }

  function snapType(el) {
    return isMedia(el) ? el.localName : textBox(el) ? "text" : null;
  }

  function snapTargets() {
    const slide = Reveal.getCurrentSlide();
    const frames = members.map(item => originals.get(item).frame);
    const peers = [];
    for (const peer of objects.values()) {
      if (!slide.contains(peer) || peer.closest(".layout-deleted") || !peer.getClientRects().length) continue;
      const peerFrame = originals.get(peer).frame;
      if (frames.some(frame => frame.contains(peerFrame) || peerFrame.contains(frame))) continue;
      if (getComputedStyle(peer).visibility !== "visible") continue;
      const box = bounds(peer);
      if (box.width && box.height) peers.push({ box, type: snapType(peer) });
    }
    const type = snapType(selected);
    return { page: canvas.getBoundingClientRect(), peers, type: members.every(el => snapType(el) === type) ? type : null };
  }

  function snap(box, axis, targets, activeEdge) {
    const moving = anchors(box, axis);
    const [start, , end] = anchors(box, 1 - axis);
    let best;
    function consider(edge, source, rank, gap, peer) {
      const offset = edge - source, distance = Math.abs(offset);
      if (distance > 8) return;
      if (!best || rank < best.rank || rank === best.rank &&
          (distance < best.distance || distance === best.distance && gap < best.gap)) {
        best = { edge, offset, distance, rank, gap, peer };
      }
    }
    const { page, peers, type } = targets;
    consider(anchors(page, axis)[1], moving[activeEdge ?? 1], 1, 0, page);
    for (const peer of peers) {
      const [lo, , hi] = anchors(peer.box, 1 - axis);
      const gap = Math.max(0, lo - end, start - hi);
      const near = gap <= (axis === 0 ? page.height : page.width) * 0.15;
      const rank = near && peer.type && peer.type === type ? 0 : 2;
      const edges = anchors(peer.box, axis);
      if (activeEdge != null) {
        for (const edge of edges) consider(edge, moving[activeEdge], rank, gap, peer.box);
      } else {
        for (let i = 0; i < 3; i++) consider(edges[i], moving[i], rank, gap, peer.box);
        if (near) {
          consider(edges[2], moving[0], rank, gap, peer.box);
          consider(edges[0], moving[2], rank, gap, peer.box);
        }
      }
    }
    return best;
  }

  function showGuide(axis, box, best) {
    const line = guides[axis];
    line.hidden = !best;
    if (!best) return;
    const [start, , end] = anchors(box, 1 - axis);
    const [lo, , hi] = anchors(best.peer, 1 - axis);
    const from = Math.min(start, lo), length = Math.max(end, hi) - from;
    line.style.left = (axis === 0 ? best.edge : from) + "px";
    line.style.top = (axis === 0 ? from : best.edge) + "px";
    if (axis === 0) line.style.height = length + "px";
    else line.style.width = length + "px";
  }

  function marqueeTargets() {
    const targets = [];
    for (const el of Reveal.getCurrentSlide().querySelectorAll("*")) {
      if (!keys.has(el) || el.closest(".layout-deleted") || !el.getClientRects().length) continue;
      const frame = originals.get(el).frame, group = groupOf(el);
      if (!group && !isMedia(el) && !isText(el) && !isFrame(el) && el.childElementCount &&
          !el.matches("svg,math,table") && !frame.classList.contains("layout-added")) continue;
      if (getComputedStyle(el).visibility !== "visible") continue;
      const rect = bounds(el);
      if (rect.width && rect.height) targets.push({ el, frame, group, rect });
    }
    return targets;
  }

  function updateMarquee(event) {
    const { x, y, outline, initial } = marquee;
    const left = Math.min(x, event.clientX), top = Math.min(y, event.clientY);
    const right = Math.max(x, event.clientX), bottom = Math.max(y, event.clientY);
    if (!marquee.targets && Math.hypot(right - left, bottom - top) < 4) return;
    marquee.targets ??= marqueeTargets();
    outline.hidden = false;
    Object.assign(outline.style, { left: left + "px", top: top + "px",
      width: (right - left) + "px", height: (bottom - top) + "px" });

    const inside = ({ rect }) => rect.left >= left && rect.right <= right && rect.top >= top && rect.bottom <= bottom;
    const incomplete = new Set(marquee.targets.filter(t => t.group && !inside(t)).map(t => t.group));
    const blocked = marquee.targets.filter(t => incomplete.has(t.group));
    const hits = marquee.targets.filter(t => inside(t) &&
      !blocked.some(b => b.frame.contains(t.frame) || t.frame.contains(b.frame)));
    // A video and its label, or a table and its cells, move once as a unit.
    const next = [...initial];
    for (const { el, frame } of hits) {
      if (hits.some(t => t.frame !== frame && t.frame.contains(frame))) continue;
      if (!next.some(item => {
        const other = originals.get(item).frame;
        return frame.contains(other) || other.contains(frame);
      })) next.push(el);
    }
    if (next.length !== members.length || next.some(el => !members.includes(el))) selectMany(next);
  }

  function finishMarquee(accept, event) {
    if (!marquee || (event && event.pointerId !== marquee.id)) return;
    if (accept) updateMarquee(event);
    const { id, outline, previous, initial, clicked, targets } = marquee;
    marquee = null;
    outline.remove();
    if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
    if (!accept) selectMany(previous);
    else if (!targets && clicked) {
      const frame = originals.get(clicked).frame, group = groupOf(clicked);
      if (previous.includes(clicked)) selectMany(previous.filter(el => el !== clicked && !(group && groupOf(el) === group)));
      else selectMany([...previous.filter(el => {
        const other = originals.get(el).frame;
        return !frame.contains(other) && !other.contains(frame);
      }), clicked]);
    } else if (!targets) selectMany(initial);
  }

  stage.addEventListener("pointerdown", event => {
    if (event.button !== 0 || resize || drag || marquee || typing?.el.contains(event.target) ||
        event.target.closest("button,.controls,.slide-menu-button")) return;
    stage.focus({ preventScroll: true });
    sourceHistoryActive = false;
    updateHistoryButtons();
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    let clicked = objectAt(event.target);
    if (clicked && textBox(clicked) && !groupOf(clicked)) {
      const r = bounds(clicked);
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) clicked = null;
    }
    if (!additive && (clicked || selected && !isText(selected) && selected.contains(event.target))) return;
    finishText();
    const outline = document.createElement("div");
    outline.className = "layout-marquee";
    outline.hidden = true;
    document.body.append(outline);
    marquee = { id: event.pointerId, x: event.clientX, y: event.clientY, outline, clicked,
      previous: [...members], initial: additive ? [...members] : [] };
    stage.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }, true);
  stage.addEventListener("pointermove", event => {
    if (marquee?.id === event.pointerId) updateMarquee(event);
  });
  stage.addEventListener("pointerup", event => finishMarquee(true, event));
  stage.addEventListener("lostpointercapture", event => finishMarquee(false, event));
  stage.addEventListener("pointercancel", event => finishMarquee(false, event));

  slides.addEventListener("pointerdown", event => {
    if (event.button !== 0 || resize || drag || typing?.el.contains(event.target)) return;
    finishText();
    let el = objectAt(event.target);
    if (selected && (isFrame(selected) || !isText(selected) && !isMedia(selected)) && selected.contains(event.target)) el = selected;
    if (!el) return;
    if (cropping && el === selected) { event.preventDefault(); event.stopPropagation(); return; }
    if (!members.includes(el)) select(el);
    event.stopPropagation();
    event.preventDefault();
    const items = members.map(item => {
      const id = keys.get(item);
      return { id, previous: edits[id] || {}, scale: parentScale(item) };
    });
    drag = { items, targets: snapTargets(), clicked: el, id: event.pointerId,
      startX: event.clientX, startY: event.clientY, box: groupBox() };
    el.setPointerCapture(event.pointerId);
  }, true);

  function updateDrag(event) {
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!drag.updates && Math.hypot(dx, dy) < 4) return;
    const box = new DOMRect(drag.box.left + dx, drag.box.top + dy, drag.box.width, drag.box.height);
    const matches = [0, 1].map(axis => !event.altKey && snap(box, axis, drag.targets));
    matches.forEach((match, axis) => showGuide(axis, box, match));
    const x = dx + (matches[0]?.offset || 0), y = dy + (matches[1]?.offset || 0);
    drag.updates = drag.items.map(({ id, previous, scale }) => [id, { ...previous,
      x: round((previous.x || 0) + x / scale), y: round((previous.y || 0) + y / scale) }]);
    drag.updates.forEach(([id, value]) => apply(id, value));
    placeHandle();
  }
  function endDrag(keep) {
    if (!drag) return;
    const { items, updates, clicked } = drag;
    drag = null;
    hideGuides();
    if (keep && updates) commit(updates);
    else {
      items.forEach(({ id, previous }) => apply(id, previous));
      if (keep && members.length > 1) select(clicked);
    }
    placeHandle();
  }
  slides.addEventListener("pointermove", event => {
    if (drag?.id === event.pointerId) updateDrag(event);
  });
  slides.addEventListener("pointerup", event => {
    if (drag?.id !== event.pointerId) return;
    updateDrag(event);
    endDrag(true);
  });
  slides.addEventListener("lostpointercapture", event => {
    if (drag?.id === event.pointerId) endDrag(false);
  });
  function scaleItems() {
    return members.map(el => ({ id: keys.get(el), before: edits[keys.get(el)] || {},
      rect: bounds(el), scale: parentScale(el) }));
  }
  function scaleFromCorner(items, box, factor) {
    // All members use the same factor so spacing and relative sizes are preserved.
    const min = Math.max(...items.map(({before}) => 10 / (before.zoom ?? 100)));
    const max = Math.min(...items.map(({before}) => 500 / (before.zoom ?? 100)));
    factor = Math.max(min, Math.min(max, factor));
    return items.map(({id, before, rect, scale}) => [id, { ...before,
      zoom: round((before.zoom ?? 100) * factor),
      x: round((before.x || 0) + (rect.left + rect.width / 2 - box.left) * (factor - 1) / scale),
      y: round((before.y || 0) + (rect.top + rect.height / 2 - box.top) * (factor - 1) / scale) }]);
  }
  for (const handle of handles) handle.onpointerdown = event => {
    if (event.button !== 0 || !selected || resize || drag || marquee) return;
    event.preventDefault();
    const box = groupBox(), items = scaleItems(), targets = snapTargets();
    if (!box.width || !box.height) return;
    const west = handle.dataset.corner.endsWith("w"), north = handle.dataset.corner.startsWith("n");
    const sx = west ? -1 : 1, sy = north ? -1 : 1;
    const anchorX = west ? box.right : box.left, anchorY = north ? box.bottom : box.top;
    const text = members.length === 1 && canSizeBox(selected) ? selected : null;
    const frame = originals.get(selected).frame;
    const frameRect = frame.getBoundingClientRect();
    const style = getComputedStyle(frame);
    const cssWidth = parseFloat(style.width) || frame.offsetWidth, cssHeight = parseFloat(style.height) || frame.offsetHeight;
    let result;
    resize = { text, cancel };
    handle.setPointerCapture(event.pointerId);

    function update(move) {
      if (move.pointerId !== event.pointerId) return;
      const dx = sx * (move.clientX - event.clientX), dy = sy * (move.clientY - event.clientY);
      if (!result && !dx && !dy) return;
      let width = Math.max(1, box.width + dx), height = Math.max(1, box.height + dy);
      let factor = 1 + (dx * box.width + dy * box.height) / (box.width ** 2 + box.height ** 2);
      if (!text) {
        width = box.width * factor;
        height = box.height * factor;
      }
      const proposed = new DOMRect(west ? anchorX - width : anchorX, north ? anchorY - height : anchorY, width, height);
      const edges = [west ? 0 : 2, north ? 0 : 2];
      const matches = edges.map((edge, axis) => !move.altKey && snap(proposed, axis, targets, edge));
      if (text) {
        const { id, before, scale } = items[0];
        const visualScale = scale * (parseFloat(style.scale) || 1);
        width += sx * (matches[0]?.offset || 0);
        height += sy * (matches[1]?.offset || 0);
        const boxWidth = Math.max(1, round(cssWidth + (width - frameRect.width) / visualScale));
        const boxHeight = Math.max(1, round(cssHeight + (height - frameRect.height) / visualScale));
        result = [[id, { ...before, boxWidth, boxHeight }]];
        input("boxWidth").value = Math.round(boxWidth);
        input("boxHeight").value = Math.round(boxHeight);
      } else {
        // One factor preserves the aspect ratio. Choose the best reachable guide.
        const candidates = matches.flatMap((match, axis) => match ? [{ ...match,
          delta: match.offset / (axis === 0 ? sx * box.width : sy * box.height) }] : []);
        candidates.sort((a, b) => a.rank - b.rank || Math.abs(a.delta) - Math.abs(b.delta));
        factor += candidates[0]?.delta || 0;
        result = scaleFromCorner(items, box, factor);
        factor = result[0][1].zoom / (items[0].before.zoom ?? 100);
        zoom.value = result.find(([id]) => id === key())[1].zoom;
      }
      // Measure after reflow: text wrapping, centering and transform origins can move the fixed corner.
      result.forEach(([id, value]) => apply(id, value));
      const actual = result.map(([id]) => bounds(objects.get(id)));
      result.forEach(([id, value], i) => {
        const { rect, scale } = items[i];
        const fixedX = west ? "right" : "left", fixedY = north ? "bottom" : "top";
        const x = text ? anchorX : anchorX + (rect[fixedX] - anchorX) * factor;
        const y = text ? anchorY : anchorY + (rect[fixedY] - anchorY) * factor;
        value.x = round((value.x || 0) + (x - actual[i][fixedX]) / scale);
        value.y = round((value.y || 0) + (y - actual[i][fixedY]) / scale);
        apply(id, value);
      });
      const final = groupBox();
      matches.forEach((match, axis) => showGuide(axis, final,
        match && Math.abs(anchors(final, axis)[edges[axis]] - match.edge) < 1 && match));
      placeHandle();
    }
    function cancel() {
      resize = null;
      handle.onpointermove = handle.onpointerup = handle.onlostpointercapture = handle.onpointercancel = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      items.forEach(({ id, before }) => apply(id, before));
      hideGuides();
      refresh();
    }
    handle.onpointermove = update;
    handle.onlostpointercapture = handle.onpointercancel = cancel;
    handle.onpointerup = up => {
      if (up.pointerId !== event.pointerId) return;
      update(up);
      cancel();
      if (result) commit(result);
    };
  };
  slides.addEventListener("click", event => {
    if (typing?.el.contains(event.target)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
  }, true);
  slides.addEventListener("dblclick", event => {
    const el = objectAt(event.target);
    if (el?.matches("img") && !groupOf(el)) {
      event.preventDefault();
      event.stopPropagation();
      select(el);
      action("crop").click();
      return;
    }
    if (!el || !isText(el) || groupOf(el)) return;
    event.stopPropagation();
    event.preventDefault();
    if (originals.get(el).text !== null && el instanceof HTMLElement) startText(el);
    else { select(el); content.querySelector("textarea,[contenteditable]")?.focus(); }
  }, true);

  function startText(el) {
    select(el);
    typing = { el, before: citations.source(el), nodes: [...el.childNodes] };
    editCitations(el, typing.before);
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    el.addEventListener("blur", () => finishText(), { once: true });
    refresh(t("回车完成 · Esc 取消", "Enter to finish · Esc to cancel"));
  }

  // Store copies in slide coordinates so pasting also works on a different slide.
  function snapshot(el) {
    const frame = originals.get(el).frame;
    const rotation = frame.style.rotate;
    if (el.matches("img") && rotation) frame.style.rotate = "none";
    const box = bounds(el), scale = Reveal.getScale(), slide = Reveal.getCurrentSlide().getBoundingClientRect();
    if (el.matches("img") && rotation) frame.style.rotate = rotation;
    const base = { left: round((box.left - slide.left) / scale), top: round((box.top - slide.top) / scale),
      width: Math.max(1, round(box.width / scale)) };
    const style = getComputedStyle(el);
    if (el.classList.contains("layout-background")) return { ...edits[keys.get(el)].add, ...base, height: round(box.height / scale) };
    if (!isMedia(el) && (isFrame(el) || el.childElementCount && originals.get(el).text === null || !isText(el) || !(el instanceof HTMLElement))) {
      const parts = {};
      [el, ...el.querySelectorAll("*")].forEach((node, i) => {
        const patch = { ...originals.get(node)?.initial, ...edits[keys.get(node)] };
        delete patch.add;
        if (!i) { delete patch.x; delete patch.y; delete patch.zoom; }
        if (Object.keys(patch).length) parts[i] = patch;
      });
      const spec = { ...base, kind: "element", source: originals.get(el).source || keys.get(el),
        label: layerName(el), height: Math.max(1, round(box.height / scale)), parts };
      if (el.ownerSVGElement) {
        const b = el.getBBox();
        spec.viewBox = [b.x, b.y, Math.max(1, b.width), Math.max(1, b.height)].join(" ");
      }
      return spec;
    }
    if (!isMedia(el)) {
      if (frame.classList.contains("layout-textbox") && frame.style.width === "fit-content") delete base.width;
      const size = parseFloat(style.fontSize);
      const visualSize = size * parentScale(el) / scale * (edits[keys.get(el)]?.zoom ?? 100) / 100;
      return { ...base, kind: "text", content: el.querySelector(".citation") ? citations.source(el) : el.innerText, size: visualSize, weight: Number(style.fontWeight),
        italic: style.fontStyle !== "normal", lines: style.textDecorationLine,
        ...(frame.style.height ? { height: round(box.height / scale) } : {}),
        color: style.color, align: style.textAlign, leading: parseFloat(style.lineHeight) / size || 1.3 };
    }
    const caption = frame.querySelector("figcaption,.video-label,.teleop-tag,.layout-media-tag,.layout-media-bottom");
    return { ...base, kind: el.localName, src: el.dataset.layoutLogo || el.dataset.src || el.getAttribute("src")
        || el.querySelector("source")?.getAttribute("src") || el.currentSrc,
      height: round(box.height / scale), fit: style.objectFit,
      ...(el.matches("video") && parseFloat(getComputedStyle(frame).borderTopWidth) > 0 ?
        { border: getComputedStyle(frame).borderTop, borderRadius: getComputedStyle(frame).borderTopLeftRadius } : {}),
      label: el.alt || el.getAttribute("aria-label") || "", caption: caption?.innerText || "",
      status: frame.querySelector(".video-status,.layout-media-status")?.innerText || "",
      bottom: Boolean(frame.closest(".bottom-captions") || caption?.matches(".layout-media-bottom")) };
  }

  function copySelection() {
    if (!selected) return;
    clipboard = members.map(el => {
      const { family, angle, crop, radius, boxStyle, group } = { ...originals.get(el).initial, ...edits[keys.get(el)] };
      return { ...snapshot(el), format: { family, angle, crop, radius, boxStyle }, group };
    });
    pasteCount = 0;
    refresh(t("已复制 " + clipboard.length + " 个对象", "Copied " + clipboard.length + (clipboard.length === 1 ? " object" : " objects")));
  }
  function insertCopies(specs, offset) {
    const slide = Reveal.getCurrentSlide();
    const groups = new Map();
    const entries = specs.map(({format, group, ...spec}) => {
      const id = JSON.stringify([slide.id, "added", crypto.randomUUID()]);
      if (group && !groups.has(group)) groups.set(group, crypto.randomUUID());
      return [id, { ...Object.fromEntries(Object.entries(format || {}).filter(([,v]) => v !== undefined)),
        ...(group ? { group: groups.get(group) } : {}), add: { ...spec, left: spec.left + offset, top: spec.top + offset } }];
    });
    commit(entries, entries.map(([id]) => id));
  }

  function newText(content = t("文本框", "Text box"), edit = true) {
    const page = Reveal.getCurrentSlide();
    const slide = page.getBoundingClientRect(), screen = canvas.getBoundingClientRect();
    const scale = Reveal.getScale();
    insertCopies([{ kind: "text", content, size: 32, weight: 400, leading: 1.35,
      color: getComputedStyle(page.querySelector("h1,h2") || page).color, align: "left", left: round((screen.x + screen.width / 2 - slide.x) / scale),
      top: round((screen.y + screen.height / 2 - slide.y) / scale) }], 0);
    if (edit) startText(selected);
  }

  action("background").disabled = !framePicker.options.length;
  action("background").onclick = () => {
    const screen = canvas.getBoundingClientRect(), slide = Reveal.getCurrentSlide().getBoundingClientRect();
    const width = 360, height = 160, scale = Reveal.getScale();
    insertCopies([{ kind: "background", label: framePicker.selectedOptions[0].text, decoration: frameStyles.get(framePicker.value),
      width, height, left: round((screen.x + screen.width / 2 - slide.x) / scale - width / 2),
      top: round((screen.y + screen.height / 2 - slide.y) / scale - height / 2) }], 0);
  };

  async function uploadFile(file) {
    if (file.size > 512 * 1024 ** 2) throw new Error(t("单个文件最大为 512 MB", "The file size limit is 512 MB."));
    const response = await fetch("/insert-media", { method: "POST", body: file });
    if (!response.ok) throw new Error(response.status === 415 ? t("暂不支持该文件格式", "Unsupported file format.") : t("导入失败，请检查本地编辑服务", "Import failed. Check the local editor service."));
    return (await response.json()).src;
  }
  const fileInput = bar.querySelector('.layout-header input[type="file"]');
  const mediaFormats = { image: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"], video: [".mp4", ".m4v", ".webm", ".mov"] };
  for (const [button, extensions] of Object.entries(mediaFormats)) {
    action(button).onclick = () => {
      fileInput.accept = extensions.join(",");
      fileInput.click();
    };
  }
  fileInput.onchange = () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    if (files.length) importMedia(files);
  };

  async function readMedia(file) {
    const kind = Object.keys(mediaFormats).find(kind => file.type.startsWith(kind + "/") ||
      mediaFormats[kind].some(ext => file.name.toLowerCase().endsWith(ext)));
    if (!kind) throw new Error(t("暂不支持该文件格式", "Unsupported file format."));
    const type = kind === "image" ? "img" : "video";
    const media = document.createElement(type), url = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        media[type === "img" ? "onload" : "onloadedmetadata"] = resolve;
        media.onerror = () => reject(new Error(t("浏览器无法读取该媒体，请检查文件格式或编码", "Cannot read this media. Check its format or encoding.")));
        media.preload = "metadata";
        media.src = url;
      });
      const w = media.naturalWidth || media.videoWidth, h = media.naturalHeight || media.videoHeight;
      if (!w || !h) throw new Error(t("无法读取媒体尺寸", "Cannot read media dimensions."));
      const src = await uploadFile(file);
      const config = Reveal.getConfig(), factor = Math.min(1, config.width * 0.55 / w, config.height * 0.6 / h);
      return { kind: type, label: file.name, src, fit: "contain", width: round(w * factor), height: round(h * factor) };
    } finally {
      media.removeAttribute("src");
      if (type === "video") media.load();
      URL.revokeObjectURL(url);
    }
  }

  async function importMedia(files, point) {
    const page = Reveal.getCurrentSlide(), slide = page.getBoundingClientRect();
    const screen = canvas.getBoundingClientRect(), scale = Reveal.getScale();
    const x = point ? Math.max(screen.left, Math.min(point.clientX, screen.right)) : screen.x + screen.width / 2;
    const y = point ? Math.max(screen.top, Math.min(point.clientY, screen.bottom)) : screen.y + screen.height / 2;
    const entries = [], errors = [];
    pendingImports++;
    try {
      for (const file of files) {
        refresh(t("正在导入 ", "Importing ") + file.name + "…");
        try {
          const add = await readMedia(file), offset = entries.length * 20;
          add.left = round((x - slide.left) / scale - add.width / 2 + offset);
          add.top = round((y - slide.top) / scale - add.height / 2 + offset);
          entries.push([JSON.stringify([page.id, "added", crypto.randomUUID()]), { add }]);
        } catch (error) { errors.push(file.name + " · " + error.message); }
      }
      const onPage = page === Reveal.getCurrentSlide();
      if (entries.length) commit(entries, onPage ? entries.map(([id]) => id) : undefined);
      if (errors.length) refresh(errors.join(" / "));
      else if (!onPage) refresh(t("已插入到「" + page.id + "」", "Inserted on slide “" + page.id + "”"));
    } finally {
      pendingImports--;
      action("preview").disabled = saving || pendingImports > 0;
    }
  }

  stage.addEventListener("dragover", event => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  stage.addEventListener("drop", event => {
    const files = [...event.dataTransfer.files];
    if (!files.length) return;
    event.preventDefault();
    finishText();
    stage.focus({ preventScroll: true });
    importMedia(files, event);
  });

  function removeSelection() {
    const entries = [];
    for (const el of members) {
      const id = keys.get(el), before = edits[id] || {};
      entries.push([id, before.add ? {} : { ...before, deleted: true }]);
      if (before.add) {
        for (const child of originals.get(el).frame.querySelectorAll("*")) {
          const childKey = keys.get(child);
          if (childKey !== id && edits[childKey]) entries.push([childKey, {}]);
        }
      }
    }
    commit(entries, []);
  }
  function pasteSelection() {
    if (clipboard) insertCopies(clipboard, 20 * ++pasteCount);
  }
  const clipboardType = "application/x-quarto-slide-objects";
  const clipboardText = () => clipboard.map(s => s.content ?? (s.caption || s.label || s.src)).join("\n");
  action("text").onclick = () => newText();
  action("copy").onclick = () => {
    copySelection();
    navigator.clipboard?.writeText(clipboardText()).catch(() => {});
  };
  action("paste").onclick = pasteSelection;
  action("delete").onclick = removeSelection;
  document.addEventListener("copy", event => {
    if (dialog.open || typing || event.target.closest("input,textarea,[contenteditable]") || !selected) return;
    copySelection();
    event.preventDefault();
    event.clipboardData.setData("text/plain", clipboardText());
    event.clipboardData.setData(clipboardType, "1");
  });
  document.addEventListener("paste", event => {
    if (dialog.open || typing || event.target.closest("input,textarea,[contenteditable]")) return;
    const files = [...event.clipboardData.files];
    if (files.length) {
      event.preventDefault();
      importMedia(files);
      return;
    }
    const plain = event.clipboardData.getData("text/plain");
    if (clipboard && (event.clipboardData.getData(clipboardType) || plain === clipboardText())) {
      event.preventDefault();
      pasteSelection();
    } else if (plain) {
      event.preventDefault();
      newText(plain, false);
    }
  });

  action("group").onclick = () => change({ group: crypto.randomUUID() });
  action("ungroup").onclick = () => commit(members.map(el => {
    const id = keys.get(el), patch = { ...edits[id] };
    delete patch.group;
    return [id, patch];
  }));
  for (const prop of ["angle", "radius", "boxWidth", "boxHeight"]) {
    liveNumber(input(prop), (value, batch) => change({ [prop]: value }, batch));
  }
  const cropInputs = [...bar.querySelectorAll("[data-crop]")];
  action("crop").onclick = () => {
    cropping = !cropping;
    refresh();
  };
  function currentCrop() {
    return edits[key()]?.crop ?? originals.get(selected).initial?.crop ?? [0, 0, 0, 0];
  }
  function paintCrop(crop, width, height) {
    cropBox.style.inset = crop.map(v => v + "%").join(" ");
    cropOverlay.style.setProperty("--crop-mask", crop.map((v, i) => v * (i % 2 ? width : height) / 100 + "px").join(" "));
  }
  function placeCrop(crop = currentCrop()) {
    const rect = selected.getBoundingClientRect();
    const angle = parseFloat(getComputedStyle(originals.get(selected).frame).rotate) || 0;
    const rad = angle * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    // The screen bounding box encloses the rotated image. Recover its local axes for dragging.
    const w = selected.offsetWidth, h = selected.offsetHeight;
    const scale = rect.width / (Math.abs(cos) * w + Math.abs(sin) * h || 1);
    const width = w * scale, height = h * scale;
    Object.assign(cropOverlay.style, { left: rect.left + rect.width / 2 + "px", top: rect.top + rect.height / 2 + "px",
      width: width + "px", height: height + "px", transform: `translate(-50%, -50%) rotate(${angle}deg)` });
    paintCrop(crop, width, height);
    return { width, height, cos, sin };
  }
  cropBox.onpointerdown = event => {
    const edge = event.target.dataset.cropEdge;
    if (!edge || event.button !== 0 || resize) return;
    const { width, height, cos, sin } = placeCrop();
    if (!width || !height) return;
    event.preventDefault();
    const id = key(), before = edits[id] || {}, start = currentCrop();
    let crop;
    resize = { cancel };
    cropBox.setPointerCapture(event.pointerId);
    function update(move) {
      if (move.pointerId !== event.pointerId) return;
      const dx = move.clientX - event.clientX, dy = move.clientY - event.clientY;
      const x = (dx * cos + dy * sin) * 100 / width, y = (dy * cos - dx * sin) * 100 / height;
      crop = [...start];
      for (const [i, side] of ["n", "e", "s", "w"].entries()) {
        if (edge.includes(side)) crop[i] = Math.max(0, Math.min(round(99.9 - start[(i + 2) % 4]), round(start[i] + [y, -x, -y, x][i])));
      }
      paintCrop(crop, width, height);
      cropInputs.forEach((field, i) => { field.value = crop[i]; });
    }
    function cancel() {
      resize = null;
      cropBox.onpointermove = cropBox.onpointerup = cropBox.onpointercancel = cropBox.onlostpointercapture = null;
      if (cropBox.hasPointerCapture(event.pointerId)) cropBox.releasePointerCapture(event.pointerId);
      refresh();
    }
    cropBox.onpointermove = update;
    cropBox.onpointercancel = cropBox.onlostpointercapture = cancel;
    cropBox.onpointerup = up => {
      if (up.pointerId !== event.pointerId) return;
      update(up);
      cancel();
      if (crop.some((v, i) => v !== start[i])) commit([[id, { ...before, crop }]]);
    };
  };
  for (const field of cropInputs) {
    let batch;
    field.onfocus = () => {
      batch = Symbol();
      cropping = true;
      refresh();
    };
    field.oninput = () => {
      const crop = cropInputs.map(f => f.valueAsNumber);
      if (crop.every(n => Number.isFinite(n) && n >= 0) && crop[0] + crop[2] < 100 && crop[1] + crop[3] < 100) {
        change({ crop }, batch);
      } else updateStatus(t("两条相对边的裁剪总量须小于 100%", "Opposing crop values must total less than 100%."));
    };
    field.onblur = () => {
      if (selected?.matches("img")) field.value = currentCrop()[field.dataset.crop];
      updateStatus();
    };
  }
  const paletteList = bar.querySelector(".layout-palettes");
  const groups = [...paletteList.children];
  const orderKey = "slide-editor-palette-order";
  for (const name of (localStorage.getItem(orderKey) || "").split("|").reverse()) {
    const group = groups.find(el => el.dataset.palette === name);
    if (group) paletteList.prepend(group);
  }
  function savePaletteOrder() {
    localStorage.setItem(orderKey, [...paletteList.children].map(el => el.dataset.palette).join("|"));
  }
  for (const group of groups) {
    const grip = group.querySelector(".layout-reorder");
    grip.onpointerdown = event => {
      if (event.button !== 0) return;
      event.preventDefault();
      paletteList.setPointerCapture(event.pointerId);
      group.classList.add("layout-reordering");
      let y = event.clientY, raf;
      function reorder() {
        const rect = paletteList.getBoundingClientRect();
        if (y < rect.top + 22) paletteList.scrollTop -= 5;
        if (y > rect.bottom - 22) paletteList.scrollTop += 5;
        const other = [...paletteList.children].find(el => {
          if (el === group) return false;
          const r = el.getBoundingClientRect();
          return y >= r.top && y <= r.bottom;
        });
        if (other) {
          const r = other.getBoundingClientRect();
          if (y < r.top + r.height / 2 && group.nextElementSibling !== other) other.before(group);
          if (y >= r.top + r.height / 2 && group.previousElementSibling !== other) other.after(group);
        }
        raf = requestAnimationFrame(reorder);
      }
      paletteList.onpointermove = move => { if (move.pointerId === event.pointerId) y = move.clientY; };
      paletteList.onlostpointercapture = () => {
        cancelAnimationFrame(raf);
        group.classList.remove("layout-reordering");
        paletteList.onpointermove = paletteList.onlostpointercapture = null;
        savePaletteOrder();
      };
      raf = requestAnimationFrame(reorder);
    };
  }

  const picker = input("picker"), hex = input("hex");
  function updateSwatches() {
    const batch = members.length > 1 ? selectedTexts().filter(textBox) : null;
    const computed = getComputedStyle(batch ? batch[0] : selected);
    const prop = colorTarget.value;
    let current = computed.getPropertyValue(prop);
    if (prop === "border-color") current = computed["border" + borderSides(computed)[0] + "Color"];
    if (batch?.some(el => getComputedStyle(el).color !== current)) current = "";
    for (const button of swatches) button.setAttribute("aria-pressed", String(button.style.color === current));
    const rgb = current && current.match(/^rgba?\(([^)]+)\)$/);
    const value = rgb ? "#" + rgb[1].split(",").map((n, i) =>
      Math.round(Number(n) * (i === 3 ? 255 : 1)).toString(16).padStart(2, "0")).join("") : "";
    const clear = prop === "border-color"
      ? ["Top", "Right", "Bottom", "Left"].every(side => computed["border" + side + "Style"] === "none" || /, 0\)$/.test(computed["border" + side + "Color"]))
      : value.length === 9 && value.endsWith("00") && (prop !== "background-color" || computed.backgroundImage === "none");
    action("no-color").setAttribute("aria-pressed", String(clear));
    picker.value = value.slice(0, 7) || "#000000";
    hex.value = value;
  }
  function applyColor(color) {
    if (members.length > 1) {
      commit(selectedTexts().filter(textBox).map(el => {
        const style = editableStyle(el);
        style.setProperty("color", color, "important");
        return [keys.get(el), withBoxStyle(el, style.cssText)];
      }));
      return;
    }
    const style = editableFrameStyle(), prop = colorTarget.value;
    if (prop === "background-color" && color === "transparent" && getComputedStyle(selected).backgroundImage !== "none") style.backgroundImage = "none";
    style.setProperty(prop, color, "important");
    commit([[key(), withBoxStyle(selected, style.cssText)]]);
    updateSwatches();
  }
  colorTarget.onchange = updateSwatches;
  async function pickSlidePixel() {
    const slide = Reveal.getCurrentSlide();
    let snapshot;
    try {
      await import("./vendor/html-to-image/html-to-image.js");
      snapshot = await window.htmlToImage.toCanvas(canvas, {
        width: canvas.clientWidth, height: canvas.clientHeight, backgroundColor: "white", skipFonts: true,
        filter: node => !node.matches?.("section.slide,section.stack,.slide-background") ||
          slide.contains(node) || node.contains(slide) || node.classList.contains("present"),
        style: { position: "relative", inset: "auto", margin: "0", transform: "none" }
      });
    } catch (error) {
      if (!window.EyeDropper) throw error;
    }
    const pickerDialog = document.createElement("dialog");
    pickerDialog.className = "layout-pixel-picker";
    const label = snapshot ? t("点击像素取色", "Click a pixel to pick its color") : t("本页预览不可用，可从屏幕取色。", "Preview unavailable. Pick a color from the screen.");
    pickerDialog.setAttribute("aria-label", label);
    pickerDialog.innerHTML = `<header><span>${label}</span><output></output><button type="button" class="ui-button">${t("取消", "Cancel")}</button></header>`;
    if (window.EyeDropper) {
      const systemPicker = document.createElement("button");
      systemPicker.className = "ui-button";
      systemPicker.textContent = t("屏幕取色", "Pick from screen");
      systemPicker.onclick = async () => {
        try { pickerDialog.close((await new EyeDropper().open()).sRGBHex); }
        catch (error) { if (error.name !== "AbortError") systemPicker.disabled = true; }
      };
      pickerDialog.querySelector("header").append(systemPicker);
    }
    bar.append(pickerDialog);
    if (snapshot) {
      pickerDialog.append(snapshot);
      const context = snapshot.getContext("2d");
      const readout = pickerDialog.querySelector("output");
      function pixel(event) {
        const rect = snapshot.getBoundingClientRect();
        const x = Math.min(snapshot.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) * snapshot.width / rect.width)));
        const y = Math.min(snapshot.height - 1, Math.max(0, Math.floor((event.clientY - rect.top) * snapshot.height / rect.height)));
        const [r, g, b] = context.getImageData(x, y, 1, 1).data;
        return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
      }
      snapshot.onpointermove = event => {
        readout.value = pixel(event);
        readout.style.setProperty("--sample", readout.value);
        readout.style.left = Math.min(event.clientX + 14, innerWidth - 104) + "px";
        readout.style.top = Math.min(event.clientY + 16, innerHeight - 34) + "px";
      };
      snapshot.onpointerleave = () => { readout.value = ""; };
      snapshot.onclick = event => pickerDialog.close(pixel(event));
    }
    pickerDialog.querySelector("button").onclick = () => pickerDialog.close();
    pickerDialog.onkeydown = event => event.stopPropagation();
    return new Promise(resolve => {
      pickerDialog.onclose = () => { pickerDialog.remove(); resolve(pickerDialog.returnValue); };
      pickerDialog.showModal();
    });
  }
  action("eyedropper").onclick = async () => {
    const targets = [...members], property = colorTarget.value, button = action("eyedropper");
    button.disabled = true;
    try {
      updateStatus(t("正在准备取色画面…", "Preparing the color sample…"));
      const color = await pickSlidePixel();
      updateStatus();
      if (color && targets.length === members.length && targets.every(el => members.includes(el)) && colorTarget.value === property) applyColor(color);
    } catch (error) {
      if (error.name !== "AbortError") updateStatus(t("未能读取幻灯片颜色，请重新打开吸管。", "Could not read the slide colors. Try the eyedropper again."));
    } finally { button.disabled = false; }
  };
  action("no-color").onclick = () => applyColor("transparent");
  picker.onchange = () => applyColor(picker.value);
  hex.onchange = () => {
    const digits = hex.value.trim().replace(/^#/, "");
    if (/^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(digits)) applyColor("#" + digits);
    else refresh(t("请输入 3、4、6 或 8 位十六进制颜色。", "Enter a 3-, 4-, 6- or 8-digit hex color."));
  };

  for (const button of swatches) {
    button.style.color = button.dataset.color;
    button.onclick = () => applyColor(button.dataset.color);
  }
  cssField.onfocus = () => { cssBatch = Symbol(); };
  cssField.oninput = () => {
    const css = cssField.value.trim();
    const style = document.createElement("span").style;
    style.cssText = css;
    if (css && !style.length) {
      refresh(t("请输入有效的 CSS 声明。", "Enter valid CSS declarations."));
      return;
    }
    const patch = withBoxStyle(selected, css), previous = editableStyle(selected);
    for (const [prop, field] of [["width", "boxWidth"], ["height", "boxHeight"]]) {
      if (style[prop] && style[prop] !== previous[prop]) delete patch[field];
    }
    commit([[key(), patch]], undefined, cssBatch);
  };
  cssField.onblur = () => { cssBatch = undefined; refresh(); };
  family.onchange = () => formatText({ family: family.value });
  liveNumber(size, (value, batch) => formatText({ size: value }, batch));
  let zoomStart;
  liveNumber(zoom, (value, batch) => {
    if (members.length === 1) return change({ zoom: value }, batch);
    if (!zoomStart || zoomStart.batch !== batch || zoomStart.items.length !== members.length || members.some((el, i) => zoomStart.items[i].id !== keys.get(el)))
      zoomStart = { batch, items: scaleItems(), box: groupBox(), zoom: edits[key()]?.zoom ?? 100 };
    commit(scaleFromCorner(zoomStart.items, zoomStart.box, value / zoomStart.zoom), undefined, batch);
  });
  for (const button of formatButtons) {
    button.onclick = () => {
      const name = button.dataset.act, enable = button.getAttribute("aria-pressed") !== "true";
      if (name === "bold") return formatText({ weight: enable ? 700 : 400 });
      if (name === "italic") return formatText({ italic: enable });
      formatText(el => {
        const lines = new Set(getComputedStyle(el).textDecorationLine.split(" "));
        lines.delete("none");
        if (enable) lines.add(name);
        else lines.delete(name);
        return { lines: [...lines].join(" ") || "none" };
      });
    };
  }
  for (const button of alignButtons) {
    button.onclick = () => formatText({ align: button.dataset.align });
  }
  action("reset").onclick = () => change(null);
  for (const name of ["undo", "redo"]) {
    action(name).onclick = () => {
      if (!sourceHistoryActive) return undo(name === "redo");
      sourceEditor.execCommand(name);
      sourceEditor.focus();
    };
  }
  const sourceForm = inspector.querySelector(".layout-source");
  const sourceHost = sourceForm.querySelector(".layout-source-editor");
  const sourceLabel = sourceForm.querySelector(".layout-source-heading span");
  const sourceMessage = sourceForm.querySelector('[role="status"]');
  const vimButton = action("vim");
  const vimKey = "slide-editor-source-vim";
  let sourceEditor;
  const sourceSubmit = sourceForm.querySelector('[type="submit"]');
  const resumeKey = "slide-editor-source-resume";
  const resume = JSON.parse(sessionStorage.getItem(resumeKey));
  const drafts = new Map(resume?.drafts ?? resume);
  sessionStorage.removeItem(resumeKey);
  const sourceDocs = new Map();
  const historyKey = resumeKey + "-history";
  const restoredHistory = new Map(JSON.parse(sessionStorage.getItem(historyKey) || "[]"));
  sessionStorage.removeItem(historyKey);
  let sourcePage, sourceSaving = false, reloading = false;
  let sourceHistoryActive = false;
  function updateHistoryButtons(pendingText = false) {
    const sizes = sourceHistoryActive ? sourcePage?.doc?.historySize() : { undo: history.length || pendingText, redo: !pendingText && future.length };
    action("undo").disabled = !sizes?.undo;
    action("redo").disabled = !sizes?.redo;
  }
  function setVim(enabled) {
    vimButton.setAttribute("aria-pressed", String(enabled));
    vimButton.textContent = "Vim";
    sourceEditor.setOption("keyMap", enabled ? "vim" : "default");
  }
  vimButton.onclick = () => {
    const enabled = vimButton.getAttribute("aria-pressed") !== "true";
    localStorage.setItem(vimKey, String(enabled));
    setVim(enabled);
    sourceEditor.focus();
  };
  function initSourceEditor() {
    sourceEditor = CodeMirror(sourceHost, {
      theme: "quarto", lineNumbers: true, lineWrapping: true, matchBrackets: true,
      tabSize: 2, screenReaderLabel: "Quarto Markdown"
    });
    sourceEditor.addOverlay({ token(stream) {
      const fence = sourceEditor.getMode().name === "markdown" && !stream.baseToken()?.type &&
        stream.sol() && /^ {0,3}:{3,}(?:\s|$)/.test(stream.string);
      stream.skipToEnd();
      return fence ? "quarto-fence" : null;
    } });
    sourceEditor.on("vim-mode-change", state => { vimButton.textContent = "Vim · " + state.mode.toUpperCase(); });
    setVim(localStorage.getItem(vimKey) === "true");
    CodeMirror.commands.save = saveSource;
    sourceEditor.on("change", cm => {
      const { id, original } = sourcePage;
      const text = cm.getValue();
      if (text === original.source) drafts.delete(id);
      else drafts.set(id, { original, text });
      sourceButtons();
    });
    new ResizeObserver(() => { if (!sourceHost.hidden) sourceEditor.refresh(); }).observe(sourceHost);
  }
  async function sourceRequest(endpoint, payload) {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || t("无法读写源码，请重启本地编辑服务。", "Cannot access the source. Restart the local editor server."));
    return result;
  }
  function sourceButtons() {
    const changed = drafts.has(Reveal.getCurrentSlide()?.id);
    sourceSubmit.disabled = !sourcePage?.doc || !changed || sourceSaving;
    action("source").toggleAttribute("data-dirty", changed);
    action("reload-source").textContent = changed ? t("放弃修改", "Discard changes") : t("重新读取", "Reload source");
    updateStatus();
  }
  async function loadSource() {
    sourceHistoryActive = true;
    const id = Reveal.getCurrentSlide().id;
    const page = { id };
    sourcePage = page;
    const draft = drafts.get(id);
    sourceHost.hidden = true;
    vimButton.disabled = true;
    sourceLabel.textContent = "";
    sourceMessage.textContent = t("正在读取源码…", "Loading source…");
    sourceButtons();
    try {
      const [original] = await Promise.all([
        draft?.original ?? sourceRequest("/slide-source", { id }),
        import("./vendor/codemirror/codemirror.js")
      ]);
      if (sourcePage !== page) return;
      page.original = original;
      sourceLabel.textContent = original.file + " · " + t("第 " + original.line + " 行", "line " + original.line);
      sourceHost.hidden = false;
      if (!sourceEditor) initSourceEditor();
      const text = draft?.text ?? original.source;
      const cached = sourceDocs.get(id);
      let doc = cached?.doc;
      if (!cached || cached.file !== original.file || doc.getValue() !== text) {
        const mode = original.file === "main.qmd" ? "yaml" : { name: "markdown", highlightFormatting: true };
        const snapshot = restoredHistory.get(id);
        // The renderer may append one or two newlines to separate slide sources.
        const canRestore = snapshot?.file === original.file && (text === snapshot.text ||
          (snapshot.saved && (text === snapshot.text + "\n" || text === snapshot.text + "\n\n")));
        doc = new CodeMirror.Doc(canRestore ? snapshot.text : text, mode);
        if (canRestore) {
          doc.setHistory(snapshot.history);
          if (text !== snapshot.text) doc.replaceRange(text.slice(snapshot.text.length), { line: doc.lastLine(), ch: Infinity });
          doc.setCursor(snapshot.cursor);
        }
        restoredHistory.delete(id);
        sourceDocs.set(id, { file: original.file, doc });
      }
      page.doc = doc;
      sourceEditor.swapDoc(doc);
      sourceEditor.setOption("firstLineNumber", original.line);
      sourceEditor.refresh();
      if (document.activeElement === action("source")) sourceEditor.focus();
      vimButton.disabled = false;
      sourceMessage.textContent = "";
      sourceButtons();
    } catch (error) { if (sourcePage === page) sourceMessage.textContent = error.message; }
  }
  function switchInspector(source) {
    finishText();
    inspector.querySelector(".layout-object-panel").hidden = source;
    sourceForm.hidden = !source;
    sourceHistoryActive = source;
    action("object-settings").setAttribute("aria-pressed", String(!source));
    action("source").setAttribute("aria-pressed", String(source));
    inspector.scrollTop = 0;
    if (source) loadSource();
    else { sourcePage = null; sourceButtons(); }
  }
  action("object-settings").onclick = () => { if (!sourceForm.hidden) switchInspector(false); };
  action("source").onclick = () => {
    if (sourceForm.hidden) switchInspector(true);
    else if (sourcePage?.doc) sourceEditor.focus();
  };
  sourceForm.addEventListener("focusin", () => { sourceHistoryActive = true; updateHistoryButtons(); });
  sourceForm.addEventListener("keydown", event => event.stopPropagation());
  action("reload-source").onclick = () => {
    drafts.delete(sourcePage.id);
    sourceDocs.delete(sourcePage.id);
    restoredHistory.delete(sourcePage.id);
    loadSource();
  };
  async function saveSource() {
    const draft = drafts.get(sourcePage?.id);
    if (sourceSaving || !sourcePage?.doc || !draft) return;
    const { id, original } = sourcePage;
    sourceSaving = true;
    bar.inert = stage.inert = true;
    sourceButtons();
    sourceMessage.textContent = t("正在保存并渲染…", "Saving and rendering…");
    try {
      finishText();
      if (dirty()) await save();
      if (dirty() || saving || pendingImports) throw new Error(status.textContent);
      const result = await sourceRequest("/save-source", { id, file: original.file, previous: original.source, source: draft.text });
      drafts.delete(id);
      sessionStorage.setItem(resumeKey, JSON.stringify({ index: result.index, drafts: [...drafts] }));
      const snapshots = new Map(restoredHistory);
      for (const [pageId, { file, doc }] of sourceDocs) {
        const sizes = doc.historySize();
        if (!sizes.undo && !sizes.redo) continue;
        snapshots.set(pageId === id ? null : pageId, {
          saved: pageId === id, file, text: doc.getValue(), history: doc.getHistory(), cursor: doc.getCursor()
        });
      }
      // Rendering already succeeded. A full session store should not prevent reopening it.
      try { sessionStorage.setItem(historyKey, JSON.stringify([...snapshots])); } catch {}
      window.history.replaceState(null, "", "#/" + result.index);
      reloading = true;
      location.reload();
    } catch (error) {
      sourceMessage.textContent = error.message;
      sourceSaving = false;
      bar.inert = stage.inert = false;
      sourceButtons();
    }
  }
  sourceForm.onsubmit = event => { event.preventDefault(); saveSource(); };
  action("save").onclick = () => !sourceForm.hidden && drafts.has(sourcePage?.id) ? saveSource() : save();
  action("prev").onclick = () => Reveal.prev();
  action("next").onclick = () => Reveal.next();
  window.addEventListener("keydown", event => {
    if (event.target.closest?.(".layout-pixel-picker")) return;
    const command = event.metaKey || event.ctrlKey;
    if (sourceSaving) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!dialog.open && !sourceForm.hidden && command && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopImmediatePropagation();
      action("save").click();
      return;
    }
    if (sourceForm.contains(event.target)) return;
    if (!citeMenu.hidden && !event.isComposing) {
      const options = citeMenu.children;
      if (["Enter", "Tab", "Escape", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "Escape") closeCites();
        else if (event.key === "Tab" || event.key === "Enter") pickCite(options[citeIndex].dataset.key);
        else {
          options[citeIndex].setAttribute("aria-selected", "false");
          citeIndex = (citeIndex + (event.key === "ArrowUp" ? -1 : 1) + options.length) % options.length;
          options[citeIndex].setAttribute("aria-selected", "true");
          options[citeIndex].scrollIntoView({ block: "nearest" });
        }
        return;
      }
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) closeCites();
    }
    if (dialog.open) {
      event.stopImmediatePropagation();
      if (command && event.key.toLowerCase() === "s") { event.preventDefault(); applySettingsForm(true); }
      return;
    }
    if (event.target === hex && event.key === "Enter") {
      event.preventDefault();
      event.stopImmediatePropagation();
      hex.blur();
      return;
    }
    if (event.target === divider && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      localStorage.setItem(widthKey, setInspectorWidth(inspector.offsetWidth + (event.key === "ArrowLeft" ? 16 : -16)));
      return;
    }
    if (event.target.matches?.(".layout-reorder") && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      const group = event.target.closest("[data-palette]"), up = event.key === "ArrowUp";
      const neighbor = up ? group.previousElementSibling : group.nextElementSibling;
      if (neighbor) {
        if (up) neighbor.before(group);
        else neighbor.after(group);
        event.target.focus();
        savePaletteOrder();
      }
      return;
    }
    if (resize) {
      if (event.key === "Escape") resize.cancel();
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (cropping && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      action("crop").click();
    } else if (marquee && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      finishMarquee(false);
    } else if (typing && !event.isComposing && (event.key === "Escape" || event.key === "Enter" && !event.shiftKey)) {
      event.preventDefault();
      finishText(event.key === "Escape");
      event.stopImmediatePropagation();
    } else if (command && event.key.toLowerCase() === "s") {
      event.preventDefault();
      document.activeElement.blur();
      finishText();
      save();
    } else if (command && ["z", "y"].includes(event.key.toLowerCase()) && !event.isComposing &&
        !typing && (event.target === cssField || !event.target.closest('textarea,[contenteditable],input:not([type="number"])'))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const button = action(event.shiftKey || event.key.toLowerCase() === "y" ? "redo" : "undo");
      if (!button.disabled) {
        button.focus();
        button.click();
      }
    } else if (typing || event.target.matches("input,textarea,select,[contenteditable]")) {
      event.stopPropagation();
    } else if (command && event.key.toLowerCase() === "g" && members.length > 1) {
      event.preventDefault();
      event.stopImmediatePropagation();
      action(event.shiftKey ? "ungroup" : "group").click();
    } else if (!drag && (event.key === "Delete" || event.key === "Backspace") && selected) {
      event.preventDefault();
      event.stopImmediatePropagation();
      removeSelection();
    } else if (bar.contains(event.target)) {
      event.stopPropagation();
    }
  }, true);
  window.addEventListener("beforeunload", event => {
    if (!reloading && (dirty() || unsavedText() || drafts.size)) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  function onSlide() {
    resize?.cancel();
    finishMarquee(false);
    finishText();
    endDrag(false);
    select(null);
    listLayers();
    if (!sourceForm.hidden) loadSource();
    else sourceButtons();
    bar.querySelector("a").href = location.pathname + "#/" + Reveal.getCurrentSlide().id;
  }
  Reveal.on("slidechanged", onSlide);
  Reveal.configure({ touch: false, embedded: true });
  fitCanvas();
  listLayers();
  refresh();
  if (resume) {
    if (Number.isInteger(resume.index)) Reveal.slide(resume.index);
    if (restoredHistory.has(null)) {
      restoredHistory.set(Reveal.getCurrentSlide().id, restoredHistory.get(null));
      restoredHistory.delete(null);
    }
    switchInspector(true);
  }
})();
