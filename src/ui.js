import STOCKS from './film-stocks.js';
import { animate } from 'motion';

/**
 * Generate a noise-textured card image as a data URL.
 * Draws the stock's gradient, then overlays fine monochrome noise.
 */
function generateCardTexture(gradient, size = 232) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Draw base gradient — parse the CSS gradient into a canvas gradient
  // cardGradient format: "linear-gradient(236deg, #color1 4%, #color2 96%)"
  const match = gradient.match(/#[0-9a-fA-F]{6}/g);
  if (match && match.length >= 2) {
    // 236deg ≈ bottom-left to top-right direction
    const grad = ctx.createLinearGradient(size, 0, 0, size);
    grad.addColorStop(0, match[0]);
    grad.addColorStop(1, match[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Overlay fine noise
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 40;
    data[i]     = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png');
}

/**
 * Build the sidebar + demo content DOM and wire controls to a FilmEmulator instance.
 *
 * @param {FilmEmulator} emulator
 * @param {HTMLElement}  sidebarRoot     – container that will hold sidebar markup
 * @param {HTMLElement}  contentRoot     – the #content div (also the grade target)
 * @param {HTMLElement}  statusTextEl    – element for film name in the status bar
 * @param {HTMLElement}  cardSelectorEl  – container for stacked card film selector
 */
export function initUI(emulator, sidebarRoot, contentRoot, statusTextEl, cardSelectorEl) {
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
          <div class="film-swatch swatch-${s.swatch}"></div>
          <div class="film-btn-info">
            <span class="film-btn-name">${s.name}</span>
            <span class="film-btn-desc">${s.description}</span>
          </div>
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
      <div class="control-row">
        <div class="control-label">Vignette <span id="val-vignette">1.00</span></div>
        <input type="range" id="ctrl-vignette" min="0" max="2.0" step="0.05" value="1.0">
      </div>
    </div>

    <div class="section-label">Animation</div>
    <div class="controls">
      <div class="control-row">
        <div class="control-label">Duration <span id="val-duration">0.40</span></div>
        <input type="range" id="ctrl-duration" min="0.1" max="1.5" step="0.05" value="0.40">
      </div>
      <div class="control-row">
        <div class="control-label">Bounce <span id="val-bounce">0.15</span></div>
        <input type="range" id="ctrl-bounce" min="0" max="0.5" step="0.01" value="0.15">
      </div>
      <div class="control-row">
        <div class="control-label">Fan Spread <span id="val-spread">80</span></div>
        <input type="range" id="ctrl-spread" min="40" max="200" step="5" value="80">
      </div>
      <div class="control-row">
        <div class="control-label">Brightness <span id="val-dim">0.00</span></div>
        <input type="range" id="ctrl-dim" min="-1" max="1" step="0.05" value="0.00">
      </div>
    </div>
  `;

  /* ── Demo content ──────────────────────────────────────────── */
  contentRoot.innerHTML = `
    <p class="content-eyebrow">Interactive Demo — content is fully live</p>
    <h2 class="content-title">The <em>grain</em> remembers<br>what the eye forgets</h2>

    <p class="interactive-note">
      ↓ Everything below is real DOM. Click, type, scroll — the film effect is a pure overlay.
    </p>

    <p class="content-body">
      Silver halide crystals suspended in gelatin. Each frame a unique
      arrangement of imperfection — a texture that carries time, light,
      and the chemistry of the moment. No two frames identical.
    </p>

    <div class="content-input-row">
      <input class="content-input" type="text" placeholder="Type something here…" />
      <button class="content-btn" id="demo-submit">Submit</button>
    </div>

    <div class="content-grid">
      <div class="content-card" data-demo="iso">
        <div class="content-card-label">ISO · click me</div>
        <div class="content-card-val">400</div>
      </div>
      <div class="content-card" data-demo="aperture">
        <div class="content-card-label">Aperture · click me</div>
        <div class="content-card-val">f/2.8</div>
      </div>
      <div class="content-card" data-demo="speed">
        <div class="content-card-label">Speed · click me</div>
        <div class="content-card-val">1/60</div>
      </div>
    </div>

    <div class="content-strip">
      <div class="content-block" style="background:#c8b89a;"></div>
      <div class="content-block" style="background:#b0a080;"></div>
      <div class="content-block" style="background:#d4c4a8;"></div>
      <div class="content-block" style="background:#a09070;"></div>
      <div class="content-block" style="background:#e0d4bc;"></div>
    </div>

    <div>
      <a class="content-link" href="#" onclick="return false">→ About this technique</a><br>
      <a class="content-link" href="#" onclick="return false">→ Film stock reference</a><br>
      <a class="content-link" href="#" onclick="return false">→ WebGL shader source</a>
    </div>
  `;

  /* ── Wire film buttons (wired after card selector sets up switchFilm) ── */
  const filmBtns = sidebarRoot.querySelectorAll('.film-btn');

  /* ── Wire sliders ──────────────────────────────────────────── */
  const sliders = [
    { inputId: 'ctrl-intensity', valueId: 'val-intensity', prop: 'intensity',      key: 'intensity' },
    { inputId: 'ctrl-size',      valueId: 'val-size',      prop: 'size',           key: 'size' },
    { inputId: 'ctrl-grade',     valueId: 'val-grade',     prop: 'grade',          key: 'grade' },
    { inputId: 'ctrl-vignette',  valueId: 'val-vignette',  prop: 'vignetteAmount', key: 'vignette' },
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

  /* ── Wire demo interactions ────────────────────────────────── */
  const submitBtn = document.getElementById('demo-submit');
  submitBtn.addEventListener('click', () => {
    submitBtn.textContent = submitBtn.textContent === 'Submit' ? 'Sent ✓' : 'Submit';
  });

  contentRoot.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => {
      const val = card.querySelector('.content-card-val');
      switch (card.dataset.demo) {
        case 'iso':
          val.textContent = Math.floor(Math.random() * 800 + 100);
          break;
        case 'aperture':
          val.textContent = 'f/' + (Math.random() * 8 + 1.4).toFixed(1);
          break;
        case 'speed':
          val.textContent = '1/' + Math.floor(Math.random() * 500 + 30);
          break;
      }
    });
  });

  /* ── Stacked card film selector ──────────────────────────────── */
  const cardStockIds = Object.keys(STOCKS).filter(id => id !== 'none');
  const spring = { type: 'spring', visualDuration: 0.4, bounce: 0.15 };

  // Mutable fan params — updated by animation sliders
  const fanParams = { spread: 80, brightness: 0 };

  // Label sits above card: label height (~19) + 10px gap (per Figma)
  const LABEL_Y_OFFSET = -29;

  // Idle: flat stack with rotateZ tilts, active on top
  const idlePositions = [
    { x: 0, y: 0, rotateZ: -3, scale: 1 },
    { x: 0, y: 0, rotateZ: 3,  scale: 1 },
    { x: 0, y: 0, rotateZ: 0,  scale: 1 },
  ];

  // Fan: flat horizontal spread — side cards tucked behind center
  function getFanPositions() {
    const s = fanParams.spread;
    return [
      { x: -s, y: 0, rotateZ: -6, scale: 1 },
      { x: 0,  y: 0, rotateZ: 0,  scale: 1 },
      { x: s,  y: 0, rotateZ: 6,  scale: 1 },
    ];
  }

  // Individual card hover lift within fan
  function getFanHoverLifts() {
    const s = fanParams.spread;
    return [
      { x: -s, y: -40, rotateZ: -6, scale: 1 },
      { x: 0,  y: -40, rotateZ: 0,  scale: 1 },
      { x: s,  y: -40, rotateZ: 6,  scale: 1 },
    ];
  }

  // Pre-generate noise textures for each card
  const cardTextures = {};
  for (const id of cardStockIds) {
    cardTextures[id] = generateCardTexture(STOCKS[id].cardGradient);
  }

  cardSelectorEl.innerHTML = `
    <div class="card-stack">
      <span class="card-label"></span>
      ${cardStockIds.map(id => {
        return `<div class="film-card" data-film="${id}"><div class="film-card-fill" style="background:url(${cardTextures[id]}) center/cover"></div></div>`;
      }).join('')}
    </div>
  `;

  const cardLabel = cardSelectorEl.querySelector('.card-label');
  const cardStackEl = cardSelectorEl.querySelector('.card-stack');
  const filmCards = [...cardSelectorEl.querySelectorAll('.film-card')];

  // State: 'idle' | 'fan' | 'selected'
  let cardState = 'idle';
  let selectedCardId = null;

  /** Get ordered array: active card last (on top). */
  function getCardOrder() {
    const activeId = emulator.filmId;
    const ordered = cardStockIds.filter(id => id !== activeId);
    if (cardStockIds.includes(activeId)) {
      ordered.push(activeId);
    } else {
      ordered.push(cardStockIds[0]);
    }
    return ordered;
  }

  /** Apply dimming to non-active cards via CSS filter. */
  function setCardDim(card, dimmed) {
    card.style.filter = dimmed ? `brightness(${1 + fanParams.brightness}) saturate(0.5)` : '';
  }

  /** Animate cards to idle stack position. */
  function animateIdle() {
    cardState = 'idle';
    selectedCardId = null;
    const ordered = getCardOrder();

    filmCards.forEach(card => {
      const id = card.dataset.film;
      const idx = ordered.indexOf(id);
      card.style.zIndex = idx + 1;
      setCardDim(card, false);
      animate(card, idlePositions[idx], spring);
    });

    // Hide label in idle
    cardLabel.classList.remove('visible');
    animate(cardLabel, { x: 0, y: LABEL_Y_OFFSET, rotateZ: 0 }, spring);
  }

  /** Animate cards to flat fan spread. */
  function animateFan() {
    cardState = 'fan';
    selectedCardId = null;
    const ordered = getCardOrder();
    const activeId = emulator.filmId;
    const fanPos = getFanPositions();

    filmCards.forEach(card => {
      const id = card.dataset.film;
      const idx = ordered.indexOf(id);
      const isActive = id === activeId;
      card.style.zIndex = idx + 1;
      setCardDim(card, !isActive);
      animate(card, fanPos[idx], spring);
    });

    // Show active film name above the active card's position
    const displayId = cardStockIds.includes(activeId) ? activeId : cardStockIds[0];
    const activeIdx = ordered.indexOf(displayId);
    const pos = fanPos[activeIdx] ?? { x: 0, y: 0, rotateZ: 0 };
    cardLabel.textContent = STOCKS[displayId].cardName.toUpperCase();
    cardLabel.classList.add('visible');
    animate(cardLabel, { x: pos.x, y: pos.y + LABEL_Y_OFFSET, rotateZ: pos.rotateZ }, spring);
  }

  /** Animate to selected state: clicked card pops then returns to idle. */
  function animateSelected(clickedId) {
    cardState = 'selected';
    selectedCardId = clickedId;

    // Hide label during selection animation
    cardLabel.classList.remove('visible');
    animate(cardLabel, { x: 0, y: LABEL_Y_OFFSET, rotateZ: 0 }, spring);

    filmCards.forEach(card => {
      const id = card.dataset.film;
      if (id === clickedId) {
        card.style.zIndex = 10;
        setCardDim(card, false);
      } else {
        card.style.zIndex = 1;
        setCardDim(card, true);
      }
      animate(card, { x: 0, y: 0, rotateZ: 0, scale: 1 }, spring);
    });

    // Settle: return to idle stack after the pop
    setTimeout(() => {
      if (cardState !== 'selected' || selectedCardId !== clickedId) return;
      animateIdle();
    }, 500);
  }

  function switchFilm(filmId) {
    emulator.filmId = filmId;
    filmBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.film === filmId);
    });
    statusTextEl.textContent = emulator.stock.name;
    applyStockDefaults();
    emulator.apply();
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

  document.getElementById('ctrl-spread').addEventListener('input', (e) => {
    fanParams.spread = parseFloat(e.target.value);
    document.getElementById('val-spread').textContent = fanParams.spread.toFixed(0);
    if (cardState === 'fan') animateFan();
  });

  document.getElementById('ctrl-dim').addEventListener('input', (e) => {
    fanParams.brightness = parseFloat(e.target.value);
    document.getElementById('val-dim').textContent = fanParams.brightness.toFixed(2);
    // Re-apply dimming to currently dimmed cards in fan state
    if (cardState === 'fan') {
      filmCards.forEach(card => {
        const isActive = card.dataset.film === emulator.filmId;
        if (!isActive) setCardDim(card, true);
      });
    }
  });

  /* ── Hover: idle ↔ fan ── */
  let leaveTimer = null;
  cardStackEl.addEventListener('mouseenter', () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    if (cardState === 'idle') animateFan();
  });

  cardStackEl.addEventListener('mouseleave', () => {
    if (cardState === 'fan') {
      leaveTimer = setTimeout(() => { leaveTimer = null; animateIdle(); }, 60);
    }
  });

  /* ── Individual card hover within fan — elevate card + label follows ── */
  filmCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      if (cardState !== 'fan') return;
      const id = card.dataset.film;
      const ordered = getCardOrder();
      const idx = ordered.indexOf(id);
      const hoverPos = getFanHoverLifts()[idx];
      // Elevate hovered card
      animate(card, hoverPos, spring);
      // Move label above hovered card
      cardLabel.textContent = STOCKS[id].cardName.toUpperCase();
      animate(cardLabel, { x: hoverPos.x, y: hoverPos.y + LABEL_Y_OFFSET, rotateZ: hoverPos.rotateZ }, spring);
    });

    card.addEventListener('mouseleave', () => {
      if (cardState !== 'fan') return;
      const ordered = getCardOrder();
      const idx = ordered.indexOf(card.dataset.film);
      const fanPos = getFanPositions();
      // Return card to fan position
      animate(card, fanPos[idx], spring);
      // Restore label to active card's position
      const activeId = emulator.filmId;
      const displayId = cardStockIds.includes(activeId) ? activeId : cardStockIds[0];
      const activeIdx = ordered.indexOf(displayId);
      const ap = fanPos[activeIdx] ?? { x: 0, y: 0, rotateZ: 0 };
      cardLabel.textContent = STOCKS[displayId].cardName.toUpperCase();
      animate(cardLabel, { x: ap.x, y: ap.y + LABEL_Y_OFFSET, rotateZ: ap.rotateZ }, spring);
    });
  });

  /* ── Card clicks ── */
  filmCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = card.dataset.film;

      if (cardState === 'fan') {
        switchFilm(id);
        animateSelected(id);
      } else if (cardState === 'selected') {
        if (id === selectedCardId) {
          animateFan();
        } else {
          switchFilm(id);
          animateSelected(id);
        }
      } else {
        switchFilm(id);
      }
    });
  });

  /* ── Click outside to dismiss selected state ── */
  document.addEventListener('click', (e) => {
    if (cardState === 'selected' && !cardSelectorEl.contains(e.target)) {
      animateIdle();
    }
  });

  // Sidebar buttons sync + reset card stack
  filmBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchFilm(btn.dataset.film);
      animateIdle();
    });
  });

  /* ── Set initial defaults + status ───────────────────────────── */
  applyStockDefaults();
  animateIdle();
  statusTextEl.textContent = emulator.stock.name;
}
