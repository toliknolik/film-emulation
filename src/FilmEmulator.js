import STOCKS from './film-stocks.js';
import { VERT_SRC, FRAG_SRC } from './shaders.js';

/**
 * FilmEmulator — manages three independent overlay layers:
 *
 *  1. Color grade  →  CSS filter on the content element
 *  2. Grain        →  WebGL canvas, mix-blend-mode: soft-light, pointer-events: none
 *  3. Motion blur  →  SVG filter graph on content-blur-wrapper, driven by scroll velocity
 *
 * The WebGL context is created WITHOUT alpha (alpha: false) so the canvas
 * backbuffer is opaque RGB. The grain shader writes 0.5-centred grey;
 * soft-light treats that as neutral. If alpha were enabled the browser would
 * premultiply and the blend math would break.
 */

/**
 * Parse an `rgba(r, g, b, a)` string into [r, g, b, a] with r/g/b in 0–1.
 */
function parseRGBA(rgba) {
  const m = rgba.match(/[\d.]+/g);
  if (!m || m.length < 4) return [0, 0, 0, 0];
  return [+m[0] / 255, +m[1] / 255, +m[2] / 255, +m[3]];
}

/**
 * Build an feColorMatrix `values` string that tints the image and scales alpha.
 * The matrix adds a color bias (tint) and scales opacity.
 *
 *   R' = R + tintR * tintA * strength
 *   G' = G + tintG * tintA * strength
 *   B' = B + tintB * tintA * strength
 *   A' = A * opacity
 */
function buildTintMatrix(rgbaString, opacity) {
  const [r, g, b, a] = parseRGBA(rgbaString);
  const rAdd = (r * a).toFixed(4);
  const gAdd = (g * a).toFixed(4);
  const bAdd = (b * a).toFixed(4);
  return `1 0 0 0 ${rAdd}  0 1 0 0 ${gAdd}  0 0 1 0 ${bAdd}  0 0 0 ${opacity.toFixed(4)} 0`;
}

export default class FilmEmulator {
  /**
   * @param {object} opts
   * @param {HTMLElement}      opts.content        – the element that gets the CSS filter
   * @param {HTMLElement}      opts.blurWrapper    – wrapper that receives SVG motion blur filter
   * @param {HTMLCanvasElement} opts.grainCanvas    – canvas for WebGL grain overlay
   * @param {function}         [opts.onStatusChange] – called with status strings
   */
  constructor({ content, blurWrapper, grainCanvas, onStatusChange }) {
    this._content = content;
    this._blurWrapper = blurWrapper;
    this._canvas = grainCanvas;
    this._onStatus = onStatusChange || (() => {});

    this._filmId = 'portra';
    this._intensity = 1.0;
    this._size = 1.0;
    this._grade = 1.0;
    this._blur = 0;
    this._shutter = 0;

    // Scroll-driven shutter state
    this._scrollY = 0;
    this._scrollVelocity = 0;        // smoothed velocity magnitude (px/ms)
    this._scrollDir = 1;             // scroll direction: +1 down, -1 up
    this._shutterActive = false;     // whether the decay rAF loop is running
    this._lastScrollTime = 0;

    // Cursor-driven blur state
    this._cursorBlur = false;
    this._mouseVelX = 0;
    this._mouseVelY = 0;
    this._lastMouseX = 0;
    this._lastMouseY = 0;
    this._lastMouseTime = 0;
    this._cursorActive = false;

    // Gyroscope-driven blur state
    this._gyroBlur = false;
    this._gyroVelX = 0;        // gamma-derived (left/right)
    this._gyroVelY = 0;        // beta-derived (forward/back)
    this._gyroActive = false;
    this._gyroPermission = 'unknown'; // 'unknown' | 'granted' | 'denied' | 'unavailable'

    // WebGL state
    this._gl = null;
    this._prog = null;
    this._uLocs = null;

    this._initGL();
    this._initSVGFilterRefs();
    this._onResize = () => this.apply();
    window.addEventListener('resize', this._onResize);
    this._initScrollTracker();
    this._initCursorTracker();
  }

  /* ── public API ────────────────────────────────────────────── */

  get filmId() { return this._filmId; }
  set filmId(id) {
    if (!(id in STOCKS)) return;
    this._filmId = id;
  }

  get stock() { return STOCKS[this._filmId]; }

  get intensity() { return this._intensity; }
  set intensity(v) { this._intensity = v; }

  get size() { return this._size; }
  set size(v) { this._size = v; }

  get grade() { return this._grade; }
  set grade(v) { this._grade = v; }

  get blur() { return this._blur; }
  set blur(v) { this._blur = Math.max(0, v); }

  get shutter() { return this._shutter; }
  set shutter(v) { this._shutter = Math.max(0, Math.min(1, v)); }

  get cursorBlur() { return this._cursorBlur; }
  set cursorBlur(v) { this._cursorBlur = !!v; }

  get gyroBlur() { return this._gyroBlur; }
  set gyroBlur(v) {
    this._gyroBlur = !!v;
    if (!v) {
      this._gyroVelX = 0;
      this._gyroVelY = 0;
    }
  }

  /** Request gyroscope permission (iOS requires user gesture). Returns permission state string. */
  async requestGyroPermission() {
    if (typeof DeviceMotionEvent === 'undefined') {
      this._gyroPermission = 'unavailable';
      return this._gyroPermission;
    }

    // iOS 13+ requires explicit permission request
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const result = await DeviceMotionEvent.requestPermission();
        this._gyroPermission = result; // 'granted' or 'denied'
      } catch {
        this._gyroPermission = 'denied';
      }
    } else {
      // Android / older iOS — auto-granted
      this._gyroPermission = 'granted';
    }

    if (this._gyroPermission === 'granted') {
      this._initGyroTracker();
    }

    return this._gyroPermission;
  }

  /** Apply all layers in one shot. */
  apply() {
    this._applyGrade();
    this._renderGrain();
  }

  /** Update just the CSS filter (grade + blur) without re-rendering grain. */
  applyFilter() { this._applyGrade(); }

  /** Clean up event listeners and GL resources. */
  destroy() {
    window.removeEventListener('resize', this._onResize);
    if (this._gl) {
      this._gl.deleteProgram(this._prog);
      this._gl.deleteBuffer(this._quadVbo);
    }
  }

  /* ── WebGL init ────────────────────────────────────────────── */

  _initGL() {
    // CRITICAL: alpha: false — the grain shader outputs 0.5-centred grey.
    // With an opaque backbuffer, mix-blend-mode: soft-light sees solid grey.
    // If alpha were true, the browser would premultiply and soft-light breaks.
    const gl = this._canvas.getContext('webgl', { alpha: false });
    if (!gl) {
      this._onStatus('WebGL N/A');
      return;
    }
    this._gl = gl;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
      }
      return s;
    };

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(prog);
    this._prog = prog;

    this._quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1, 1,
       1, -1,  1,  1, -1, 1,
    ]), gl.STATIC_DRAW);

    this._uLocs = {
      aPos:        gl.getAttribLocation(prog, 'aPos'),
      uIntensity:  gl.getUniformLocation(prog, 'uIntensity'),
      uSize:       gl.getUniformLocation(prog, 'uSize'),
      uSeed:       gl.getUniformLocation(prog, 'uSeed'),
      uChannelSep: gl.getUniformLocation(prog, 'uChannelSep'),
      uMono:       gl.getUniformLocation(prog, 'uMono'),
      uRes:        gl.getUniformLocation(prog, 'uRes'),
    };

    this._onStatus('WebGL active');
  }

  /* ── grain (WebGL) ─────────────────────────────────────────── */

  _renderGrain() {
    const gl = this._gl;
    if (!gl) return;

    const stock = this.stock;
    const eff = stock.grainIntensity * this._intensity;

    if (eff <= 0) {
      this._canvas.style.opacity = '0';
      return;
    }

    const w = this._canvas.offsetWidth;
    const h = this._canvas.offsetHeight;
    if (this._canvas.width !== w || this._canvas.height !== h) {
      this._canvas.width = w;
      this._canvas.height = h;
    }

    gl.viewport(0, 0, w, h);
    gl.useProgram(this._prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadVbo);
    gl.enableVertexAttribArray(this._uLocs.aPos);
    gl.vertexAttribPointer(this._uLocs.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(this._uLocs.uIntensity, eff);
    gl.uniform1f(this._uLocs.uSize, stock.grainSize * this._size);
    gl.uniform1f(this._uLocs.uSeed, Math.random() * 100.0);
    gl.uniform1f(this._uLocs.uChannelSep, stock.channelSep);
    gl.uniform1f(this._uLocs.uMono, stock.monoGrain ? 1.0 : 0.0);
    gl.uniform2f(this._uLocs.uRes, w, h);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this._canvas.style.opacity = '1';
  }

  /* ── color grade (CSS filter) ──────────────────────────────── */

  _applyGrade() {
    const stock = this.stock;
    const filter = stock.buildCSSFilter(this._grade);
    this._content.style.filter = filter;
  }

  /* ── SVG motion blur filter refs ───────────────────────────── */

  _initSVGFilterRefs() {
    // Safari chokes on feTurbulence/feDisplacementMap — use simplified filter
    this._isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const filterId = this._isSafari ? 'motionBlurSimple' : 'motionBlur';
    this._svgFilterId = filterId;

    const filter = document.getElementById(filterId);
    if (!filter) return;

    const q = (result) => filter.querySelector(`[result="${result}"]`);

    if (this._isSafari) {
      // Simple filter: no wobble elements, 5 ghost layers
      this._svgBase = q('sBase');
      this._svgTurbulence = null;
      this._trailRefs = [
        [q('s1Off'), q('s1Blur'), null, q('s1')],
        [q('s2Off'), q('s2Blur'), null, q('s2')],
        [q('s3Off'), q('s3Blur'), null, q('s3')],
        [q('s4Off'), q('s4Blur'), null, q('s4')],
        [q('s5Off'), q('s5Blur'), null, q('s5')],
      ];
    } else {
      // Full filter with wobble, 5 ghost layers
      this._svgBase = q('base');
      this._svgTurbulence = q('wobbleNoise');
      this._trailRefs = [
        [q('g1Off'), q('g1Blur'), q('g1Wobble'), q('g1')],
        [q('g2Off'), q('g2Blur'), q('g2Wobble'), q('g2')],
        [q('g3Off'), q('g3Blur'), q('g3Wobble'), q('g3')],
        [q('g4Off'), q('g4Blur'), q('g4Wobble'), q('g4')],
        [q('g5Off'), q('g5Blur'), q('g5Wobble'), q('g5')],
      ];
    }
    this._wobbleFrame = 0;
  }

  /* ── slow shutter (SVG directional motion blur) ────────────── */

  _initScrollTracker() {
    // Desktop: scroll events on the content div
    this._content.addEventListener('scroll', () => {
      const now = performance.now();
      const dy = this._content.scrollTop - this._scrollY;
      const dt = now - this._lastScrollTime || 16;
      this._scrollY = this._content.scrollTop;
      this._lastScrollTime = now;

      if (dy !== 0) this._scrollDir = dy > 0 ? -1 : 1;

      const vel = Math.abs(dy) / dt;
      this._scrollVelocity = Math.max(this._scrollVelocity, vel);

      if (!this._shutterActive) this._startShutterLoop();
    }, { passive: true });

    // Mobile: touchmove fires reliably during scroll on iOS Safari
    // (scroll events are throttled during momentum scrolling)
    let lastTouchY = 0;
    let lastTouchTime = 0;

    this._content.addEventListener('touchstart', (e) => {
      lastTouchY = e.touches[0].clientY;
      lastTouchTime = performance.now();
    }, { passive: true });

    this._content.addEventListener('touchmove', (e) => {
      if (this._shutter <= 0) return;
      const now = performance.now();
      const y = e.touches[0].clientY;
      const dy = y - lastTouchY;
      const dt = now - lastTouchTime || 16;

      if (dy !== 0) this._scrollDir = dy > 0 ? 1 : -1; // touch moves opposite to scroll

      const vel = Math.abs(dy) / dt;
      this._scrollVelocity = Math.max(this._scrollVelocity, vel);

      lastTouchY = y;
      lastTouchTime = now;

      if (!this._shutterActive) this._startShutterLoop();
    }, { passive: true });
  }

  /* ── Trail color tints per stock (null = no color trails) ── */
  _getTrailTints() {
    const palettes = {
      eterna: [
        'rgba(0, 70, 85, 0.15)',      // ghost 1: teal (subtle on sharp copy)
        'rgba(140, 100, 30, 0.18)',   // ghost 2: amber
        'rgba(0, 65, 80, 0.22)',      // ghost 3: teal
        'rgba(170, 110, 30, 0.20)',   // ghost 4: amber
        'rgba(0, 55, 75, 0.15)',      // ghost 5: deep teal
      ],
    };
    return palettes[this._filmId] || null;
  }

  _resetSVGFilter() {
    if (!this._svgBase) return;
    const zero = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 0';
    this._svgBase.setAttribute('stdDeviation', '0 0');
    for (const [offEl, blurEl, wobbleEl, tintEl] of this._trailRefs) {
      offEl.setAttribute('dx', '0');
      offEl.setAttribute('dy', '0');
      blurEl.setAttribute('stdDeviation', '0 0');
      if (wobbleEl) wobbleEl.setAttribute('scale', '0');
      tintEl.setAttribute('values', zero);
    }
    // Restore clean CSS grade (remove motion blur from content)
    this._content.style.filter = this.stock.buildCSSFilter(this._grade);
  }

  /* ── Unified motion blur applicator ─────────────────────────── */

  // 5 ghost layers: sharp afterimage → soft trailing smear
  // Near ghosts: minimal blur (visible copies), high opacity, fast decay
  // Far ghosts: heavy blur (smear tail), low opacity, slow decay (lingers)
  static TRAIL_CONFIGS = [
    { offsetScale: 3,  blurScale: 0.4, opacity: 0.75, wobbleScale: 2,  decay: 0.78 },  // ghost 1: sharp copy
    { offsetScale: 7,  blurScale: 1.2, opacity: 0.55, wobbleScale: 5,  decay: 0.82 },  // ghost 2: slight blur
    { offsetScale: 12, blurScale: 3,   opacity: 0.40, wobbleScale: 10, decay: 0.87 },  // ghost 3: medium
    { offsetScale: 18, blurScale: 6,   opacity: 0.25, wobbleScale: 18, decay: 0.91 },  // ghost 4: soft
    { offsetScale: 26, blurScale: 10,  opacity: 0.12, wobbleScale: 28, decay: 0.94 },  // ghost 5: faint smear
  ];

  // Soft onset lerp rate — how fast the displayed strength catches up to target
  static ONSET_LERP = 0.25;

  /**
   * Apply SVG filter with direction + per-trail strengths.
   * @param {number} dirX - normalized X direction
   * @param {number} dirY - normalized Y direction
   * @param {number} baseStrength - base blur strength (for the base feGaussianBlur)
   * @param {number[]} trailStrengths - per-trail strength [near, mid, far]
   */
  _applySVGBlur(dirX, dirY, baseStrength, trailStrengths) {
    const maxBlur = window.innerWidth < 600 ? 10 : 15;

    // Base directional blur
    const baseMag = Math.min(baseStrength * 4, maxBlur);
    const bx = Math.min(Math.abs(dirX) * baseMag, maxBlur).toFixed(1);
    const by = Math.min(Math.abs(dirY) * baseMag, maxBlur).toFixed(1);
    this._svgBase.setAttribute('stdDeviation', `${bx} ${by}`);

    // Animate turbulence seed every 3 frames for organic shift
    this._wobbleFrame++;
    if (this._wobbleFrame % 3 === 0 && this._svgTurbulence) {
      this._svgTurbulence.setAttribute('seed', String(this._wobbleFrame / 3 & 0xFF));
    }

    // Trail samples with per-layer strength
    const tints = this._getTrailTints();
    const configs = FilmEmulator.TRAIL_CONFIGS;

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const s = trailStrengths[i];
      const [offEl, blurEl, wobbleEl, tintEl] = this._trailRefs[i];
      const dx = dirX * s * cfg.offsetScale;
      const dy = dirY * s * cfg.offsetScale;
      const sdX = Math.min(Math.abs(dirX) * s * cfg.blurScale, maxBlur);
      const sdY = Math.min(Math.abs(dirY) * s * cfg.blurScale, maxBlur);
      const opacity = cfg.opacity * s;
      const wobble = s * cfg.wobbleScale;

      offEl.setAttribute('dx', dx.toFixed(1));
      offEl.setAttribute('dy', dy.toFixed(1));
      blurEl.setAttribute('stdDeviation', `${sdX.toFixed(1)} ${sdY.toFixed(1)}`);
      if (wobbleEl) wobbleEl.setAttribute('scale', wobble.toFixed(1));

      if (tints) {
        tintEl.setAttribute('values', buildTintMatrix(tints[i], opacity));
      } else {
        tintEl.setAttribute('values',
          `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${opacity.toFixed(4)} 0`);
      }
    }

    // SVG filter for trails (+ wobble on non-Safari)
    this._blurWrapper.style.filter = `url(#${this._svgFilterId})`;

    // CSS blur fallback on content — always works, provides base motion blur
    const cssBl = Math.min(baseStrength * 6, maxBlur);
    const grade = this.stock.buildCSSFilter(this._grade);
    this._content.style.filter = grade
      ? `${grade} blur(${cssBl.toFixed(1)}px)`
      : `blur(${cssBl.toFixed(1)}px)`;
  }

  /* ── Scroll-driven shutter loop ────────────────────────────── */

  _startShutterLoop() {
    if (this._shutter <= 0 || !this._svgBase) return;
    this._shutterActive = true;

    // Per-trail displayed strength (soft onset lerp targets)
    const display = [0, 0, 0, 0, 0];
    const configs = FilmEmulator.TRAIL_CONFIGS;
    const lerp = FilmEmulator.ONSET_LERP;

    const tick = () => {
      this._scrollVelocity *= 0.88;

      const rawT = Math.min(this._scrollVelocity / 1.5, 1);
      const target = rawT * this._shutter;

      // Per-trail decay + soft onset
      let anyActive = false;
      for (let i = 0; i < configs.length; i++) {
        const goal = target * configs[i].decay / 0.88; // scale target by relative decay
        // Lerp toward target (soft onset), then apply per-trail decay
        display[i] = display[i] + (goal - display[i]) * lerp;
        display[i] *= configs[i].decay;
        if (display[i] > 0.001) anyActive = true;
      }

      if (!anyActive && target < 0.001) {
        this._scrollVelocity = 0;
        this._shutterActive = false;
        if (!this._cursorActive && !this._gyroActive) {
          this._blurWrapper.style.filter = '';
          this._resetSVGFilter();
        }
        return;
      }

      this._applySVGBlur(0, this._scrollDir, target, display);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── Cursor-driven motion blur ─────────────────────────────── */

  _initCursorTracker() {
    this._blurWrapper.addEventListener('mousemove', (e) => {
      if (!this._cursorBlur || this._shutter <= 0) return;

      const now = performance.now();
      const dt = now - this._lastMouseTime || 16;

      if (this._lastMouseTime > 0) {
        const dx = e.clientX - this._lastMouseX;
        const dy = e.clientY - this._lastMouseY;
        const velX = dx / dt;
        const velY = dy / dt;
        // Take peak velocity per axis (allows building up momentum)
        this._mouseVelX = Math.abs(velX) > Math.abs(this._mouseVelX) ? velX : this._mouseVelX;
        this._mouseVelY = Math.abs(velY) > Math.abs(this._mouseVelY) ? velY : this._mouseVelY;
      }

      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
      this._lastMouseTime = now;

      if (!this._cursorActive) this._startCursorLoop();
    }, { passive: true });
  }

  _startCursorLoop() {
    if (this._shutter <= 0 || !this._svgBase) return;
    this._cursorActive = true;

    const display = [0, 0, 0, 0, 0];
    const configs = FilmEmulator.TRAIL_CONFIGS;
    const lerp = FilmEmulator.ONSET_LERP;

    const tick = () => {
      this._mouseVelX *= 0.85;
      this._mouseVelY *= 0.85;

      const mag = Math.sqrt(this._mouseVelX ** 2 + this._mouseVelY ** 2);
      const rawT = Math.min(mag / 1.5, 1);
      const target = rawT * this._shutter;

      let anyActive = false;
      for (let i = 0; i < configs.length; i++) {
        const goal = target * configs[i].decay / 0.85;
        display[i] = display[i] + (goal - display[i]) * lerp;
        display[i] *= configs[i].decay;
        if (display[i] > 0.001) anyActive = true;
      }

      if (!anyActive && target < 0.001) {
        this._mouseVelX = 0;
        this._mouseVelY = 0;
        this._cursorActive = false;
        if (!this._shutterActive && !this._gyroActive) {
          this._blurWrapper.style.filter = '';
          this._resetSVGFilter();
        }
        return;
      }

      const dirX = mag > 0.001 ? -this._mouseVelX / mag : 0;
      const dirY = mag > 0.001 ? -this._mouseVelY / mag : 0;

      this._applySVGBlur(dirX, dirY, target, display);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── Gyroscope-driven motion blur ──────────────────────────── */

  _initGyroTracker() {
    window.addEventListener('devicemotion', (e) => {
      if (!this._gyroBlur || this._shutter <= 0) return;
      const rate = e.rotationRate;
      if (!rate) return;

      // beta = pitch (forward/back tilt speed), gamma = roll (left/right)
      // Both in deg/s; typical fast tilt = 100-300 deg/s
      const beta = rate.beta || 0;
      const gamma = rate.gamma || 0;

      // Peak capture — same pattern as cursor tracker
      if (Math.abs(gamma) > Math.abs(this._gyroVelX)) this._gyroVelX = gamma;
      if (Math.abs(beta) > Math.abs(this._gyroVelY)) this._gyroVelY = beta;

      if (!this._gyroActive) this._startGyroLoop();
    }, { passive: true });
  }

  _startGyroLoop() {
    if (this._shutter <= 0 || !this._svgBase) return;
    this._gyroActive = true;

    const display = [0, 0, 0, 0, 0];
    const configs = FilmEmulator.TRAIL_CONFIGS;
    const lerp = FilmEmulator.ONSET_LERP;

    const tick = () => {
      this._gyroVelX *= 0.85;
      this._gyroVelY *= 0.85;

      const mag = Math.sqrt(this._gyroVelX ** 2 + this._gyroVelY ** 2);
      const rawT = Math.min(mag / 200, 1);
      const target = rawT * this._shutter;

      let anyActive = false;
      for (let i = 0; i < configs.length; i++) {
        const goal = target * configs[i].decay / 0.85;
        display[i] = display[i] + (goal - display[i]) * lerp;
        display[i] *= configs[i].decay;
        if (display[i] > 0.001) anyActive = true;
      }

      if (!anyActive && target < 0.001) {
        this._gyroVelX = 0;
        this._gyroVelY = 0;
        this._gyroActive = false;
        if (!this._shutterActive && !this._cursorActive) {
          this._blurWrapper.style.filter = '';
          this._resetSVGFilter();
        }
        return;
      }

      const dirX = mag > 1 ? -this._gyroVelX / mag : 0;
      const dirY = mag > 1 ? -this._gyroVelY / mag : 0;

      this._applySVGBlur(dirX, dirY, target, display);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
