/* natan.saarland — Interaktionen */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  if (reduce) root.classList.add('rm');
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (!reduce && fine && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: .95 });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const r = t => { lenis.raf(t); requestAnimationFrame(r); }; requestAnimationFrame(r);
    }
  }
  function go(target) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: el.id === 'montage' ? 0 : -72, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ---------- Hero-Intro ---------- */
  const hero = $('#montage');
  requestAnimationFrame(() => setTimeout(() => hero && hero.classList.add('is-in', 'is-start'), 60));

  /* ---------- Header & Menü ---------- */
  const top = $('.top'), burger = $('.burger'), mnav = $('#mnav');
  function setMenu(open) {
    burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    mnav.hidden = !open; document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !mnav.hidden) setMenu(false); });

  /* ---------- Anker + Modus-Links ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = $(id);
    if (!el) return;
    e.preventDefault();
    if (a.dataset.mode) setTab(a.dataset.mode);
    if (!mnav.hidden) setMenu(false);
    go(el);
    history.replaceState(null, '', id === '#montage' ? location.pathname : id);
  });

  /* ---------- Statement: Wort für Wort ---------- */
  const say = $('[data-say]');
  let words = [];
  if (say) {
    const hot = /^(sechzehn|einundzwanzig|Millimeter)/i;
    say.innerHTML = say.textContent.trim().split(/\s+/).map(w => `<span class="w${hot.test(w) ? ' hot' : ''}">${w}</span>`).join(' ');
    words = $$('.w', say);
  }

  /* ---------- Millimeter-Wort ---------- */
  const rwWrap = $('[data-ruler]'), rw = $('.rw'), rwOut = $('[data-rw]'), rwOut2 = $('[data-rw2]');
  let rwBase = 0;
  function fitRw() {
    if (!rw) return;
    rw.style.fontSize = '100px'; rw.style.letterSpacing = '-.06em';
    const w = rw.getBoundingClientRect().width;
    const avail = rwWrap.clientWidth - 2 * parseFloat(getComputedStyle(rwWrap).paddingLeft);
    const fs = Math.min(220, 100 * (avail * .9) / w);
    rw.style.fontSize = fs.toFixed(2) + 'px';
    rwBase = fs;
    rw.classList.add('fill');
  }

  /* ---------- Laser-Fadenkreuz ---------- */
  const prec = $('[data-laser]');
  if (prec && fine) {
    const xh = $('.xh', prec), xv = $('.xv', prec), xl = $('.xl', prec);
    prec.addEventListener('pointermove', e => {
      const r = prec.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      xh.style.transform = `translateY(${y}px)`; xv.style.transform = `translateX(${x}px)`;
      xl.style.left = x + 'px'; xl.style.top = y + 'px';
      xl.textContent = `X ${Math.round(x * 25.4 / 96)} · Y ${Math.round(y * 25.4 / 96)} mm`;
    });
  }

  /* ---------- Suchbild Pfeiler ---------- */
  const spot = $('[data-spot]');
  if (spot) {
    const mark = $('.spot-mark', spot), ans = $('.spot-a', spot), img = $('.spot-img', spot);
    let tries = 0;
    $('.spot-hit', spot).addEventListener('click', e => {
      const r = img.getBoundingClientRect();
      const x = e.clientX ? e.clientX - r.left : r.width * .55, y = e.clientY ? e.clientY - r.top : r.height * .5;
      mark.style.left = x + 'px'; mark.style.top = y + 'px';
      spot.classList.remove('hit'); void mark.offsetWidth; spot.classList.add('hit');
      tries++;
      ans.innerHTML = tries === 1
        ? 'Treffer? Schwer zu sagen – und genau das ist der Punkt. Der Schnitt läuft rund um den Pfosten, durch Platte und Schränke. <b>Wer es nicht weiß, sieht es nicht.</b>'
        : 'Noch mal versucht? Auch da: nichts zu sehen. Wie das geht, zeigen die vier Schritte darunter.';
    });
  }

  /* ---------- Fallakte: Bilder wechseln ---------- */
  const caseImgs = $$('.case-media img'), caseN = $('.case-n'), caseSteps = $$('.case-steps li');
  if (caseSteps.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      const i = +en.target.dataset.case;
      caseSteps.forEach((s, k) => s.classList.toggle('on', k === i));
      caseImgs.forEach((im, k) => im.classList.toggle('on', k === i));
      if (caseN) caseN.textContent = `0${i + 1} / 04`;
    }), { rootMargin: '-45% 0px -45% 0px' });
    caseSteps.forEach(s => io.observe(s));
    caseSteps[0].classList.add('on');
  }

  /* ---------- Werkschau: horizontal ---------- */
  const works = $('.works'), pin = $('.works-pin'), track = $('.track'), trackWrap = $('.track-wrap'), trIn = $('.tr-in');
  const trN = $('.tr-n b'), wkItems = track ? [...track.children] : [];
  let worksH = false, trackMax = 0, wkCenters = [], wkCur = -1;
  // Zähler am Maßband: welches Foto steht gerade unter dem roten Strich?
  function wkCount(viewCenter) {
    if (!trN || !wkCenters.length) return;
    let best = 0, d = Infinity;
    wkCenters.forEach((c, i) => { const x = Math.abs(c - viewCenter); if (x < d) { d = x; best = i; } });
    if (best === wkCur) return;
    wkCur = best;
    const n = wkItems[best] && $('.wk-n', wkItems[best]);
    trN.textContent = n ? n.textContent : 'K-' + String(best + 1).padStart(2, '0');
  }
  function layoutWorks() {
    if (!works) return;
    worksH = innerWidth > 860 && !reduce;
    wkCenters = wkItems.map(li => li.offsetLeft + li.offsetWidth / 2);
    wkCur = -1;
    if (worksH) {
      trackMax = Math.max(0, track.scrollWidth - innerWidth);
      works.style.height = (pin.offsetHeight + trackMax) + 'px';
    } else { works.style.height = ''; track.style.transform = ''; wkCount(trackWrap.scrollLeft + trackWrap.clientWidth / 2); }
  }
  if (trackWrap) trackWrap.addEventListener('scroll', () => {
    if (worksH) return;
    const m = trackWrap.scrollWidth - trackWrap.clientWidth;
    if (trIn) trIn.style.transform = `translateX(${-(m ? trackWrap.scrollLeft / m : 0) * 60}%)`;
    wkCount(trackWrap.scrollLeft + trackWrap.clientWidth / 2);
  }, { passive: true });

  /* ---------- Lightbox ---------- */
  const lb = $('.lb'), lbImg = $('img', lb), lbCap = $('figcaption', lb), wks = $$('.wk');
  let lbI = 0, lbLast = null;
  function lbShow(i) {
    lbI = (i + wks.length) % wks.length;
    const b = wks[lbI], im = $('img', b);
    lbImg.src = im.dataset.full; lbImg.alt = im.alt;
    lbCap.textContent = `${$('.wk-n', b).textContent} · ${$('.wk-t', b).textContent}`;
  }
  function lbOpen(i) { lbLast = document.activeElement; lbShow(i); lb.hidden = false; if (lenis) lenis.stop(); $('.lb-x', lb).focus(); }
  function lbClose() { lb.hidden = true; if (lenis) lenis.start(); if (lbLast) lbLast.focus(); }
  wks.forEach((b, i) => b.addEventListener('click', () => lbOpen(i)));
  $('.lb-x', lb).addEventListener('click', lbClose);
  $('.lb-p', lb).addEventListener('click', () => lbShow(lbI - 1));
  $('.lb-n', lb).addEventListener('click', () => lbShow(lbI + 1));
  lb.addEventListener('click', e => { if (e.target === lb) lbClose(); });
  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowLeft') lbShow(lbI - 1); else if (e.key === 'ArrowRight') lbShow(lbI + 1);
  });
  let tx0 = null;
  lb.addEventListener('touchstart', e => { tx0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => { if (tx0 === null) return; const d = e.changedTouches[0].clientX - tx0; if (Math.abs(d) > 50) lbShow(lbI + (d < 0 ? 1 : -1)); tx0 = null; });

  /* ---------- Formular: Tabs ---------- */
  const form = $('.qform'), tabs = $$('[data-tab]'), tabBar = $('.tabs');
  const subj = form && $('input[name=_subject]', form), anl = form && $('input[name=Anliegen]', form);
  function setTab(mode) {
    if (!form) return;
    tabs.forEach(t => {
      const on = t.dataset.tab === mode;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      const fs = $('#' + t.getAttribute('aria-controls'));
      fs.hidden = !on; fs.disabled = !on;
    });
    tabBar.classList.toggle('b', mode === 'finden');
    const label = mode === 'finden' ? 'Küche finden' : 'Premium-Montage';
    subj.value = 'Neue Anfrage über natan.saarland: ' + label; anl.value = label;
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => setTab(t.dataset.tab));
    t.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = tabs[(i + 1) % tabs.length]; setTab(n.dataset.tab); n.focus();
    });
  });
  /* Datei-Anhang: FormSubmit nimmt höchstens 10 MB an. Große Handyfotos werden vorher im Browser verkleinert,
     zu große Dateien freundlich abgelehnt – sonst landet der Besucher auf einer Fehlerseite und die Anfrage ist weg. */
  const MAX_FILE = 9.5 * 1024 * 1024, SHRINK_FROM = 2.5 * 1024 * 1024;
  const fileNote = (inp, txt, err) => { const n = inp.parentElement.querySelector('.file-n'); n.textContent = txt; inp.parentElement.classList.toggle('err', !!err); };
  async function shrink(file) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size < SHRINK_FROM || typeof createImageBitmap !== 'function' || typeof DataTransfer !== 'function') return file;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', .86));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
    } catch (e) { return file; }
  }
  $$('.file input').forEach(inp => inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    if (!f) { fileNote(inp, 'optional · Bild oder PDF'); return; }
    fileNote(inp, 'wird vorbereitet …');
    const g = await shrink(f);
    if (g !== f) { const dt = new DataTransfer(); dt.items.add(g); inp.files = dt.files; }
    if (g.size > MAX_FILE) { inp.value = ''; fileNote(inp, 'Datei zu groß (max. 10 MB) – bitte ein kleineres Foto wählen oder per WhatsApp schicken.', true); return; }
    fileNote(inp, g.name + ' · ' + (g.size / 1048576).toFixed(1).replace('.', ',') + ' MB');
  }));

  if (form) form.addEventListener('submit', e => {
    const big = $$('.fs:not([disabled]) .file input', form).some(i => i.files && i.files[0] && i.files[0].size > MAX_FILE);
    if (big) { e.preventDefault(); return; }
    const btn = $('.btn-send', form), b = $('span', btn); if (b) b.textContent = 'Wird gesendet …';
    setTimeout(() => { btn.disabled = true; }, 0); // doppeltes Absenden verhindern
  });
  // Zurück-Taste (Seite aus dem Zwischenspeicher): Knopf wieder freigeben
  addEventListener('pageshow', e => { if (e.persisted && form) { const btn = $('.btn-send', form); btn.disabled = false; $('span', btn).textContent = 'Anfrage senden'; } });

  /* ---------- Danke ---------- */
  const th = $('#danke-box');
  function thanks() {
    if (location.hash !== '#danke') return;
    th.hidden = false; $('[data-close]', th).focus();
  }
  $('[data-close]', th).addEventListener('click', () => { th.hidden = true; history.replaceState(null, '', location.pathname); });
  addEventListener('hashchange', thanks); thanks();

  /* ---------- Scroll-Loop ---------- */
  const dock = $('.dock'), anfrage = $('#anfrage'), flow = $('.flow'), flowLis = $$('.flow li');
  const life = $('[data-lifetape]'), lifeMarks = $$('.lt-marks li');
  const footBig = $('.foot-big');
  if (footBig && !reduce) footBig.classList.add('fill');
  function prog(el, a = 1, b = 0) { // 0 wenn Oberkante bei a*vh, 1 wenn Unterkante bei b*vh
    const r = el.getBoundingClientRect(), vh = innerHeight;
    return clamp((vh * a - r.top) / (r.height + vh * (a - b)));
  }
  function onScroll() {
    const y = scrollY, vh = innerHeight;
    top.classList.toggle('solid', y > 40);
    // Dock
    if (dock) {
      let show = y > vh * .5;
      if (hero && !root.classList.contains('no-gl') && !reduce) { const r = hero.getBoundingClientRect(); if (r.bottom > vh * 1.05) show = false; }
      if (anfrage) { const r = anfrage.getBoundingClientRect(); if (r.top < vh * .8 && r.bottom > 0) show = false; }
      dock.classList.toggle('show', show);
    }
    // Statement
    if (words.length) {
      const p = reduce ? 1 : prog(say, .85, .45);
      const n = Math.round(p * words.length * 1.05);
      words.forEach((w, i) => w.classList.toggle('lit', i < n));
    }
    // Millimeter-Wort
    if (rw && rwBase) {
      const p = reduce ? 1 : prog(rwWrap, .95, .2);
      rw.style.letterSpacing = (-.06 + .045 * p).toFixed(4) + 'em';
      rw.style.setProperty('--fp', (p * 115).toFixed(1) + '%');
      const w = rw.getBoundingClientRect().width;
      rwWrap.style.setProperty('--rww', w.toFixed(1) + 'px');
      const mm = (w * 25.4 / 96).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      rwOut.textContent = mm + ' mm'; rwOut2.textContent = mm;
    }
    // Werkschau
    if (worksH && works) {
      const r = works.getBoundingClientRect();
      const range = works.offsetHeight - pin.offsetHeight;
      const p = range > 0 ? clamp(-r.top / range) : 0;
      track.style.transform = `translate3d(${(-p * trackMax).toFixed(1)}px,0,0)`;
      if (trIn) trIn.style.transform = `translateX(${(-p * 60).toFixed(2)}%)`;
      wkCount(p * trackMax + innerWidth / 2);
    }
    // Footer: „Auf den Millimeter." füllt sich wie das Maß-Wort oben
    if (footBig && !reduce) {
      const p = prog(footBig, .98, .8);
      footBig.style.setProperty('--ff', (p * 106).toFixed(1) + '%');
    }
    // Ablauf
    if (flow) {
      const p = reduce ? 1 : prog(flow, .8, .5);
      flow.style.setProperty('--fl', (p * 100).toFixed(1) + '%');
      flowLis.forEach((l, i) => l.classList.toggle('on', p >= i / 3 + .02));
    }
    // Lebens-Maßband
    if (life) {
      const p = reduce ? 1 : prog(life, .9, .55);
      life.style.setProperty('--lt', (p * 100).toFixed(1) + '%');
      lifeMarks.forEach(m => m.classList.toggle('on', p >= parseFloat(m.style.getPropertyValue('--at')) - .02));
    }
  }
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });
  function layout() { fitRw(); layoutWorks(); onScroll(); }
  addEventListener('resize', () => { clearTimeout(layout.t); layout.t = setTimeout(layout, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  addEventListener('load', layout);
  layout();

  /* ---------- Reveals ---------- */
  if (hasGsap && !reduce) {
    const els = $$('.sec-head > *, .path, .pc, .log-list li, .flow li, .about-txt > *, .about-img, .g-card, .q-intro > *, .qform, .spot, .foot-big');
    els.forEach(el => el.classList.add('rv'));
    ScrollTrigger.batch(els, {
      start: 'top 88%', once: true,
      onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: .08, overwrite: true })
    });
    addEventListener('load', () => ScrollTrigger.refresh());
  }

  const yr = $('[data-year]'); if (yr) yr.textContent = new Date().getFullYear();
})();
