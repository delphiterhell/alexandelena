/* Elena & Alex — Archive, 20.09.2025 */
(() => {
  'use strict';

  // YouTube non riproduce video incorporati su 127.0.0.1: in locale si passa a localhost
  if (location.hostname === '127.0.0.1') {
    location.replace(location.href.replace('//127.0.0.1', '//localhost'));
    return;
  }

  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phone = window.matchMedia('(max-width: 760px)');

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = c => `rgb(${c.join(', ')})`;
  const pad = n => String(n).padStart(2, '0');

  const PALETTE = {
    paper: { bg: [244, 239, 231], fg: [28, 26, 24],    soft: [130, 122, 114] },
    rose:  { bg: [233, 222, 213], fg: [28, 26, 24],    soft: [122, 110, 102] },
    sage:  { bg: [216, 216, 201], fg: [28, 26, 24],    soft: [106, 106, 94] },
    stone: { bg: [206, 195, 181], fg: [28, 26, 24],    soft: [100, 91, 81] },
    night: { bg: [27, 25, 23],    fg: [239, 232, 220], soft: [152, 143, 132] },
    film:  { bg: [27, 25, 23],    fg: [244, 239, 231], soft: [160, 151, 140] },
  };

  /* ------------------------------------------------------------------
     Foto mancanti: al posto dell'immagine rotta mostra il percorso atteso
     ------------------------------------------------------------------ */
  const missing = img => {
    const path = img.getAttribute('src');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">`
      + `<rect width="400" height="400" fill="#E4DDD2"/>`
      + `<text x="200" y="206" text-anchor="middle" font-family="Manrope, sans-serif" font-size="15" fill="#6F665C">${path}</text></svg>`;
    img.removeAttribute('srcset');
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
  };
  document.querySelectorAll('img').forEach(img => {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) missing(img);
    else img.addEventListener('error', () => missing(img), { once: true });
  });

  /* ------------------------------------------------------------------
     Apertura
     ------------------------------------------------------------------ */
  const opening = document.querySelector('.opening');
  const openingImg = opening.querySelector('.opening__img');
  const ready = () => opening.classList.add('is-ready');
  if (openingImg.complete) requestAnimationFrame(ready);
  else {
    openingImg.addEventListener('load', ready, { once: true });
    openingImg.addEventListener('error', ready, { once: true });
    setTimeout(ready, 2000);
  }

  /* ------------------------------------------------------------------
     Rivelazioni
     ------------------------------------------------------------------ */
  document.querySelectorAll('.rv-soft').forEach(group => {
    group.querySelectorAll('.frame, .strip__frame').forEach((el, i) => el.style.setProperty('--i', i));
  });

  const revealables = document.querySelectorAll('.rv, .rv-soft, .rise');
  if ('IntersectionObserver' in window && !reduced.matches) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    revealables.forEach(el => io.observe(el));
  } else {
    revealables.forEach(el => el.classList.add('is-in'));
  }

  /* ------------------------------------------------------------------
     Cerimonia: la foto fissa cambia con la didascalia attiva
     ------------------------------------------------------------------ */
  const shots = [...document.querySelectorAll('.story__shot')];
  const steps = [...document.querySelectorAll('.story__step')];

  const setShot = i => {
    shots.forEach((s, n) => s.classList.toggle('is-active', n === i));
    steps.forEach((s, n) => s.classList.toggle('is-active', n === i));
  };
  if ('IntersectionObserver' in window) {
    const storyIO = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setShot(Number(e.target.dataset.step));
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(s => storyIO.observe(s));
  }
  setShot(0);

  /* ------------------------------------------------------------------
     Lettore audio
     Con un file in <audio src="…"> usa l'audio reale; senza, simula la
     riproduzione così l'interazione resta leggibile.
     ------------------------------------------------------------------ */
  const player = document.querySelector('.player');
  if (player) {
    const audio = player.querySelector('audio');
    const btn = player.querySelector('.player__btn');
    const word = player.querySelector('.player__word');
    const wave = player.querySelector('.player__wave');
    const now = player.querySelector('.player__now');
    const duration = Number(player.dataset.duration) || 84;
    const hasFile = audio && audio.getAttribute('src');

    // forma d'onda deterministica (stessa a ogni visita)
    const BARS = 72;
    let seed = 7;
    const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const bars = Array.from({ length: BARS }, (_, i) => {
      const s = document.createElement('span');
      const env = Math.sin((i / BARS) * Math.PI) * 0.6 + 0.4;
      s.style.height = `${Math.round((0.18 + rand() * 0.82) * env * 100)}%`;
      wave.appendChild(s);
      return s;
    });

    let playing = false;
    let position = 0;
    let timer = 0;
    let last = 0;

    const render = () => {
      const played = Math.floor((position / duration) * BARS);
      bars.forEach((b, i) => b.classList.toggle('is-played', i < played));
      now.textContent = `${pad(Math.floor(position / 60))}:${pad(Math.floor(position % 60))}`;
      wave.setAttribute('aria-valuenow', String(Math.floor(position)));
    };

    const tick = () => {
      const t = performance.now();
      position = hasFile ? audio.currentTime : position + (t - last) / 1000;
      last = t;
      if (position >= duration) { position = 0; setPlaying(false); }
      render();
    };

    const setPlaying = state => {
      playing = state;
      player.classList.toggle('is-playing', state);
      btn.setAttribute('aria-pressed', String(state));
      word.textContent = state ? 'Pausa' : 'Ascolta';
      if (hasFile) state ? audio.play() : audio.pause();
      clearInterval(timer);
      if (state) { last = performance.now(); timer = setInterval(tick, 200); }
    };

    btn.addEventListener('click', () => setPlaying(!playing));
    wave.addEventListener('click', e => {
      const r = wave.getBoundingClientRect();
      position = clamp((e.clientX - r.left) / r.width) * duration;
      if (hasFile) audio.currentTime = position;
      render();
    });
    if (hasFile) audio.addEventListener('ended', () => { position = 0; setPlaying(false); render(); });
    render();
  }

  /* ------------------------------------------------------------------
     Il film: l'iframe di YouTube (nocookie) si carica solo al clic
     ------------------------------------------------------------------ */
  document.querySelectorAll('.film__player').forEach(player => {
    const play = player.querySelector('.film__play');
    play.addEventListener('click', () => {
      // da file locale o da un indirizzo IP (es. 127.0.0.1) YouTube rifiuta l'incorporamento:
      // si apre il video su YouTube
      if (location.protocol === 'file:' || /^[\d.]+$|^\[/.test(location.hostname)) {
        window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(player.dataset.videoId)}`, '_blank', 'noopener');
        return;
      }
      const params = new URLSearchParams({ autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 });
      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(player.dataset.videoId)}?${params}`;
      frame.title = 'Elena & Alex — wedding trailer';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      player.append(frame);
      player.classList.add('is-playing');
      play.remove();
      frame.focus();
    });
  });

  /* ------------------------------------------------------------------
     Scorrimento: colori, testata, parallasse, sequenza orizzontale
     ------------------------------------------------------------------ */
  const masthead = document.querySelector('.masthead');
  const sections = [...document.querySelectorAll('[data-bg]')];
  const floaters = [...document.querySelectorAll('[data-speed]')].map(el => ({ el, speed: parseFloat(el.dataset.speed), y: 0 }));
  const pxImages = [...document.querySelectorAll('img[data-px]')];

  const seqPin = document.querySelector('.seq__pin');
  const seqTrack = document.querySelector('.seq__track');
  let seqDistance = 0;
  let seqCurrent = 0;
  let seqTarget = 0;

  function measureSequence() {
    // su telefono la sezione è una sequenza verticale: nessun blocco dello scorrimento
    if (phone.matches) {
      seqDistance = seqCurrent = seqTarget = 0;
      seqPin.style.height = '';
      seqTrack.style.transform = '';
      return;
    }
    seqDistance = Math.max(0, seqTrack.scrollWidth - window.innerWidth);
    seqPin.style.height = `${window.innerHeight + seqDistance}px`;
  }

  function paintColours(vh) {
    let c = PALETTE[sections[0].dataset.bg];
    let key = sections[0].dataset.bg;
    for (let i = 1; i < sections.length; i++) {
      const nextKey = sections[i].dataset.bg;
      if (nextKey === key) continue;
      const top = sections[i].getBoundingClientRect().top;
      const t = smooth(clamp((vh * 0.9 - top) / (vh * 0.8)));
      if (t === 0) break;
      const next = PALETTE[nextKey];
      // il fondo sfuma; il testo cambia a metà (con transizione CSS) per non perdere contrasto
      c = { bg: mix(c.bg, next.bg, t), fg: t < 0.5 ? c.fg : next.fg, soft: t < 0.5 ? c.soft : next.soft };
      key = nextKey;
      if (t < 1) break;
    }
    root.style.setProperty('--bg', rgb(c.bg));
    root.style.setProperty('--fg', rgb(c.fg));
    root.style.setProperty('--soft', rgb(c.soft));
    return c.bg;
  }

  function paintMasthead(bg) {
    const onImage = opening.getBoundingClientRect().bottom > 40;
    const dark = (bg[0] * 0.2126 + bg[1] * 0.7152 + bg[2] * 0.0722) < 110;
    masthead.dataset.tone = onImage || dark ? 'light' : 'dark';
  }

  function drift(vh) {
    const r = opening.getBoundingClientRect();
    if (r.bottom > 0) openingImg.style.transform = `scale(${(1 + 0.025 * clamp(-r.top / r.height)).toFixed(4)})`;

    if (phone.matches) return;

    for (const f of floaters) {
      const rect = f.el.getBoundingClientRect();
      const top = rect.top - f.y;                       // posizione senza lo spostamento attuale
      if (top > vh * 1.5 || top + rect.height < -vh * 0.5) continue;
      f.y = (top + rect.height / 2 - vh / 2) * f.speed;
      f.el.style.transform = `translate3d(0, ${f.y.toFixed(1)}px, 0)`;
    }
    for (const img of pxImages) {
      const fr = img.parentElement.getBoundingClientRect();
      if (fr.bottom < 0 || fr.top > vh) continue;
      const p = clamp((vh - fr.top) / (vh + fr.height));
      img.style.transform = `translate3d(0, ${((p - 0.5) * 6).toFixed(2)}%, 0)`;
    }
  }

  // la sequenza orizzontale segue lo scorrimento con un leggero ritardo
  let seqRunning = false;
  function runSequence() {
    seqCurrent += (seqTarget - seqCurrent) * (reduced.matches ? 1 : 0.09);
    if (Math.abs(seqTarget - seqCurrent) < 0.3) seqCurrent = seqTarget;
    seqTrack.style.transform = `translate3d(${(-seqCurrent).toFixed(1)}px, 0, 0)`;
    if (seqCurrent !== seqTarget) requestAnimationFrame(runSequence);
    else seqRunning = false;
  }
  function sequence() {
    if (!seqDistance) return;
    const top = seqPin.getBoundingClientRect().top;
    seqTarget = clamp(-top / seqDistance) * seqDistance;
    if (!seqRunning) { seqRunning = true; requestAnimationFrame(runSequence); }
  }

  let queued = false;
  function frame() {
    queued = false;
    const vh = window.innerHeight;
    paintMasthead(paintColours(vh));
    sequence();
    if (!reduced.matches) drift(vh);
  }
  const request = () => {
    if (!queued) { queued = true; requestAnimationFrame(frame); }
  };

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', () => { measureSequence(); request(); });
  window.addEventListener('load', () => { measureSequence(); request(); });
  phone.addEventListener?.('change', () => {
    floaters.forEach(f => { f.y = 0; f.el.style.transform = ''; });
    pxImages.forEach(img => { img.style.transform = ''; });
    measureSequence();
    request();
  });

  measureSequence();
  frame();
})();
