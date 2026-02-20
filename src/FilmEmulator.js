import STOCKS from './film-stocks.js';
import { VERT_SRC, FRAG_SRC } from './shaders.js';

/**
 * FilmEmulator — manages two independent overlay layers:
 *
 *  1. Color grade  →  CSS filter on the content element (+ blur)
 *  2. Grain        →  WebGL canvas, mix-blend-mode: soft-light, pointer-events: none
 *
 * The WebGL context is created WITHOUT alpha (alpha: false) so the canvas
 * backbuffer is opaque RGB. The grain shader writes 0.5-centred grey;
 * soft-light treats that as neutral. If alpha were enabled the browser would
 * premultiply and the blend math would break.
 */
export default class FilmEmulator {
  /**
   * @param {object} opts
   * @param {HTMLElement}      opts.content        – the element that gets the CSS filter
   * @param {HTMLCanvasElement} opts.grainCanvas    – canvas for WebGL grain overlay
   * @param {function}         [opts.onStatusChange] – called with status strings
   */
  constructor({ content, grainCanvas, onStatusChange }) {
    this._content = content;
    this._canvas = grainCanvas;
    this._onStatus = onStatusChange || (() => {});

    this._filmId = 'portra';
    this._intensity = 1.0;
    this._size = 1.0;
    this._grade = 1.0;
    this._blur = 0;

    // WebGL state
    this._gl = null;
    this._prog = null;
    this._uLocs = null;

    this._initGL();
    this._onResize = () => this.apply();
    window.addEventListener('resize', this._onResize);
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
    this._content.style.filter = filter + ` blur(${this._blur.toFixed(1)}px)`;
  }
}
