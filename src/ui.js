import STOCKS from './film-stocks.js';
import { animate } from 'motion';

/* ── Film logo builders (24×24 CSS blocks for collapsed pill) ── */
const LOGO_BUILDERS = {
  fuji(el) {
    el.style.background = '#fff';
    el.innerHTML = `
      <div style="position:absolute;left:0;top:0;width:12px;height:24px;background:#1d8232"></div>
      <div style="position:absolute;left:12px;bottom:0;width:12px;height:8px;background:#9e30a6"></div>`;
  },
  kodak(el) {
    el.style.background = '#fecf1c';
    el.innerHTML = `
      <div style="position:absolute;left:0;bottom:0;width:24px;height:14px;background:#be0082"></div>`;
  },
  ilford(el) {
    el.style.background = '#fff';
    el.innerHTML = `
      <div style="position:absolute;bottom:0;left:0;width:24px;height:8px;background:#4d9cfa"></div>
      <div style="position:absolute;bottom:10px;left:0;width:24px;height:2px;background:#4d9cfa"></div>
      <div style="position:absolute;bottom:14px;left:0;width:24px;height:2px;background:#4d9cfa"></div>`;
  },
};

/* ── Film roll image paths ── */
const ROLL_IMAGES = {
  fuji: '/rolls/roll-fuji.png',
  kodak: '/rolls/roll-kodak.png',
  ilford: '/rolls/roll-ilford.png',
};

function buildRollHTML(filmId) {
  const brand = STOCKS[filmId].brand;
  const src = ROLL_IMAGES[brand] || '';
  return `<div class="island-roll" data-film="${filmId}"><img src="${src}" alt="${brand}" draggable="false"></div>`;
}

/* ── Canister SVG paths (shared between clear button and no-film logo) ── */
const CANISTER_PATHS = `
  <path d="M7 15.99C7 16.63 6.4 17.11 5.8 16.88C2.41 15.59 0 12.31 0 8.47C0 4.63 2.41 1.35 5.8 0.06C6.4-0.17 7 0.31 7 0.95V15.99Z"/>
  <path d="M11 0.95C11 0.31 11.6-0.17 12.2 0.06C15.59 1.35 18 4.63 18 8.47C18 12.31 15.59 15.59 12.2 16.88C11.6 17.11 11 16.63 11 15.99V0.95Z"/>`;

const CLEAR_FILM_SVG = `<svg width="18" height="17" viewBox="0 0 18 16.94" fill="currentColor" xmlns="http://www.w3.org/2000/svg">${CANISTER_PATHS}</svg>`;

const NOFILM_LOGO_HTML = `<img src="/rolls/nofilm-icon.svg" width="17" height="17" draggable="false">`;

/**
 * Build the sidebar + demo content DOM and wire controls to a FilmEmulator instance.
 *
 * @param {FilmEmulator} emulator
 * @param {HTMLElement}  sidebarRoot     – container that will hold sidebar markup
 * @param {HTMLElement}  contentRoot     – the #content div (also the grade target)
 * @param {HTMLElement}  cardSelectorEl  – container for the dynamic island selector
 */
export function initUI(emulator, sidebarRoot, contentRoot, cardSelectorEl) {
  /* ── Dynamic favicon (renders island logo to canvas) ── */
  let faviconLink = document.querySelector("link[rel='icon']");
  if (!faviconLink) {
    faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    document.head.appendChild(faviconLink);
  }

  const FAVICON_LOGOS = {
    fuji:   { bg: '#fff',    blocks: [{ x:0, y:0, w:16, h:32, fill:'#1d8232' }, { x:16, y:21, w:16, h:11, fill:'#9e30a6' }] },
    kodak:  { bg: '#fecf1c', blocks: [{ x:0, y:13, w:32, h:19, fill:'#be0082' }] },
    ilford: { bg: '#fff',    blocks: [{ x:0, y:21, w:32, h:11, fill:'#4d9cfa' }, { x:0, y:16, w:32, h:3, fill:'#4d9cfa' }, { x:0, y:10, w:32, h:3, fill:'#4d9cfa' }] },
  };

  function updateFavicon(brand) {
    const logo = FAVICON_LOGOS[brand];
    if (!logo) { faviconLink.href = '/rolls/nofilm-icon.svg'; return; }
    const s = 32;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    // Rounded rect background
    const r = 6;
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, r);
    ctx.fillStyle = logo.bg;
    ctx.fill();
    ctx.clip();
    for (const b of logo.blocks) {
      ctx.fillStyle = b.fill;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    faviconLink.href = c.toDataURL('image/png');
  }
  /* ── Sidebar HTML ──────────────────────────────────────────── */
  sidebarRoot.innerHTML = `
    <div class="sidebar-header">
      <h1>Controls</h1>
      <p>WebGL grain · CSS grade</p>
    </div>

    <div class="section-label">Film Stock</div>
    <div class="film-list">
      ${Object.entries(STOCKS).map(([id, s]) => `
        <button class="film-btn${id === emulator.filmId ? ' active' : ''}" data-film="${id}">
          <span class="film-btn-name">${s.cardName}</span>
          <span class="film-btn-desc">${s.description}</span>
        </button>
      `).join('')}
    </div>

    <div class="section-label" style="margin-top:auto;">Adjust</div>
    <div class="controls">
      <div class="control-row">
        <div class="control-label">Grain Intensity <span id="val-intensity">1.00</span></div>
        <input type="range" id="ctrl-intensity" min="0" max="2.5" step="0.05" value="1.0">
      </div>
      <div class="control-row">
        <div class="control-label">Grain Size <span id="val-size">1.0</span></div>
        <input type="range" id="ctrl-size" min="0.3" max="3.0" step="0.1" value="1.0">
      </div>
      <div class="control-row">
        <div class="control-label">Color Grade <span id="val-grade">1.00</span></div>
        <input type="range" id="ctrl-grade" min="0" max="1.5" step="0.05" value="1.0">
      </div>
    </div>

    <div class="section-label">Spring</div>
    <div class="controls">
      <div class="control-row">
        <div class="control-label">Duration <span id="val-duration">0.40</span></div>
        <input type="range" id="ctrl-duration" min="0.1" max="1.5" step="0.05" value="0.40">
      </div>
      <div class="control-row">
        <div class="control-label">Bounce <span id="val-bounce">0.15</span></div>
        <input type="range" id="ctrl-bounce" min="0" max="0.5" step="0.01" value="0.15">
      </div>
    </div>

    <div class="section-label">Blur</div>
    <div class="controls">
      <div class="control-row">
        <div class="control-label">Speed <span id="val-blur-speed">0.35</span>s</div>
        <input type="range" id="ctrl-blur-speed" min="0.05" max="1.5" step="0.05" value="0.35">
      </div>
      <div class="control-row">
        <div class="control-label">Radius <span id="val-blur-radius">20</span>px</div>
        <input type="range" id="ctrl-blur-radius" min="1" max="30" step="1" value="20">
      </div>
      <div class="control-row">
        <div class="control-label">Easing</div>
        <select id="ctrl-blur-easing">
          <option value="ease">ease</option>
          <option value="ease-out">ease-out</option>
          <option value="ease-in-out">ease-in-out</option>
          <option value="linear">linear</option>
        </select>
      </div>
      <div class="control-row">
        <svg id="easing-graph" viewBox="0 0 1 1" preserveAspectRatio="none">
          <line class="eg-diag" x1="0" y1="1" x2="1" y2="0" />
          <path id="easing-curve" d="" />
        </svg>
      </div>
    </div>
  `;

  /* ── Demo content ──────────────────────────────────────────── */
  contentRoot.innerHTML = `
    <p class="content-eyebrow">Susan Sontag · June 10, 2025</p>
    <h2 class="content-title">To collect <em>photographs</em><br>is to collect the world</h2>

    <p class="content-body">
      To photograph is to appropriate the thing photographed. It means putting oneself into a certain relation to the world that feels like knowledge—and, therefore, like power. A now notorious first fall into alienation, habituating people to abstract the world into printed words, is supposed to have engendered that surplus of Faustian energy and psychic damage needed to build modern, inorganic societies. But print seems a less treacherous form of leaching out the world, of turning it into a mental object, than photographic images, which now provide most of the knowledge people have about the look of the past and the reach of the present. What is written about a person or an event is frankly an interpretation, as are handmade visual statements, like paintings and drawings. Photographed images do not seem to be statements about the world so much as pieces of it, miniatures of reality that anyone can make or acquire.
    </p>
    <p class="content-body">
      Photographs, which fiddle with the scale of the world, themselves get reduced, blown up, cropped, retouched, doctored, tricked out. They age, plagued by the usual ills of paper objects; they disappear; they become valuable, and get bought and sold; they are reproduced. Photographs, which package the world, seem to invite packaging. They are stuck in albums, framed and set on tables, tacked on walls, projected as slides. Newspapers and magazines feature them; cops alphabetize them; museums exhibit them; publishers compile them.
    </p>
  `;

  /* ── Focusing screen overlay (shown during blur) ── */
  const focusingScreen = document.createElement('div');
  focusingScreen.className = 'focusing-screen';
  contentRoot.parentElement.insertBefore(focusingScreen, contentRoot.nextSibling);

  const focusingOverlay = document.createElement('div');
  focusingOverlay.className = 'focusing-overlay';
  focusingOverlay.innerHTML = '<img src="/focusing-screen.svg" alt="" draggable="false">';
  contentRoot.parentElement.insertBefore(focusingOverlay, focusingScreen.nextSibling);

  /* ── Sound effects (native Audio API) ── */
  const sfx = {
    unfocus: Object.assign(new Audio('/sounds/unfocus.mp3'), { volume: 0.25 }),
    tick:    Object.assign(new Audio('/sounds/tick.mp3'),    { volume: 0.5 }),
    eject:   Object.assign(new Audio('/sounds/eject.mp3'),   { volume: 0.4 }),
  };
  function playSfx(sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  /* ── Wire film buttons (wired after island sets up switchFilm) ── */
  const filmBtns = sidebarRoot.querySelectorAll('.film-btn');

  /* ── Wire sliders ──────────────────────────────────────────── */
  const sliders = [
    { inputId: 'ctrl-intensity', valueId: 'val-intensity', prop: 'intensity',      key: 'intensity' },
    { inputId: 'ctrl-size',      valueId: 'val-size',      prop: 'size',           key: 'size' },
    { inputId: 'ctrl-grade',     valueId: 'val-grade',     prop: 'grade',          key: 'grade' },
  ];

  for (const s of sliders) {
    const input = document.getElementById(s.inputId);
    const display = document.getElementById(s.valueId);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      emulator[s.prop] = v;
      display.textContent = v.toFixed(2);
      emulator.apply();
    });
  }

  /** Reset all sliders to the current stock's defaults. */
  function applyStockDefaults() {
    const defs = emulator.stock.defaults || {};
    for (const s of sliders) {
      const v = defs[s.key] ?? 1.0;
      const input = document.getElementById(s.inputId);
      const display = document.getElementById(s.valueId);
      input.value = v;
      display.textContent = v.toFixed(2);
      emulator[s.prop] = v;
    }
  }

  /* ── Dynamic island film selector ────────────────────────────── */
  const rollStockIds = Object.keys(STOCKS).filter(id => id !== 'none');
  const spring = { type: 'spring', visualDuration: 0.4, bounce: 0.15 };
  let blurRadius = 20;            // px      — controlled by Radius slider
  let blurSpeed = 0.35;           // seconds — controlled by Speed slider
  let blurEasing = 'ease';        // CSS easing — controlled by Easing dropdown

  // Pill dimensions (for morphing animation)
  const PILL_W = 200;
  const PILL_H = 36;
  const EXPANDED_W = 274;
  const EXPANDED_H = 103;

  // Build island HTML
  cardSelectorEl.innerHTML = `
    <div class="island">
      <div class="island-pill">
        <div class="island-pill-content">
          <div class="island-logo"></div>
          <span class="island-name"></span>
        </div>
        <button class="island-clear" aria-label="Clear film">${CLEAR_FILM_SVG}</button>
      </div>
      <div class="island-tray">
        ${rollStockIds.map(id => buildRollHTML(id)).join('')}
      </div>
    </div>
  `;

  const island = cardSelectorEl.querySelector('.island');
  const pill = island.querySelector('.island-pill');
  const logo = island.querySelector('.island-logo');
  const nameEl = island.querySelector('.island-name');
  const clearBtn = island.querySelector('.island-clear');
  const tray = island.querySelector('.island-tray');
  const rolls = [...island.querySelectorAll('.island-roll')];

  let islandState = 'collapsed'; // 'collapsed' | 'collapsing' | 'expanded'
  let skipNextTick = false;       // skip first roll tick after expand (roll slides under cursor)

  /** Update the pill to reflect the current film. */
  function updatePill() {
    const stock = emulator.stock;
    const brand = stock.brand;

    if (brand && LOGO_BUILDERS[brand]) {
      logo.style.display = '';
      LOGO_BUILDERS[brand](logo);
    } else {
      logo.style.display = '';
      logo.style.background = '#1E1E1E';
      logo.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${NOFILM_LOGO_HTML}</div>`;
    }

    nameEl.textContent = stock.cardName.toUpperCase();
    updateFavicon(brand);
  }

  /** Expand the island — show film rolls. */
  function expandIsland() {
    if (islandState !== 'collapsed') return;
    islandState = 'expanded';

    playSfx(sfx.unfocus);
    skipNextTick = true;

    // Blur-in: speed + easing from sidebar controls
    focusingScreen.style.transition =
      `opacity ${blurSpeed}s ${blurEasing}, -webkit-backdrop-filter ${blurSpeed}s ${blurEasing}, backdrop-filter ${blurSpeed}s ${blurEasing}`;
    focusingScreen.style.webkitBackdropFilter = `blur(${blurRadius}px)`;
    focusingScreen.style.backdropFilter = `blur(${blurRadius}px)`;
    focusingScreen.style.opacity = '1';
    focusingOverlay.style.transition = `opacity ${blurSpeed}s ${blurEasing}`;
    focusingOverlay.style.opacity = '1';

    // Morph container
    animate(island, {
      width: `${EXPANDED_W}px`,
      height: `${EXPANDED_H}px`,
      borderRadius: '32px',
    }, spring);

    // Fade out pill content
    animate(pill, { opacity: 0 }, { duration: 0.15 });

    // Show tray
    tray.style.display = 'block';

    // Animate rolls in (staggered from below)
    rolls.forEach((roll, i) => {
      animate(roll, { y: 0, opacity: 1 }, {
        ...spring,
        delay: i * 0.04,
      });
    });
  }

  /** Collapse the island — hide rolls, show pill. */
  function collapseIsland() {
    if (islandState !== 'expanded') return;
    islandState = 'collapsing';

    // Un-blur (reuses the transition timing set by expandIsland)
    focusingScreen.style.opacity = '0';
    focusingScreen.style.webkitBackdropFilter = 'blur(0px)';
    focusingScreen.style.backdropFilter = 'blur(0px)';
    focusingOverlay.style.opacity = '0';

    // Animate rolls out
    rolls.forEach((roll, i) => {
      animate(roll, { y: 20, opacity: 0 }, { duration: 0.15, delay: i * 0.02 });
    });

    // Morph container back to pill
    animate(island, {
      width: `${PILL_W}px`,
      height: `${PILL_H}px`,
      borderRadius: '70px',
    }, spring);

    // Fade in pill content
    animate(pill, { opacity: 1 }, { ...spring, delay: 0.1 });

    // Hide tray after animation
    setTimeout(() => {
      if (islandState === 'collapsing') {
        islandState = 'collapsed';
        tray.style.display = 'none';
      }
    }, spring.visualDuration * 1000 + 50);
  }

  function switchFilm(filmId) {
    emulator.filmId = filmId;
    filmBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.film === filmId);
    });
    applyStockDefaults();
    emulator.apply();
    updatePill();
  }

  /* ── Wire animation sliders ───────────────────────────────── */
  document.getElementById('ctrl-duration').addEventListener('input', (e) => {
    spring.visualDuration = parseFloat(e.target.value);
    document.getElementById('val-duration').textContent = spring.visualDuration.toFixed(2);
  });

  document.getElementById('ctrl-bounce').addEventListener('input', (e) => {
    spring.bounce = parseFloat(e.target.value);
    document.getElementById('val-bounce').textContent = spring.bounce.toFixed(2);
  });

  document.getElementById('ctrl-blur-speed').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-blur-speed').textContent = v.toFixed(2);
    blurSpeed = v;
  });

  document.getElementById('ctrl-blur-radius').addEventListener('input', (e) => {
    blurRadius = parseInt(e.target.value, 10);
    document.getElementById('val-blur-radius').textContent = blurRadius;
  });

  /* ── Easing curve graph ── */
  const EASING_CURVES = {
    'ease':        [0.25, 0.1,  0.25, 1.0],
    'ease-out':    [0,    0,    0.58, 1.0],
    'ease-in-out': [0.42, 0,    0.58, 1.0],
    'linear':      [0,    0,    1,    1],
  };

  const easingCurvePath = document.getElementById('easing-curve');

  function drawEasingGraph(name) {
    const [x1, y1, x2, y2] = EASING_CURVES[name] || EASING_CURVES['ease'];
    // SVG viewBox is 0 0 1 1; y is flipped (0=top, 1=bottom)
    easingCurvePath.setAttribute('d',
      `M 0 1 C ${x1} ${1 - y1} ${x2} ${1 - y2} 1 0`);
  }

  document.getElementById('ctrl-blur-easing').addEventListener('change', (e) => {
    blurEasing = e.target.value;
    drawEasingGraph(blurEasing);
  });

  drawEasingGraph(blurEasing);          // initial draw

  /* ── Pill click: expand when collapsed ── */
  pill.addEventListener('click', () => {
    if (islandState === 'collapsed') expandIsland();
  });

  /* ── Island hover: collapsed ↔ expanded ── */
  let leaveTimer = null;
  let suppressHover = false;       // true after roll/eject click until mouse leaves

  function isInEjectZone(e) {
    const r = clearBtn.getBoundingClientRect();
    const pad = 15;
    return e.clientX >= r.left - pad && e.clientX <= r.right + pad &&
           e.clientY >= r.top - pad  && e.clientY <= r.bottom + pad;
  }

  function tryExpand(e) {
    if (suppressHover || islandState !== 'collapsed') return;
    if (isInEjectZone(e)) return;
    expandIsland();
  }

  island.addEventListener('mouseenter', (e) => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    tryExpand(e);
  });

  // If mouseenter was blocked (cursor entered over eject button),
  // expand once the cursor moves off it while still inside the island.
  island.addEventListener('mousemove', tryExpand);

  island.addEventListener('mouseleave', () => {
    suppressHover = false;
    if (islandState === 'expanded') {
      leaveTimer = setTimeout(() => { leaveTimer = null; collapseIsland(); }, 60);
    }
  });

  /* ── Individual roll hover: lift 10px ── */
  rolls.forEach(roll => {
    roll.addEventListener('mouseenter', () => {
      if (islandState !== 'expanded') return;
      if (skipNextTick) skipNextTick = false;
      else playSfx(sfx.tick);
      animate(roll, { y: -10 }, spring);
    });
    roll.addEventListener('mouseleave', () => {
      if (islandState !== 'expanded') return;
      animate(roll, { y: 0 }, spring);
    });
  });

  /* ── Roll clicks: select film + collapse ── */
  rolls.forEach(roll => {
    roll.addEventListener('click', (e) => {
      e.stopPropagation();
      const filmId = roll.dataset.film;
      suppressHover = true;
      switchFilm(filmId);
      collapseIsland();
    });
  });

  /* ── Eject icon click: clear to "no film" + spin 360° CCW ── */
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const svg = clearBtn.querySelector('svg');
    suppressHover = true;
    playSfx(sfx.eject);
    animate(svg, { rotate: [45, 45 - 360] }, { duration: 0.5, easing: 'ease-out' });
    switchFilm('none');
  });

  /* ── Sidebar film buttons sync ── */
  filmBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchFilm(btn.dataset.film);
      if (islandState === 'expanded') collapseIsland();
    });
  });

  /* ── Initialize ── */
  // Set initial pill size
  island.style.width = `${PILL_W}px`;
  island.style.height = `${PILL_H}px`;
  island.style.borderRadius = '70px';

  // Set rolls to hidden initial state
  tray.style.display = 'none';
  rolls.forEach(roll => {
    roll.style.transform = 'translateY(20px)';
    roll.style.opacity = '0';
  });

  updatePill();
  applyStockDefaults();

  /* ── Sidebar: hidden by default, toggle with Cmd+O / Ctrl+O ── */
  sidebarRoot.classList.add('hidden');
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
      e.preventDefault();
      sidebarRoot.classList.toggle('hidden');
    }
  });
}
