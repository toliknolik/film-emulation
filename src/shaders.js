export const VERT_SRC = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

/**
 * Grain fragment shader.
 *
 * Outputs a 0.5-centred grey texture:
 *   uIntensity = 0  →  solid #808080  →  soft-light no-op (invisible)
 *   uIntensity > 0  →  grain deviates from 0.5  →  soft-light modulates content
 *
 * The canvas must NOT use { alpha: true } — an opaque RGB backbuffer is
 * required so mix-blend-mode: soft-light sees solid grey, not premultiplied
 * transparent pixels.
 */
export const FRAG_SRC = `
  precision highp float;
  varying vec2 vUv;

  uniform float uIntensity;
  uniform float uSize;
  uniform float uSeed;
  uniform float uChannelSep;
  uniform float uMono;
  uniform vec2  uRes;

  // Per-pixel white noise hash — no spatial correlation, no grid artifacts.
  // Real film grain is random per silver-halide crystal; coherent noise
  // (Perlin, value, gradient) always introduces spatial structure = patterns.
  // Instead: white noise per pixel, box-averaged over a kernel for grain size.
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975, 397.2973, 491.1871));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Box-average white noise over a small kernel to control grain size.
  // Larger uSize → more samples averaged → softer, larger-looking grain.
  // This mimics lens/scanner softening of discrete crystal noise.
  float grain(vec2 pixelCoord, float seed) {
    // Pixel-space coordinate (integer = 1 screen pixel)
    vec2 p = pixelCoord;

    // Kernel radius in pixels: size=1 → 0 extra samples (raw white noise),
    // size=3 → 1px radius averaging, etc.
    float radius = max(0.0, (uSize - 1.0) * 0.5);
    int r = int(ceil(radius));

    // Fast path: no averaging needed at small sizes
    if (r == 0) {
      return hash(p + seed);
    }

    float sum = 0.0;
    float count = 0.0;
    for (int y = -3; y <= 3; y++) {
      for (int x = -3; x <= 3; x++) {
        if (x > r || x < -r || y > r || y < -r) continue;
        vec2 off = vec2(float(x), float(y));
        // Weight: 1.0 for fully inside, fractional at edges
        float w = clamp(radius - max(abs(off.x), abs(off.y)) + 1.0, 0.0, 1.0);
        sum += hash(p + off + seed) * w;
        count += w;
      }
    }
    return sum / count;
  }

  void main() {
    // Work in pixel coordinates so grain is always 1:1 with screen pixels
    vec2 pixelCoord = vUv * uRes;
    float px = uChannelSep;

    float r = grain(pixelCoord + vec2( px,  0.0), uSeed);
    float g = grain(pixelCoord + vec2( 0.0,  px), uSeed + 137.0);
    float b = grain(pixelCoord + vec2(-px, -px),  uSeed + 281.0);

    // B&W stocks: single luminance noise for all channels
    vec3 rgb = mix(vec3(r, g, b), vec3(r), uMono);

    // Mix toward 0.5 (soft-light neutral) by (1 - intensity)
    vec3 col = mix(vec3(0.5), rgb, uIntensity);
    gl_FragColor = vec4(col, 1.0);
  }
`;
