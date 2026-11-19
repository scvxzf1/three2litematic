/**
 * Clean preview runtime for imported Three.js HTML scenes.
 * Keeps the primary WebGL canvas full-bleed and hides the source page's HUD,
 * hints, loaders and control overlays so only the generated artwork remains.
 */
(() => {
  if (window.__THREE2LITEMATIC_CLEAN_PREVIEW__) return;
  window.__THREE2LITEMATIC_CLEAN_PREVIEW__ = true;

  let activeCanvas = null;
  let applyFrame = 0;

  const isCanvas = (node) =>
    node &&
    node.tagName === 'CANVAS' &&
    node.width > 0 &&
    node.height > 0 &&
    node.getClientRects().length > 0;

  const findPrimaryCanvas = () => {
    const canvases = Array.from(document.querySelectorAll('canvas')).filter(isCanvas);
    if (canvases.length === 0) return null;
    return canvases.reduce((best, canvas) => {
      const rect = canvas.getBoundingClientRect();
      const area = Math.max(1, rect.width) * Math.max(1, rect.height);
      if (!best) return { canvas, area };
      return area > best.area ? { canvas, area } : best;
    }, null).canvas;
  };

  const hideElement = (element) => {
    if (!element || /^(SCRIPT|STYLE|LINK|META|NOSCRIPT)$/.test(element.tagName)) return;
    element.style.setProperty('visibility', 'hidden', 'important');
    element.style.setProperty('opacity', '0', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
  };

  const revealCanvasChain = (canvas) => {
    const chain = [];
    let node = canvas;
    while (node && node !== document.documentElement) {
      chain.unshift(node);
      if (node === document.body) break;
      node = node.parentElement;
    }
    if (chain[0] !== document.body) chain.unshift(document.body);

    for (let depth = 0; depth < chain.length; depth++) {
      const current = chain[depth];
      const next = chain[depth + 1];
      for (const child of current.children) {
        if (child !== next) hideElement(child);
      }
      if (current === document.body || current === document.documentElement) continue;
      const isCanvasNode = current === canvas;
      current.style.setProperty('visibility', 'visible', 'important');
      current.style.setProperty('opacity', '1', 'important');
      current.style.setProperty('pointer-events', isCanvasNode ? 'auto' : 'none', 'important');
      current.style.setProperty('position', 'absolute', 'important');
      current.style.setProperty('inset', '0', 'important');
      current.style.setProperty('width', '100%', 'important');
      current.style.setProperty('height', '100%', 'important');
      current.style.setProperty('max-width', 'none', 'important');
      current.style.setProperty('max-height', 'none', 'important');
      current.style.setProperty('margin', '0', 'important');
      current.style.setProperty('padding', '0', 'important');
      if (isCanvasNode) current.style.setProperty('display', 'block', 'important');
    }
  };

  const requestRender = () => {
    window.__KEEP_SOURCE_ALIVE__ = true;
    window.__FORCE_SOURCE_RENDER__ = true;
    if (typeof window.__FORCE_SCENE_REDRAW__ === 'function') {
      window.__FORCE_SCENE_REDRAW__();
    }
    window.dispatchEvent(new Event('resize'));
  };

  const applyCleanPreview = () => {
    applyFrame = 0;
    const canvas = findPrimaryCanvas();
    if (!canvas) return;
    activeCanvas = canvas;
    revealCanvasChain(canvas);
    requestRender();
  };

  const scheduleApply = () => {
    if (applyFrame) return;
    applyFrame = requestAnimationFrame(applyCleanPreview);
  };

  const style = document.createElement('style');
  style.textContent = `
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      background: #070b14 !important;
    }
    body::before, body::after { content: none !important; display: none !important; }
  `;
  document.head?.appendChild(style);

  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const resizeObserver = new ResizeObserver(() => requestRender());
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      scheduleApply();
      for (const delay of [50, 150, 400, 900, 1600, 2600]) setTimeout(scheduleApply, delay);
    },
    { once: true }
  );

  setInterval(() => {
    if (activeCanvas && activeCanvas.isConnected) {
      resizeObserver.observe(activeCanvas.parentElement || activeCanvas);
      return;
    }
    scheduleApply();
  }, 1200);
})();
