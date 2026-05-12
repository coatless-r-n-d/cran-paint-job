// viewer.js — vanilla JS for the paint-job side-by-side viewer.

(function () {
  const fixtureSelect = document.getElementById('fixture');
  const compareBtn = document.getElementById('toggle-compare');
  const mobileBtn = document.getElementById('toggle-mobile');
  const themeBtn = document.getElementById('theme-toggle');
  const editorBtn = document.getElementById('toggle-editor');
  const aboutBtn = document.getElementById('about-btn');
  const left = document.getElementById('iframe-left');
  const right = document.getElementById('iframe-right');
  const leftHeading = document.querySelector('#pane-left h2');
  const rightHeading = document.querySelector('#pane-right h2');

  const editor = document.getElementById('editor');
  const editorTextarea = document.getElementById('editor-textarea');
  const editorGutter = document.getElementById('editor-gutter');
  const editorHighlighted = document.getElementById('editor-highlighted');
  const editorStatus = document.getElementById('editor-status');
  const editorReset = document.getElementById('editor-reset');
  const editorClose = document.getElementById('editor-close');
  const editorDownload = document.getElementById('editor-download');

  const aboutModal = document.getElementById('about-modal');

  // Two URLs for the same file: STYLESHEET_HREF is for <link> tags inside
  // iframe docs (resolved from paint-job/fixtures/*.html), STYLESHEET_FETCH_URL
  // is fetched from the viewer's own context (paint-job/index.html).
  const STYLESHEET_HREF = '../cran-modern.css';
  const STYLESHEET_FETCH_URL = 'cran-modern.css';
  const OVERLAY_LINK_ID = 'cran-modern-overlay';
  const OVERLAY_STYLE_ID = 'cran-modern-overlay-edit';

  let compareEnabled = true;
  let mobileEnabled = false;
  let theme = 'auto';              // 'auto' | 'light' | 'dark'
  let editingActive = false;
  let originalCSS = '';
  let cssDebounceTimer = null;

  // Recurse into nested frames — the homepage fixture uses a frameset with
  // 3 nested frames, so overlay/theme/nav-disable must reach each sub-doc.
  function forEachFrameDoc(win, fn) {
    let doc;
    try { doc = win.document; } catch (e) { return; }
    if (!doc) return;
    fn(doc);
    let frames;
    try { frames = win.frames; } catch (e) { return; }
    if (!frames) return;
    for (let i = 0; i < frames.length; i++) {
      try { forEachFrameDoc(frames[i], fn); } catch (e) { /* cross-origin */ }
    }
  }

  function injectLinkIntoDoc(doc) {
    if (!doc || !doc.head) return;
    // Drop any live-edit <style> before re-adding the on-disk <link>.
    const styleEl = doc.getElementById(OVERLAY_STYLE_ID);
    if (styleEl) styleEl.remove();
    if (doc.getElementById(OVERLAY_LINK_ID)) return;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLESHEET_HREF;
    link.id = OVERLAY_LINK_ID;
    doc.head.appendChild(link);
  }

  function injectStyleIntoDoc(doc, css) {
    if (!doc || !doc.head) return;
    const link = doc.getElementById(OVERLAY_LINK_ID);
    if (link) link.remove();
    let styleEl = doc.getElementById(OVERLAY_STYLE_ID);
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = OVERLAY_STYLE_ID;
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  function removeOverlayFromDoc(doc) {
    if (!doc) return;
    const link = doc.getElementById(OVERLAY_LINK_ID);
    if (link) link.remove();
    const styleEl = doc.getElementById(OVERLAY_STYLE_ID);
    if (styleEl) styleEl.remove();
  }

  function applyThemeToDoc(doc) {
    if (!doc || !doc.documentElement) return;
    if (theme === 'auto') {
      doc.documentElement.removeAttribute('data-theme');
    } else {
      doc.documentElement.setAttribute('data-theme', theme);
    }
  }

  // Intercept iframe link clicks so they open in a new tab instead of
  // navigating to live CRAN. Hash-only anchors are preserved for in-page jumps.
  function disableNavigationIn(doc) {
    if (!doc || doc.__navDisabled) return;
    doc.__navDisabled = true;
    doc.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (href.startsWith('javascript:')) return;
      e.preventDefault();
      try { window.open(link.href, '_blank', 'noopener,noreferrer'); }
      catch (_) { /* popup blocked or sandboxed */ }
    }, { capture: true });
  }

  // Cross-origin try/catch wrappers: iframe access throws for foreign docs.
  function injectOverlay(iframe) {
    try {
      if (editingActive) {
        const css = editorTextarea.value;
        forEachFrameDoc(iframe.contentWindow, (doc) => injectStyleIntoDoc(doc, css));
      } else {
        forEachFrameDoc(iframe.contentWindow, injectLinkIntoDoc);
      }
    } catch (err) { console.warn('Could not inject overlay:', err); }
  }

  function removeOverlay(iframe) {
    try { forEachFrameDoc(iframe.contentWindow, removeOverlayFromDoc); }
    catch (err) { console.warn('Could not remove overlay:', err); }
  }

  function applyThemeTo(iframe) {
    try { forEachFrameDoc(iframe.contentWindow, applyThemeToDoc); }
    catch (err) { console.warn('Could not set theme on iframe:', err); }
  }

  function disableNavigationOn(iframe) {
    try { forEachFrameDoc(iframe.contentWindow, disableNavigationIn); }
    catch (err) { /* cross-origin */ }
  }

  // Wire sub-frame load events so a frameset re-fires render() per sub-doc.
  function wireSubFrameLoads(iframe) {
    try {
      const win = iframe.contentWindow;
      if (!win || !win.frames) return;
      for (let i = 0; i < win.frames.length; i++) {
        const frameWin = win.frames[i];
        const frameEl = frameWin.frameElement;
        if (frameEl && !frameEl.__overlayWired) {
          frameEl.__overlayWired = true;
          frameEl.addEventListener('load', render);
        }
      }
    } catch (e) { /* cross-origin */ }
  }

  function render() {
    injectOverlay(right);
    applyThemeTo(right);
    disableNavigationOn(right);
    rightHeading.textContent = 'With cran-modern.css' +
      (editingActive ? ' (edited)' :
       (theme !== 'auto' ? ' (' + theme + ')' : ''));
    wireSubFrameLoads(right);

    if (compareEnabled) {
      document.body.classList.remove('single-view');
      removeOverlay(left);
      disableNavigationOn(left);
      leftHeading.textContent = 'Original (no stylesheet)';
      wireSubFrameLoads(left);
    } else {
      document.body.classList.add('single-view');
    }

    if (mobileEnabled) document.body.classList.add('mobile-view');
    else document.body.classList.remove('mobile-view');

    compareBtn.setAttribute('aria-pressed', compareEnabled ? 'true' : 'false');
    mobileBtn.setAttribute('aria-pressed', mobileEnabled ? 'true' : 'false');
    editorBtn.setAttribute('aria-pressed', editingActive ? 'true' : 'false');
    themeBtn.textContent = 'Theme: ' + theme;
    themeBtn.setAttribute('aria-label', 'Theme: ' + theme);
    themeBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');

    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // ---- Live CSS editor ----
  async function loadOriginalCSS() {
    if (originalCSS) return originalCSS;
    try {
      const resp = await fetch(STYLESHEET_FETCH_URL, { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      originalCSS = await resp.text();
      return originalCSS;
    } catch (e) {
      console.warn('Could not fetch cran-modern.css:', e);
      editorStatus.textContent = '· failed to load';
      return '';
    }
  }

  async function openEditor() {
    if (!originalCSS) {
      editorStatus.textContent = '· loading…';
      await loadOriginalCSS();
    }
    if (!editorTextarea.value) editorTextarea.value = originalCSS;
    editor.hidden = false;
    document.body.classList.add('editor-open');
    editingActive = true;
    editorStatus.textContent = '· live edit';
    syncHighlight();
    updateGutter();
    render();
  }

  function closeEditor() {
    editor.hidden = true;
    document.body.classList.remove('editor-open');
    editingActive = false;
    render();
  }

  // Push the current textarea contents into the right iframe tree. Re-apply
  // theme since injection may have rebuilt the head.
  function applyEditedCSS() {
    const css = editorTextarea.value;
    forEachFrameDoc(right.contentWindow, (doc) => injectStyleIntoDoc(doc, css));
    applyThemeTo(right);
  }

  function debouncedApplyEditedCSS() {
    clearTimeout(cssDebounceTimer);
    cssDebounceTimer = setTimeout(applyEditedCSS, 200);
  }

  // ---- CSS syntax highlighter ----
  // Hand-rolled tokenizer keeps the editor self-contained (no Prism, no
  // CodeMirror) and handles the 60+ KB stylesheet without lag. Edge cases
  // (attribute-selector values, escapes, unicode-range) fall back to plain
  // text rather than mis-highlighted text.
  function tokenizeCSS(text) {
    const tokens = [];
    let i = 0;
    const n = text.length;
    let braceDepth = 0;    // 0 = selector/at-rule space, >0 = inside { }
    let parenDepth = 0;
    let beforeColon = true; // in a declaration, are we still before the ':'?

    while (i < n) {
      const c = text[i];

      // Block comment
      if (c === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2);
        const stop = end === -1 ? n : end + 2;
        tokens.push(['comment', text.slice(i, stop)]);
        i = stop;
        continue;
      }
      // String
      if (c === '"' || c === "'") {
        const quote = c;
        let end = i + 1;
        while (end < n && text[end] !== quote) {
          if (text[end] === '\\' && end + 1 < n) end++;
          end++;
        }
        end = Math.min(end + 1, n);
        tokens.push(['string', text.slice(i, end)]);
        i = end;
        continue;
      }
      // At-rule (@import, @media, @supports, @keyframes, ...)
      if (c === '@') {
        let end = i + 1;
        while (end < n && /[a-zA-Z-]/.test(text[end])) end++;
        tokens.push(['atrule', text.slice(i, end)]);
        i = end;
        continue;
      }
      // CSS custom property (--foo) or variable reference
      if (c === '-' && text[i + 1] === '-' && /[a-zA-Z_]/.test(text[i + 2] || '')) {
        let end = i + 2;
        while (end < n && /[\w-]/.test(text[end])) end++;
        tokens.push(['variable', text.slice(i, end)]);
        i = end;
        continue;
      }
      // Hex color (3, 4, 6, or 8 hex digits, not followed by an ident char)
      if (c === '#') {
        let end = i + 1;
        while (end < n && /[0-9a-fA-F]/.test(text[end])) end++;
        const len = end - i - 1;
        const next = text[end] || '';
        if ((len === 3 || len === 4 || len === 6 || len === 8) && !/[g-zG-Z_-]/.test(next)) {
          tokens.push(['hex', text.slice(i, end)]);
          i = end;
          continue;
        }
        // Otherwise it's an ID selector (#foo)
        let end2 = i + 1;
        while (end2 < n && /[\w-]/.test(text[end2])) end2++;
        tokens.push([braceDepth === 0 ? 'selector' : 'default', text.slice(i, end2)]);
        i = end2;
        continue;
      }
      // Punctuation that tracks state
      if (c === '{') { tokens.push(['punct', '{']); braceDepth++; beforeColon = true; i++; continue; }
      if (c === '}') { tokens.push(['punct', '}']); if (braceDepth > 0) braceDepth--; beforeColon = braceDepth === 0; i++; continue; }
      if (c === '(') { tokens.push(['punct', '(']); parenDepth++; i++; continue; }
      if (c === ')') { tokens.push(['punct', ')']); if (parenDepth > 0) parenDepth--; i++; continue; }
      // Pseudo-class / pseudo-element in selector position (:root, ::before, :has, :not, :hover, ...)
      if (c === ':' && braceDepth === 0 && parenDepth === 0) {
        let end = i + 1;
        if (text[end] === ':') end++;
        while (end < n && /[\w-]/.test(text[end])) end++;
        if (end > i + 1) {
          tokens.push(['selector', text.slice(i, end)]);
          i = end;
          continue;
        }
      }
      if (c === ':') { tokens.push(['punct', ':']); if (braceDepth > 0 && parenDepth === 0) beforeColon = false; i++; continue; }
      if (c === ';') { tokens.push(['punct', ';']); beforeColon = true; i++; continue; }
      if (c === ',') { tokens.push(['punct', ',']); i++; continue; }
      // Number (possibly signed, possibly with a unit)
      if (
        /\d/.test(c) ||
        (c === '.' && /\d/.test(text[i + 1] || '')) ||
        (c === '-' && (/\d/.test(text[i + 1] || '') || text[i + 1] === '.'))
      ) {
        let end = i;
        if (text[end] === '-' || text[end] === '+') end++;
        while (end < n && /[\d.]/.test(text[end])) end++;
        // Unit suffix: % or letters
        if (text[end] === '%') {
          end++;
        } else {
          while (end < n && /[a-zA-Z]/.test(text[end])) end++;
        }
        tokens.push(['number', text.slice(i, end)]);
        i = end;
        continue;
      }
      // Identifier
      if (/[a-zA-Z_]/.test(c)) {
        let end = i;
        while (end < n && /[\w-]/.test(text[end])) end++;
        const word = text.slice(i, end);
        let type;
        if (text[end] === '(') {
          type = 'function';
        } else if (braceDepth === 0 && parenDepth === 0) {
          type = 'selector';
        } else if (braceDepth > 0 && parenDepth === 0 && beforeColon) {
          type = 'property';
        } else {
          type = 'keyword';
        }
        tokens.push([type, word]);
        i = end;
        continue;
      }
      // Whitespace (lump consecutive)
      if (/\s/.test(c)) {
        let end = i;
        while (end < n && /\s/.test(text[end])) end++;
        tokens.push(['ws', text.slice(i, end)]);
        i = end;
        continue;
      }
      // Anything else: selector combinator / attribute punctuation / etc.
      tokens.push([braceDepth === 0 ? 'selector' : 'default', c]);
      i++;
    }
    return tokens;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderHighlighted(text) {
    const tokens = tokenizeCSS(text);
    const out = [];
    for (let k = 0; k < tokens.length; k++) {
      const type = tokens[k][0];
      const val = tokens[k][1];
      const esc = escapeHtml(val);
      if (type === 'ws' || type === 'default') {
        out.push(esc);
      } else {
        out.push('<span class="cm-' + type + '">' + esc + '</span>');
      }
    }
    // Trailing space keeps the highlighted overlay's scroll metrics in step
    // with the textarea when the file ends on a blank line.
    out.push(' ');
    return out.join('');
  }

  function syncHighlight() {
    editorHighlighted.innerHTML = renderHighlighted(editorTextarea.value);
  }

  // ---- Line-number gutter ----
  function updateGutter() {
    const lineCount = (editorTextarea.value.match(/\n/g) || []).length + 1;
    let out = '';
    for (let i = 1; i <= lineCount; i++) out += i + '\n';
    editorGutter.textContent = out;
  }
  function syncEditorScroll() {
    editorGutter.scrollTop = editorTextarea.scrollTop;
    editorHighlighted.scrollTop = editorTextarea.scrollTop;
    editorHighlighted.scrollLeft = editorTextarea.scrollLeft;
  }
  editorTextarea.addEventListener('input', () => {
    syncHighlight();
    updateGutter();
    debouncedApplyEditedCSS();
  });
  editorTextarea.addEventListener('scroll', syncEditorScroll);

  editorBtn.addEventListener('click', () => {
    if (editor.hidden) openEditor();
    else closeEditor();
  });
  editorClose.addEventListener('click', closeEditor);
  editorReset.addEventListener('click', () => {
    editorTextarea.value = originalCSS;
    syncHighlight();
    updateGutter();
    debouncedApplyEditedCSS();
  });
  // Download the current editor content as cran-modern.css (whatever the
  // user has been editing, including any unsaved changes).
  editorDownload.addEventListener('click', () => {
    const blob = new Blob([editorTextarea.value], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cran-modern.css';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  // Tab inserts 2 spaces (preserves caret); Cmd/Ctrl+S flushes the debounce.
  editorTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const start = editorTextarea.selectionStart;
      const end = editorTextarea.selectionEnd;
      const val = editorTextarea.value;
      const indent = '  ';
      editorTextarea.value = val.substring(0, start) + indent + val.substring(end);
      editorTextarea.selectionStart = editorTextarea.selectionEnd = start + indent.length;
      syncHighlight();
      updateGutter();
      debouncedApplyEditedCSS();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      clearTimeout(cssDebounceTimer);
      applyEditedCSS();
    }
  });

  // ---- About modal ----
  aboutBtn.addEventListener('click', () => aboutModal.showModal());
  aboutModal.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => aboutModal.close());
  });
  // Close when clicking the backdrop (outside the dialog content).
  aboutModal.addEventListener('click', (e) => {
    const rect = aboutModal.getBoundingClientRect();
    const inDialog = e.clientX >= rect.left && e.clientX <= rect.right &&
                     e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inDialog) aboutModal.close();
  });

  // ---- Header controls ----
  left.addEventListener('load', render);
  right.addEventListener('load', render);

  fixtureSelect.addEventListener('change', () => {
    const src = 'fixtures/' + fixtureSelect.value;
    left.src = src;
    right.src = src;
  });

  compareBtn.addEventListener('click', () => {
    compareEnabled = !compareEnabled;
    render();
  });

  mobileBtn.addEventListener('click', () => {
    mobileEnabled = !mobileEnabled;
    render();
  });

  themeBtn.addEventListener('click', () => {
    theme = theme === 'auto' ? 'light' : (theme === 'light' ? 'dark' : 'auto');
    render();
  });

  // ---- Draggable splitter ----
  // Updates --split (CSS custom property on <main>) to the left-pane width;
  // the right pane keeps 1fr. The Recenter button shows only when --split is set.
  const splitter = document.getElementById('splitter');
  const recenterBtn = document.getElementById('recenter-btn');
  const mainEl = document.querySelector('main');
  const SPLIT_MIN = 140;        // px — minimum width either pane can shrink to
  const SPLIT_HANDLE_W = 8;     // matches the grid track size in CSS
  let splitterDragging = false;

  function clampSplit(px) {
    const w = mainEl.getBoundingClientRect().width;
    const min = SPLIT_MIN;
    const max = w - SPLIT_HANDLE_W - SPLIT_MIN;
    if (max <= min) return Math.max(min, w / 2);
    return Math.max(min, Math.min(max, px));
  }
  function updateRecenterVisibility() {
    recenterBtn.hidden = !mainEl.style.getPropertyValue('--split');
  }
  function setSplit(px) {
    mainEl.style.setProperty('--split', clampSplit(px) + 'px');
    updateRecenterVisibility();
  }
  function resetSplit() {
    mainEl.style.removeProperty('--split');
    updateRecenterVisibility();
  }

  splitter.addEventListener('pointerdown', (e) => {
    splitterDragging = true;
    try { splitter.setPointerCapture(e.pointerId); } catch (_) {}
    document.body.classList.add('splitter-dragging');
    e.preventDefault();
  });
  splitter.addEventListener('pointermove', (e) => {
    if (!splitterDragging) return;
    const rect = mainEl.getBoundingClientRect();
    setSplit(e.clientX - rect.left);
  });
  function endSplitterDrag(e) {
    if (!splitterDragging) return;
    splitterDragging = false;
    try { splitter.releasePointerCapture(e.pointerId); } catch (_) {}
    document.body.classList.remove('splitter-dragging');
  }
  splitter.addEventListener('pointerup', endSplitterDrag);
  splitter.addEventListener('pointercancel', endSplitterDrag);

  splitter.addEventListener('dblclick', resetSplit);
  recenterBtn.addEventListener('click', resetSplit);

  // Arrow keys nudge ±24 px; Home/End snap to edges.
  splitter.addEventListener('keydown', (e) => {
    const rect = mainEl.getBoundingClientRect();
    const leftPane = document.getElementById('pane-left');
    const current = leftPane.getBoundingClientRect().width;
    let next = current;
    if (e.key === 'ArrowLeft')       next = current - 24;
    else if (e.key === 'ArrowRight') next = current + 24;
    else if (e.key === 'Home')       next = SPLIT_MIN;
    else if (e.key === 'End')        next = rect.width - SPLIT_MIN - SPLIT_HANDLE_W;
    else return;
    e.preventDefault();
    setSplit(next);
  });

  // Re-clamp on resize so a saved split can't push a pane below SPLIT_MIN.
  window.addEventListener('resize', () => {
    const current = mainEl.style.getPropertyValue('--split');
    if (!current) return;
    const px = parseFloat(current);
    if (!isNaN(px)) setSplit(px);
  });

  // Eager-load the CSS source so the first Edit-CSS click is instant
  // (pay the fetch cache-miss now, not on the user's click).
  loadOriginalCSS();

  if (left.contentDocument && left.contentDocument.readyState === 'complete') {
    render();
  }
})();
