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

  // Offcanvas menu
  const menuBtn   = document.querySelector('.menu-toggle');
  const offcanvas = document.querySelector('.offcanvas');
  const ocPanel   = document.querySelector('.offcanvas-panel');
  const ocClose   = document.querySelector('.offcanvas-close');
  const ocNav     = document.querySelector('.offcanvas-nav');

  const IS_MOBILE = window.matchMedia('(pointer: coarse), (hover: none)').matches;

  // Early exit for pages without hero/slider
  wireOffcanvas();
  if (!slider || !hero || !dockPanel) return;

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

  /* --------------------------------- Utils --------------------------------- */
  const atTop       = () => (window.scrollY <= 1);
  const isCollapsed = () => body.classList.contains('is-collapsed');
  const cssNum = (el, name) => parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;

  /* ======= Responsive backgrounds (AVIF 768/1280/1920/2560) ======= */
  const IMG_PATH = 'assets/';
  // IMPORTANT: ascending order (small → large) so we select the smallest adequate
const SIZES = [478, 1280, 1920, 2560];

  function pickSize(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const need = Math.round(window.innerWidth * dpr);
    for (let i = 0; i < SIZES.length; i++){
      if (SIZES[i] >= need) return SIZES[i];
    }
    return SIZES[SIZES.length - 1]; // largest as fallback
  }

// Smooth background swap: on the very first assignment set immediately,
// on subsequent changes preload & then swap to avoid flicker.
function setBgImageSmooth(bg, url){
  const curr = bg.style.backgroundImage || '';

  // If the exact URL is already set — nothing to do
  if (curr.includes(url)) return;

  // If no background yet — set immediately (avoid blank slide on first paint)
  if (!curr || curr === 'none'){
    bg.style.backgroundImage = `url("${url}")`;
    // warm cache in background anyway
    const imgWarm = new Image();
    imgWarm.decoding = 'async';
    imgWarm.src = url;
    return;
  }

  // Subsequent changes: preload → then swap (no flicker)
  const img = new Image();
  img.decoding = 'async';
  img.src = url;

  const apply = () => { bg.style.backgroundImage = `url("${url}")`; };
  if (img.decode) img.decode().then(apply).catch(apply);
  else { img.onload = apply; img.onerror = apply; }
}


  let LOCKED_BG_SIZE = null;   // fixed size during the very first forward step (mobile only)
  let FIRST_STEP_DONE = false; // once true, unlock sizes

function setResponsiveBackgrounds(forcedSize){
  const size = forcedSize ?? LOCKED_BG_SIZE ?? pickSize();
  document.querySelectorAll('.slide .bg').forEach(bg => {
    const base = bg.dataset.img;
    if (!base) return;
    const url = `${IMG_PATH}${base}-${size}.avif`;
    setBgImageSmooth(bg, url);
    const curr = bg.style.backgroundImage || '';
  });
}

  function bgUrlFor(base, sizeOverride){
    const size = sizeOverride ?? LOCKED_BG_SIZE ?? pickSize();
    return `${IMG_PATH}${base}-${size}.avif`;
  }
  function decodeNextThenStart(nextBase){
    const url = bgUrlFor(nextBase);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;

    let started = false;
    const start = () => { if (!started){ started = true; play(); } };

    if (img.decode) img.decode().then(start).catch(start);
    else { img.onload = start; img.onerror = start; }

    // safety timeout in case decode() is slow / unsupported
    setTimeout(start, 1000);
  }
  function warmSlideBgAt(index){
    const s = slides?.[realIndex(index)];
    const base = s?.querySelector('.bg')?.dataset?.img;
    if (!base) return;
    const url = bgUrlFor(base);
    const img = new Image();
    img.decoding = 'async';
    img.src = url; // cache only
  }

  /* --------- Unified header geometry (panel clip + progress paths) --------- */
  function rebuildHeaderGeometry(){
    if (!geoSvg || !panelPath || !progressR || !progressL || !dockPanel) return;

    // Measure header & panel (global coords)
    const headerEl   = document.querySelector('.site-header');
    const headerRect = headerEl.getBoundingClientRect();
    const W          = Math.round(headerRect.width);

    const HH  = cssNum(root, '--header-h');
    const DH  = cssNum(root, '--dock-h');
    const H   = HH + DH;

    const rDock = dockPanel.getBoundingClientRect();
    const DW    = rDock.width;
    const BEV   = Math.max(0, Math.min(cssNum(root, '--bevel'), DW));

    // Panel offset relative to header
    const x0 = rDock.left - headerRect.left;
    const y0 = rDock.top  - headerRect.top;

    // Translate geometry group into place
    const g = document.getElementById('geomGroup');
    if (g) g.setAttribute('transform', `translate(${x0}, ${y0})`);

    // Size SVG viewport
    const sw        = parseFloat(getComputedStyle(progressR).strokeWidth) || 4;
    const padBottom = Math.ceil(sw / 2 + 1);
    geoSvg.setAttribute('viewBox', `0 0 ${W} ${H + padBottom}`);
    geoSvg.setAttribute('preserveAspectRatio', 'none');
    geoSvg.style.height = (H + padBottom) + 'px';

    // Build panel path (group-local coords)
    const yBevelStart = Math.max(0, H - BEV);
    const xBevelEnd   = Math.max(0, DW - BEV);
    const panelD = `M 0 0 H ${DW} V ${yBevelStart} L ${xBevelEnd} ${H} H 0 Z`;
    panelPath.setAttribute('d', panelD);

    // Build progress paths (group-local)
    const cxGlobal  = W / 2;
    const localCx   = cxGlobal - x0;
    const localHH   = HH - y0;
    const localLeft = -x0;
    const localRight= W - x0;

    // Right
    const dRight = `M ${localCx} ${localHH} H ${localRight}`;
    progressR.setAttribute('d', dRight);

    // Left (may traverse bevel)
    let dLeft;
    if (localCx <= DW) {
      dLeft = `M ${localCx} ${localHH} H ${localLeft}`;
    } else {
      if (BEV <= 0) {
        dLeft = `M ${localCx} ${localHH} H ${localLeft}`;
      } else {
        if (localHH < yBevelStart) {
          dLeft = `M ${localCx} ${localHH} H ${DW} V ${yBevelStart} L ${xBevelEnd} ${H} H ${localLeft}`;
        } else {
          let xi = DW - (localHH - yBevelStart);
          xi = Math.max(xBevelEnd, Math.min(DW, xi));
          dLeft = `M ${localCx} ${localHH} H ${xi} L ${xBevelEnd} ${H} H ${localLeft}`;
        }
      }
    }
    progressL.setAttribute('d', dLeft);

    // Reset dash
    resetProgressDash();
  }
  const pathLen = (el) => { try { return el.getTotalLength(); } catch(e){ return 0; } };
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
    if (isResizing) return;
    geoSvg?.classList.remove('is-paused'); // make lines visible
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
    geoSvg?.classList.add('is-paused');   // hide lines in pause
    cancelAnimationFrame(progRAF);
    progRAF = 0;
    if (progressR && progressL) {
      const lenR = pathLen(progressR);
      const lenL = pathLen(progressL);
      progressR.style.strokeDashoffset = `${lenR}`;
      progressL.style.strokeDashoffset = `${lenL}`;
    }
  }

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
  const PARALLAX_DISABLED = window.matchMedia('(pointer: coarse), (hover: none)').matches;

  // Build infinite loop via clones
  const originals  = Array.from(track.querySelectorAll('.slide'));
  const firstClone = originals[0]?.cloneNode(true);
  const lastClone  = originals[originals.length - 1]?.cloneNode(true);
  if (firstClone && lastClone) {
    track.insertBefore(lastClone, originals[0]);
    track.appendChild(firstClone);
  }
  const slides = Array.from(track.querySelectorAll('.slide'));

  // Freeze first-step size: on mobile use 768px for ultra-fast decode,
  // otherwise use a computed size. Unlock after first step completes.
  let LOCKED = IS_MOBILE;
  LOCKED_BG_SIZE = IS_MOBILE ? 478 : pickSize();

  // Apply backgrounds (respecting LOCKED_BG_SIZE)
  setResponsiveBackgrounds(LOCKED_BG_SIZE);

  // Disable parallax on touch
  if (PARALLAX_DISABLED){
    slides.forEach(s => s.querySelector('.bg')?.style.setProperty('--p','0px'));
  }

  const FIRST_REAL = 1;
  const LAST_REAL  = slides.length - 2;
  let idx = FIRST_REAL;

  // Start autoplay only after the next background decoded
  {
    const nextSlide = slides[idx + 1];
    const nextBase  = nextSlide?.querySelector('.bg')?.dataset?.img;
    if (nextBase) decodeNextThenStart(nextBase);
    else setTimeout(() => { play(); }, 250);
  }

  let timer = null;
  let isHovering = false;
  let isResizing = false;

  // Guard & state
  let isSliding = false;
  let pendingDir = 0;
  let slideGuard = 0;
  const SLIDE_GUARD_MS = 700;
  let dragCooldownUntil = 0;

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

    // Preload upcoming neighbors
    warmSlideBgAt(targetIdx + 1);
    warmSlideBgAt(targetIdx - 1);
  }

  function goTo(i, withProgress = true) {
    isSliding = true;
    if (slideGuard) clearTimeout(slideGuard);
    slideGuard = setTimeout(() => onSlideDone(), SLIDE_GUARD_MS); // safety

    idx = i;
    setTrackPosition(false);
    updateOverlayFor(idx);

    if (withProgress) startProgress(autoplayMs);
    else stopProgress();
  }

  function onSlideDone(){
    if (slideGuard) { clearTimeout(slideGuard); slideGuard = 0; }

    // Snap clones → real slides
    if (idx === slides.length - 1) { idx = FIRST_REAL; setTrackPosition(true); }
    else if (idx === 0)            { idx = LAST_REAL;  setTrackPosition(true); }

    isSliding = false;
    dragCooldownUntil = performance.now() + (dragType === 'mouse' ? 60 : 100);

    // Drain queued direction if any
    if (pendingDir){
      const dir = Math.sign(pendingDir);
      pendingDir = 0;
      requestSlide(dir, false);
      return;
    }

    // Keep autoplay+progress running at the very top on mobile
    if (IS_MOBILE && atTop()){
      play();
    }

    // Unlock background sizes after the very first completed forward step
    if (!FIRST_STEP_DONE){
      FIRST_STEP_DONE = true;
      LOCKED = false;
      LOCKED_BG_SIZE = null;
      // Refresh to ideal sizes in idle
      if ('requestIdleCallback' in window){
        requestIdleCallback(() => setResponsiveBackgrounds());
      } else {
        setTimeout(() => setResponsiveBackgrounds(), 0);
      }
    }
  }

  function requestSlide(delta, withProgress = false){
    if (isSliding){
      pendingDir = Math.sign(delta);
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
    if (reduceMotion || !atTop()) return;
    if (isResizing) return;
    if (isHovering && !IS_MOBILE) return;

    if (timer) clearInterval(timer);
    timer = setInterval(() => requestSlide(+1, true), autoplayMs);
    startProgress(autoplayMs);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    stopProgress();
  }

  prevBtn?.addEventListener('click', () => { stop(); requestSlide(-1, false); });
  nextBtn?.addEventListener('click', () => { stop(); requestSlide(+1, false); });

  slider.addEventListener('mouseenter', () => { isHovering = true; stop(); }, { passive:true });
  slider.addEventListener('mouseleave', () => {
    isHovering = false;
    if (!dragActive) play();
  }, { passive:true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else play();
  });

  /* -------------------------------- Drag/Swipe -------------------------------- */
  let dragActive = false;
  let dragStartX = 0;
  let dragStartT = 0;
  let dragDX     = 0;
  let dragType   = 'mouse';
  let dragPointerId = null;

  // START
  slider.addEventListener('pointerdown', (e) => {
    const now = performance.now();
    if (!e.isPrimary) return;
    if (isSliding || now < dragCooldownUntil) { e.preventDefault(); return; }
    if (e.target.closest?.('button,a')) return;

    e.preventDefault();
    dragType   = e.pointerType || 'mouse';
    dragStartT = now;
    dragActive = true;
    dragStartX = e.clientX;
    dragDX     = 0;

    dragPointerId = e.pointerId;
    slider.setPointerCapture?.(e.pointerId);
    track.dataset.prevTransition = track.style.transition || '';
    track.style.transition = 'none';
    stop();
  });

  // MOVE
  slider.addEventListener('pointermove', (e) => {
    if (!dragActive) return;
    dragDX = e.clientX - dragStartX;
    const dxPercent = (dragDX / slider.clientWidth) * 100;
    track.style.transform = `translateX(calc(-${idx * 100}% + ${dxPercent}%))`;
  });

  function endDrag() {
    if (!dragActive) return;
    const dx = dragDX;
    dragActive = false;

    // restore transition
    track.style.transition = track.dataset.prevTransition || '';
    track.dataset.prevTransition = '';

    // Commit rules: match arrow speed/feel
    const minPx     = (dragType === 'mouse') ? 16 : 24;
    const threshold = Math.max(minPx, slider.clientWidth * (dragType === 'mouse' ? 0.025 : 0.05));
    const dt        = Math.max(1, performance.now() - dragStartT);
    const vx        = Math.abs(dx) / dt;
    const fling     = vx >= (dragType === 'mouse' ? 0.40 : 0.60);

    if (fling || Math.abs(dx) > threshold) {
      requestSlide(dx < 0 ? +1 : -1, false);
    } else {
      setTrackPosition(false);
      stopProgress();
    }

    if (dragPointerId != null) {
      slider.releasePointerCapture?.(dragPointerId);
      dragPointerId = null;
    }
    dragDX = 0;
  }

  ['pointerup','pointercancel'].forEach(ev => slider.addEventListener(ev, endDrag));
  function onGlobalPointerEnd(){ if (dragActive) endDrag(); }
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

    rebuildHeaderGeometry();
    scheduleUpdateArrows();

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
  // Responsive max-size frame: measure all slides & apply max W/H to overlay frame
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
      raf = requestAnimationFrame(() => { applyToFrame(); raf = 0; });
    }
    return { applyToFrame, resize };
  })();

  // Hide arrows when overlapping the frame
  function rectsOverlap(a, b){
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  }
  let arrowsRaf = 0;
  function updateArrowOverlap(){
    const frameEl = document.getElementById('hero-frame');
    const leftEl  = slider?.querySelector('.arrow-prev');
    const rightEl = slider?.querySelector('.arrow-next');
    if (!slider || !frameEl || !leftEl || !rightEl) return;

    const GAP = 20;
    const fr = frameEl.getBoundingClientRect();
    const lr = leftEl.getBoundingClientRect();
    const rr = rightEl.getBoundingClientRect();
    const frPadLeft  = { left: fr.left - GAP, right: fr.right,       top: fr.top, bottom: fr.bottom };
    const frPadRight = { left: fr.left,       right: fr.right + GAP, top: fr.top, bottom: fr.bottom };

    leftEl.classList.toggle('is-hidden',  rectsOverlap(lr, frPadLeft));
    rightEl.classList.toggle('is-hidden', rectsOverlap(rr, frPadRight));
  }
  function scheduleUpdateArrows(){
    if (arrowsRaf) return;
    arrowsRaf = requestAnimationFrame(() => { arrowsRaf = 0; updateArrowOverlap(); });
  }

  // Track initial position (after clones)
  (function trackInit(){
    track.style.transition = 'none';
    track.style.transform  = `translateX(-${FIRST_REAL * 100}%)`;
    void track.offsetWidth; // reflow
    track.style.transition = '';
  })();

  // First overlay & geometry
  updateOverlayFor(FIRST_REAL);
  FrameSizer.applyToFrame();
  rebuildHeaderGeometry();
  proximityCollapseByDock();
  proximityHideNavOnSmall();
  onScroll();
  syncBrandA11y();
  scheduleUpdateArrows();

  // Keep arrows in sync when the frame resizes
  const frameEl = document.getElementById('hero-frame');
  if (window.ResizeObserver && frameEl){
    const ro = new ResizeObserver(() => scheduleUpdateArrows());
    ro.observe(frameEl);
  }

  /* ------------------------------- Listeners -------------------------------- */
  window.addEventListener('scroll', onScroll, { passive:true });

  let resizeRaf = null;
  let resumeTimer = 0;
  window.addEventListener('resize', () => {
    isResizing = true;
const currentSize = LOCKED_BG_SIZE ?? pickSize();
LOCKED_BG_SIZE = currentSize;   // freeze size during live resizing
    stop();
resumeTimer = setTimeout(() => {
  isResizing = false;
  LOCKED_BG_SIZE = null;           // allow choosing optimal size again
  setResponsiveBackgrounds();      // smooth-swap AFTER resize ends
  if (!isHovering) play();
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
      resizeRaf = null;
    });
  }, { passive:true });

  // Pause/resume around device rotation
  let orientTimer = 0;
  window.addEventListener('orientationchange', () => {
    stop();
    clearTimeout(orientTimer);
    orientTimer = setTimeout(() => { if (!isHovering) play(); }, 300);
  }, { passive:true });

  // Parallax
  initParallaxBase();
  applyParallax();
  if (!PARALLAX_DISABLED){
    window.addEventListener('scroll', applyParallax, { passive:true });
  }

  // Mark prepaint CSS as safe to reveal
  document.body.classList.add('js-ready');
})();
