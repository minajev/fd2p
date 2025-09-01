'use strict';

/* Slider + beveled panel collapse + unified header geometry (clip + progress) */

(function () {
  const root = document.documentElement;
  const body = document.body;

  // Core hero/slider
  const slider = document.querySelector('.slider');
  const hero   = document.querySelector('.hero');

  // Beveled panel + unified SVG geometry
  const dockPanel = document.querySelector('.logo-panel');           // left white panel
  const geoSvg    = document.querySelector('.header-geo');           // full-bleed SVG over header
  const panelPath = document.getElementById('panelPath');            // single source for clip/geometry
  const progressR = document.getElementById('progress-right');       // right progress half
  const progressL = document.getElementById('progress-left');        // left  progress half

  // Offcanvas menu (optional; guarded)
  const menuBtn   = document.querySelector('.menu-toggle');
  const offcanvas = document.querySelector('.offcanvas');
  const ocPanel   = document.querySelector('.offcanvas-panel');
  const ocClose   = document.querySelector('.offcanvas-close');
  const ocNav     = document.querySelector('.offcanvas-nav');

  // Early exit for pages without hero/slider
  if (!slider || !hero || !dockPanel) {
    // Still wire up menu if present
    wireOffcanvas();
    return;
  }

  /* ----------------------------- Offcanvas menu ----------------------------- */
  function clonePrimaryNavIntoOffcanvas(){
    if (!ocNav) return;
    const main = document.querySelector('.main-nav');
    if (!main) return;
    ocNav.innerHTML = '';
    const links = Array.from(main.querySelectorAll('a'));
    links.forEach(a => {
      const copy = a.cloneNode(true);
      copy.classList.remove('btn','btn-outline','btn-outline-dark','btn-accent');
      ocNav.appendChild(copy);
    });
  }
  function openMenu(){
    if (!offcanvas || !menuBtn) return;
    clonePrimaryNavIntoOffcanvas();
    body.classList.add('is-menu-open');
    offcanvas.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    const firstLink = ocNav?.querySelector('a');
    (firstLink || ocClose || menuBtn).focus?.({ preventScroll:true });
  }
  function closeMenu(){
    if (!offcanvas || !menuBtn) return;
    body.classList.remove('is-menu-open');
    offcanvas.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.focus?.({ preventScroll:true });
  }
  function wireOffcanvas(){
    menuBtn?.addEventListener('click', () => {
      const open = body.classList.contains('is-menu-open');
      open ? closeMenu() : openMenu();
    });
    ocClose?.addEventListener('click', closeMenu);
    offcanvas?.addEventListener('click', (e) => {
      if (e.target.classList?.contains('offcanvas-backdrop')) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && body.classList.contains('is-menu-open')) closeMenu();
    });
    ocNav?.addEventListener('click', (e) => {
      const a = e.target.closest?.('a');
      if (a) closeMenu();
    });
  }
  wireOffcanvas();

  /* --------------------------------- Utils --------------------------------- */
  const atTop       = () => (window.scrollY <= 1);
  const isCollapsed = () => body.classList.contains('is-collapsed');
  const cssNum = (el, name) => parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;

// ========= Responsive backgrounds (AVIF 2560/1920/1280/768) =========
const IMG_PATH = 'assets/';
const SIZES = [2560, 1920, 1280, 768]; // descending order is fine too

function pickSize(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const need = Math.round(window.innerWidth * dpr);
  // choose the smallest size that is >= need, else the largest available
  for (let i = 0; i < SIZES.length; i++){
    if (SIZES[i] >= need) return SIZES[i];
  }
  return SIZES[0]; // 2560 fallback
}

function setResponsiveBackgrounds(){
  const size = pickSize();
  document.querySelectorAll('.slide .bg').forEach(bg => {
    const base = bg.dataset.img;
    if (!base) return;
    const url = `${IMG_PATH}${base}-${size}.avif`;
    // only update if changed, to avoid flicker
    const curr = bg.style.backgroundImage || '';
    if (!curr.includes(url)){
      bg.style.backgroundImage = `url("${url}")`;
    }
  });
}

  /* --------- Unified header geometry (panel clip + progress paths) --------- */
function rebuildHeaderGeometry(){
  if (!geoSvg || !panelPath || !progressR || !progressL || !dockPanel) return;

  // 1) Measure header & panel (GLOBAL coordinates)
  const headerEl   = document.querySelector('.site-header');
  const headerRect = headerEl.getBoundingClientRect();
  const W          = Math.round(headerRect.width);

  const HH  = cssNum(root, '--header-h');   // header visible height
  const DH  = cssNum(root, '--dock-h');     // extra height below header (panel tail)
  const H   = HH + DH;                      // total drawing height

  const rDock = dockPanel.getBoundingClientRect();
  const DW    = rDock.width;                // panel width on screen (after transforms)
  const BEV   = Math.max(0, Math.min(cssNum(root, '--bevel'), DW)); // clamp bevel

  // 2) Compute panel offset relative to the HEADER (GLOBAL → GROUP translate)
  const x0 = rDock.left - headerRect.left;
  const y0 = rDock.top  - headerRect.top;

  // Apply translation to the whole geometry layer
  const g = document.getElementById('geomGroup');
  if (g) g.setAttribute('transform', `translate(${x0}, ${y0})`);

  // 3) Size the SVG viewport (still in GLOBAL units)
  const sw        = parseFloat(getComputedStyle(progressR).strokeWidth) || 4;
  const padBottom = Math.ceil(sw / 2 + 1);

  geoSvg.setAttribute('viewBox', `0 0 ${W} ${H + padBottom}`);
  geoSvg.setAttribute('preserveAspectRatio', 'none');
  geoSvg.style.height = (H + padBottom) + 'px';

  // 4) Build the panel shape IN GROUP-LOCAL COORDS (origin at the panel's top-left)
  const yBevelStart = Math.max(0, H - BEV);        // local Y where bevel starts
  const xBevelEnd   = Math.max(0, DW - BEV);       // local X where bevel ends at bottom
  const panelD = `M 0 0 H ${DW} V ${yBevelStart} L ${xBevelEnd} ${H} H 0 Z`;
  panelPath.setAttribute('d', panelD);

  // 5) Build progress paths IN GROUP-LOCAL COORDS
  //    Convert global positions to local by subtracting (x0, y0)
  const cxGlobal  = W / 2;
  const localCx   = cxGlobal - x0;        // center X in group space
  const localHH   = HH - y0;              // header bottom Y in group space
  const localLeft = -x0;                  // global X=0 → local
  const localRight= W - x0;               // global X=W → local

  // Right: straight along the header bottom to the right edge
  const dRight = `M ${localCx} ${localHH} H ${localRight}`;
  progressR.setAttribute('d', dRight);

  // Left: depends on where the center is relative to the panel/bevel
  let dLeft;
  if (localCx <= DW) {
    // Center lies over the panel region
    dLeft = `M ${localCx} ${localHH} H ${localLeft}`;
  } else {
    if (BEV <= 0) {
      dLeft = `M ${localCx} ${localHH} H ${localLeft}`;
    } else {
      if (localHH < yBevelStart) {
        // Go back to panel right edge, down to bevel start, along bevel, then bottom to far left
        dLeft = `M ${localCx} ${localHH} H ${DW} V ${yBevelStart} L ${xBevelEnd} ${H} H ${localLeft}`;
      } else {
        // Intersect the diagonal: find intersection X on the 45° edge
        let xi = DW - (localHH - yBevelStart);
        xi = Math.max(xBevelEnd, Math.min(DW, xi));
        dLeft = `M ${localCx} ${localHH} H ${xi} L ${xBevelEnd} ${H} H ${localLeft}`;
      }
    }
  }
  progressL.setAttribute('d', dLeft);

  // 6) Reset dashes to start a fresh animation
  resetProgressDash();
}
  function pathLen(el){ try { return el.getTotalLength(); } catch(e){ return 0; } }
  function resetProgressDash(){
    if (!progressR || !progressL) return;
    const lenR = pathLen(progressR);
    const lenL = pathLen(progressL);
    progressR.style.strokeDasharray  = `${lenR}`;
    progressL.style.strokeDasharray  = `${lenL}`;
    progressR.style.strokeDashoffset = `${lenR}`;
    progressL.style.strokeDashoffset = `${lenL}`;
  }

  // Time-based center-out animation (both halves in lockstep)
  let progRAF = 0, progStart = 0, progDur = 5000;
  function startProgress(ms){
    if (!progressR || !progressL) return;
    progDur = Math.max(300, Number(ms) || 5000);
    cancelAnimationFrame(progRAF);
    resetProgressDash();
    progStart = performance.now();

    const tick = (t) => {
      const p = Math.min(1, (t - progStart) / progDur);
      const lenR = pathLen(progressR);
      const lenL = pathLen(progressL);
      progressR.style.strokeDashoffset = `${Math.max(0, lenR * (1 - p))}`;
      progressL.style.strokeDashoffset = `${Math.max(0, lenL * (1 - p))}`;
      if (p < 1) progRAF = requestAnimationFrame(tick);
    };
    progRAF = requestAnimationFrame(tick);
  }
  function stopProgress(){
    cancelAnimationFrame(progRAF);
    progRAF = 0;
    if (progressR && progressL) {
      const lenR = pathLen(progressR);
      const lenL = pathLen(progressL);
      progressR.style.strokeDashoffset = `${lenR}`;
      progressL.style.strokeDashoffset = `${lenL}`;
    }
  }

  // Public-ish hook used inside this file when slide changes
  function onSlideWillChange(nextIndex, durationMs){
    rebuildHeaderGeometry();
    startProgress(durationMs);
  }

  /* ------------------------------- Slider core ------------------------------ */
  const track    = slider.querySelector('.slides');
  const prevBtn  = slider.querySelector('.arrow-prev');
  const nextBtn  = slider.querySelector('.arrow-next');
  const learnBtn = slider.querySelector('.js-learn');

  const autoplayMs   = parseInt(slider.dataset.autoplay || '5000', 10);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Disable parallax on touch/mobile
const PARALLAX_DISABLED = window.matchMedia('(pointer: coarse), (hover: none)').matches;
  // Build infinite loop via clones
  const originals  = Array.from(track.querySelectorAll('.slide'));
  const firstClone = originals[0]?.cloneNode(true);
  const lastClone  = originals[originals.length - 1]?.cloneNode(true);
  if (firstClone && lastClone) {
    track.insertBefore(lastClone, originals[0]);
    track.appendChild(firstClone);
  }
  const slides     = Array.from(track.querySelectorAll('.slide'));
setResponsiveBackgrounds();

  if (PARALLAX_DISABLED){
  slides.forEach(s => s.querySelector('.bg')?.style.setProperty('--p','0px'));
}
  const FIRST_REAL = 1;
  const LAST_REAL  = slides.length - 2;
  let idx = FIRST_REAL;
  let timer = null;
  let isHovering = false;

// Slide navigation guard
let isSliding = false;       // true while CSS transition is running
let pendingDir = 0;          // queued direction: -1 or +1
let slideGuard = 0;          // fallback timer id
const SLIDE_GUARD_MS = 700;  // fallback if 'transitionend' gets lost

// Prevent starting a new drag while a slide is in progress or right after it
let dragCooldownUntil = 0; // timestamp (ms); ignore pointerdown if now < this

  const realIndex = i => (i === 0 ? LAST_REAL : (i === slides.length - 1 ? FIRST_REAL : i));

  function setTrackPosition(noTransition = false) {
    if (noTransition) {
      const t = track.style.transition;
      track.style.transition = 'none';
      track.style.transform  = `translateX(-${idx * 100}%)`;
      void track.offsetWidth; // reflow
      track.style.transition = t || '';
    } else {
      track.style.transform  = `translateX(-${idx * 100}%)`;
    }
  }

  function updateOverlayFor(targetIdx) {
    const real = realIndex(targetIdx);
    const s = slides[real];
    if (!s) return;

    const headlineEl = document.getElementById('slide-headline');
    const tagsEl     = document.getElementById('slide-tags');
    const captionEl  = document.getElementById('slide-caption');

    if (headlineEl) headlineEl.innerHTML = (s.dataset.headline || '');
    if (tagsEl) {
      tagsEl.textContent = (s.dataset.tags || '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .join(' • ');
    }
    if (captionEl) captionEl.textContent = s.dataset.caption || '';

    if (learnBtn) {
      learnBtn.textContent = 'LEARN MORE';
      learnBtn.onclick = () => { window.location.href = s.dataset.link || 'projects.html'; };
    }

    // reset parallax for the new slide
    const bgPrev = slides[realIndex(idx)]?.querySelector('.bg');
    if (bgPrev) bgPrev.style.setProperty('--p', '0px');
    const bg = slides[real]?.querySelector('.bg');
    if (bg) bg.style.setProperty('--p', '0px');
FrameSizer.resize();
scheduleUpdateArrows();
  }

function goTo(i, withProgress = true) {
  isSliding = true;
  if (slideGuard) clearTimeout(slideGuard);
  slideGuard = setTimeout(() => {
    // safety: if 'transitionend' was lost, finish the slide
    onSlideDone();
  }, SLIDE_GUARD_MS);

  idx = i;
  setTrackPosition(false);
  updateOverlayFor(idx);

  if (withProgress) startProgress(autoplayMs);
  else stopProgress();
}

function onSlideDone(){
  if (slideGuard) { clearTimeout(slideGuard); slideGuard = 0; }

  // If we landed on a clone, snap to the real slide without animation
  if (idx === slides.length - 1) { idx = FIRST_REAL; setTrackPosition(true); }
  else if (idx === 0)            { idx = LAST_REAL;  setTrackPosition(true); }

isSliding = false;
// short cooldown so next drag can start almost immediately
dragCooldownUntil = performance.now() + (dragType === 'mouse' ? 60 : 100);

  // If user spam-clicked during the transition, run the last queued direction
  if (pendingDir){
    const dir = Math.sign(pendingDir);
    pendingDir = 0;
    requestSlide(dir, false); // manual → no red line
  }
}

function requestSlide(delta, withProgress = false){
  if (isSliding){
    pendingDir = Math.sign(delta);  // запомним последнее направление
    return;
  }
  goTo(idx + delta, withProgress);
}

  const next = () => goTo(idx + 1);
  const prev = () => goTo(idx - 1);

track.addEventListener('transitionend', e => {
  if (e.target !== track) return;
  onSlideDone();
});

  /* --------------------------------- Autoplay -------------------------------- */
  function play() {
    if (reduceMotion || isHovering || !atTop()) return;
    stop();
timer = setInterval(() => requestSlide(+1, true), autoplayMs);
    startProgress(autoplayMs);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    stopProgress();
  }

prevBtn?.addEventListener('click', () => {
  stop();
  requestSlide(-1, false);     // guarded, no red line
});
nextBtn?.addEventListener('click', () => {
  stop();
  requestSlide(+1, false);     // guarded, no red line
});

  slider.addEventListener('mouseenter', () => { isHovering = true; stop(); }, { passive: true });
slider.addEventListener('mouseleave', () => {
  isHovering = false;
  if (!dragActive) play();   // don't restart autoplay mid-drag
}, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else play();
  });

  /* -------------------------------- Drag/Swipe -------------------------------- */
  let dragActive = false;
  let dragStartX = 0;
let dragStartT = 0;
  let dragDX     = 0;
let dragType = 'mouse';
let dragPointerId = null;   // NEW: keep last pointer id to release capture

// START drag
slider.addEventListener('pointerdown', (e) => {
  const now = performance.now();
  if (!e.isPrimary) return;                         // NEW: ignore secondary pointers
  if (isSliding || now < dragCooldownUntil) { e.preventDefault(); return; }
  if (e.target.closest?.('button,a')) return;

  e.preventDefault();                               // NEW: suppress native gestures/select
  dragType   = e.pointerType || 'mouse';
  dragStartT = now;
  dragActive = true;
  dragStartX = e.clientX;
  dragDX     = 0;

  dragPointerId = e.pointerId;                      // NEW
  slider.setPointerCapture?.(e.pointerId);
  track.dataset.prevTransition = track.style.transition || '';
  track.style.transition = 'none';
  stop();
});

// MOVE drag
slider.addEventListener('pointermove', (e) => {
  if (!dragActive) return;
  dragDX = e.clientX - dragStartX;
  const dxPercent = (dragDX / slider.clientWidth) * 100;
  track.style.transform = `translateX(calc(-${idx * 100}% + ${dxPercent}%))`;
});

function endDrag() {
  if (!dragActive) return;

  const dx = dragDX;              // total horizontal drag in px
  dragActive = false;

  // restore transition the track had before drag
  track.style.transition = track.dataset.prevTransition || '';
  track.dataset.prevTransition = '';

  // Commit rules: feel as fast as arrows
  const minPx     = (dragType === 'mouse') ? 16 : 24;                              // lower pixel threshold for mouse
  const threshold = Math.max(minPx, slider.clientWidth * (dragType === 'mouse' ? 0.025 : 0.05)); // 2.5% mouse, 5% touch
  const dt        = Math.max(1, performance.now() - dragStartT);                  // ms
  const vx        = Math.abs(dx) / dt;                                            // px/ms
  const fling     = vx >= (dragType === 'mouse' ? 0.40 : 0.60);                   // easier fling for mouse

  if (fling || Math.abs(dx) > threshold) {
    // guarded navigation; manual step → no red progress line
    requestSlide(dx < 0 ? +1 : -1, false);
  } else {
    // snap back to current slide, also stop any progress animation
    setTrackPosition(false);
    stopProgress();
  }

  // Explicitly release pointer capture (safety across browsers)
  if (dragPointerId != null) {
    slider.releasePointerCapture?.(dragPointerId);
    dragPointerId = null;
  }
  dragDX = 0;
}


// END drag
['pointerup','pointercancel'].forEach(ev => {
  slider.addEventListener(ev, endDrag);
});

// Finish drag even if pointer leaves the slider or capture is lost
function onGlobalPointerEnd(){
  if (dragActive) endDrag();
}
window.addEventListener('pointerup', onGlobalPointerEnd, { passive:true });
window.addEventListener('pointercancel', onGlobalPointerEnd, { passive:true });
slider.addEventListener('lostpointercapture', onGlobalPointerEnd);

  /* -------------------------------- Parallax --------------------------------- */
  const PAR_MAX = 200;
  const PAR_SPEED = 0.2;
  let parBase = 0;

  function initParallaxBase(){
    if (PARALLAX_DISABLED) return;
    const r = slider.getBoundingClientRect();
    parBase = (window.innerHeight / 2 - r.top) * PAR_SPEED;
  }
  function applyParallax(){
    if (PARALLAX_DISABLED) return;
    const r = slider.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight) return;
    const raw = (window.innerHeight / 2 - r.top) * PAR_SPEED;
    const delta = Math.max(-PAR_MAX, Math.min(PAR_MAX, raw - parBase));
    const bg = slides[realIndex(idx)]?.querySelector('.bg');
    if (bg) bg.style.setProperty('--p', `${delta}px`);
  }

  /* ---------------------------- A11y + layout sync --------------------------- */
  function syncBrandA11y(){
    const big = document.querySelector('.brand-dock');
    const small = document.querySelector('.site-header .brand');
    const collapsed = isCollapsed();
    const navHidden = body.classList.contains('is-nav-hidden');

    big?.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
    small?.setAttribute('aria-hidden', collapsed ? 'false' : 'true');

    const nav = document.querySelector('.main-nav');
    nav?.setAttribute('aria-hidden', navHidden ? 'true' : 'false');

    const menuOpen = body.classList.contains('is-menu-open');
    menuBtn?.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');
  }

  function proximityCollapseByDock(){
    if (!atTop()) return;
    const headerRow = document.querySelector('.header-inner');
    const nav       = document.querySelector('.main-nav');
    if (!headerRow || !nav || !dockPanel) return;

    const dockRight = dockPanel.getBoundingClientRect().right;
    const rHeader   = headerRow.getBoundingClientRect();
    const navWidth  = Math.ceil(nav.scrollWidth);
    const linkLeft  = rHeader.right - navWidth;
    const gap       = linkLeft - dockRight;

    const COLLAPSE_GAP = 50;
    const EXPAND_GAP   = 50;

    const collapsed = isCollapsed();
    if (!collapsed && gap <= COLLAPSE_GAP)      applyCollapsedState(true);
    else if (collapsed && gap > EXPAND_GAP)     applyCollapsedState(false);
  }

  function proximityHideNavOnSmall(){
    const collapsed = isCollapsed();
    const brandEl   = document.querySelector('.site-header .brand');
    const nav       = document.querySelector('.main-nav');
    const headerRow = document.querySelector('.header-inner');

    if (!collapsed || !brandEl || !nav || !headerRow){
      body.classList.remove('is-nav-hidden');
      syncBrandA11y();
      return;
    }
    const HIDE_GAP = 50;
    const SHOW_GAP = 50;

    const rBrand   = brandEl.getBoundingClientRect();
    const isHidden = body.classList.contains('is-nav-hidden');

    const rHeader  = headerRow.getBoundingClientRect();
    const navWidth = Math.ceil(nav.scrollWidth);
    const linkLeft = rHeader.right - navWidth;

    const gap = linkLeft - rBrand.right;

    let nextHidden = isHidden;
    if (!isHidden && gap <= HIDE_GAP) nextHidden = true;
    else if (isHidden && gap > SHOW_GAP) nextHidden = false;

    if (nextHidden !== isHidden){
      body.classList.toggle('is-nav-hidden', nextHidden);
      syncBrandA11y();
    }
  }

  function applyCollapsedState(collapsed){
    const prev = body.classList.contains('is-collapsed');
    if (collapsed !== prev){
      body.classList.toggle('is-collapsed', collapsed);
      if (!collapsed) body.classList.remove('is-nav-hidden');
      syncBrandA11y();
    }

    // Always rebuild geometry when state changes
    rebuildHeaderGeometry();
scheduleUpdateArrows();

    // Autoplay only at the very top, not hovering, and not in reduced motion
    const canRun = atTop() && !isHovering && !reduceMotion && document.visibilityState === 'visible';
    if (canRun) play();
    else { stop(); stopProgress(); }
  }

  function onScroll(){
    if (!atTop()){
      applyCollapsedState(true);
      proximityHideNavOnSmall();
      stop();
    } else {
      proximityCollapseByDock();
      proximityHideNavOnSmall();
      rebuildHeaderGeometry();
      play();
    }
  scheduleUpdateArrows();
  }

  /* --------------------------------- Boot ----------------------------------- */

// Responsive max-size frame: measures all slides at current viewport and applies the max
const FrameSizer = (() => {
  let measurer = null;
  let raf = 0;

  function ensureMeasurer(){
    if (measurer) return measurer;
    measurer = document.createElement('div');
    measurer.id = 'hero-measurer';
    measurer.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
    measurer.innerHTML = `
      <div class="hero-frame" style="padding:22px 28px;border:1px solid transparent;background:none;">
        <div class="hero-text">
          <div class="line line-headline"></div>
          <div class="line line-tags"></div>
          <div class="line line-caption"></div>
        </div>
      </div>`;
    document.body.appendChild(measurer);
    return measurer;
  }

  function computeMaxWH(){
    const m  = ensureMeasurer();
    const mF = m.firstElementChild;
    const mH = mF.querySelector('.line-headline');
    const mT = mF.querySelector('.line-tags');
    const mC = mF.querySelector('.line-caption');

    let maxW = 0, maxH = 0;
    const slides = document.querySelectorAll('.slides .slide');
    slides.forEach(s => {
      mH.innerHTML    = s.dataset.headline || '';
      mT.textContent  = (s.dataset.tags || '').split(',').map(t => t.trim()).filter(Boolean).join(' • ');
      mC.textContent  = s.dataset.caption || '';
      mF.style.width  = 'auto';
      mF.style.height = 'auto';
      const r = mF.getBoundingClientRect();
      if (r.width  > maxW) maxW = r.width;
      if (r.height > maxH) maxH = r.height;
    });

    return { w: Math.ceil(maxW), h: Math.ceil(maxH) };
  }

  function applyToFrame(){
    const frame = document.getElementById('hero-frame');
    if (!frame) return;
    const { w, h } = computeMaxWH();
    frame.style.width  = w + 'px';
    frame.style.height = h + 'px';
  }

  function resize(){
    if (raf) return;
    raf = requestAnimationFrame(() => {
      applyToFrame();
      raf = 0;
    });
  }

  return { applyToFrame, resize };
})();

// --- Hide arrows when they visually overlap the text frame ---
function rectsOverlap(a, b){
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

let arrowsRaf = 0;
function updateArrowOverlap(){
  const frameEl = document.getElementById('hero-frame');
  const leftEl  = slider?.querySelector('.arrow-prev');
  const rightEl = slider?.querySelector('.arrow-next');
  if (!slider || !frameEl || !leftEl || !rightEl) return;

  const GAP = 20; // <-- safety gap so arrows hide a bit earlier

  const fr = frameEl.getBoundingClientRect();
  const lr = leftEl.getBoundingClientRect();
  const rr = rightEl.getBoundingClientRect();

  // Expand the frame horizontally toward the approaching arrow
  const frPadLeft  = { left: fr.left - GAP, right: fr.right,       top: fr.top, bottom: fr.bottom };
  const frPadRight = { left: fr.left,       right: fr.right + GAP, top: fr.top, bottom: fr.bottom };

  leftEl.classList.toggle('is-hidden',  rectsOverlap(lr, frPadLeft));
  rightEl.classList.toggle('is-hidden', rectsOverlap(rr, frPadRight));
}

function scheduleUpdateArrows(){
  if (arrowsRaf) return;
  arrowsRaf = requestAnimationFrame(() => {
    arrowsRaf = 0;
    updateArrowOverlap();
  });
}

  // Track initial position (after clones)
  (function trackInit(){
    track.style.transition = 'none';
    track.style.transform  = `translateX(-${FIRST_REAL * 100}%)`;
    void track.offsetWidth; // reflow
    track.style.transition = '';
  })();

  // First overlay update + geometry + layout sync
  updateOverlayFor(FIRST_REAL);
FrameSizer.applyToFrame();
  rebuildHeaderGeometry();
  proximityCollapseByDock();
  proximityHideNavOnSmall();
  onScroll();
  syncBrandA11y();
scheduleUpdateArrows();

// Keep arrows in sync when the frame resizes (responsive text/FrameSizer)
const frameEl = document.getElementById('hero-frame');
if (window.ResizeObserver && frameEl){
  const ro = new ResizeObserver(() => scheduleUpdateArrows());
  ro.observe(frameEl);
}

  // Listeners
  window.addEventListener('scroll', onScroll, { passive:true });

  let resizeRaf = null;
let resizeTimer = 0;
  window.addEventListener('resize', () => {
  stop();
clearTimeout(resizeTimer);
resizeTimer = setTimeout(() => {
  if (!isHovering) play(); // resume only if cursor is not over the slider
}, 300);
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      rebuildHeaderGeometry();
      if (atTop()){
        proximityCollapseByDock();
        proximityHideNavOnSmall();
      } else {
        applyCollapsedState(true);
        proximityHideNavOnSmall();
      }
      initParallaxBase();
      applyParallax();
FrameSizer.resize();
scheduleUpdateArrows();
setResponsiveBackgrounds();
      resizeRaf = null;
    });
  }, { passive:true });

// Pause autoplay & red line on device rotation (mobile/tablet)
let orientTimer = 0;
window.addEventListener('orientationchange', () => {
  stop();
  clearTimeout(orientTimer);
  orientTimer = setTimeout(() => { if (!isHovering) play(); }, 300);
}, { passive:true });

  // Start autoplay on load
  play();

  // Parallax init + listeners
  initParallaxBase();
  applyParallax();
if (!PARALLAX_DISABLED){
  window.addEventListener('scroll', applyParallax, { passive:true });
}
document.body.classList.add('js-ready');
})();
