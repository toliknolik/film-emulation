/**
 * Film stock definitions.
 *
 * Each stock configures:
 *  - grainIntensity / grainSize / channelSep  → fed to the WebGL grain shader
 *  - buildCSSFilter(strength)                 → CSS filter string for the color grade
 *  - brand                                    → brand key for island logo/roll lookup
 *  - cardName                                 → display name shown in island pill
 */

const STOCKS = {
  none: {
    name: 'No Film',
    cardName: 'Select Film',
    description: 'Original — no effect',
    swatch: 'none',
    brand: null,
    grainIntensity: 0.0,
    grainSize: 1.0,
    channelSep: 0.0,
    defaults: { intensity: 0, size: 1.0, grade: 0 },
    buildCSSFilter: () => '',
  },

  provia: {
    name: 'Fuji Provia 100F',
    cardName: 'Superia 400',
    description: 'Cool blues · neutral · slide film',
    swatch: 'provia',
    brand: 'fuji',
    grainIntensity: 0.55,
    grainSize: 0.7,
    channelSep: 0.9,
    defaults: { intensity: 0.35, size: 1.40, grade: 1.30 },
    buildCSSFilter(s) {
      if (s === 0) return '';
      return [
        `saturate(${(1.0 + 0.08 * s).toFixed(3)})`,
        `brightness(${(1.0 + 0.02 * s).toFixed(3)})`,
        `contrast(${(1.0 + 0.10 * s).toFixed(3)})`,
        `hue-rotate(${(-12 * s).toFixed(1)}deg)`,
      ].join(' ');
    },
  },

  portra: {
    name: 'Kodak Portra 400',
    cardName: 'Gold 200',
    description: 'Warm · fine grain · lifted shadows',
    swatch: 'portra',
    brand: 'kodak',
    grainIntensity: 1.0,
    grainSize: 1.1,
    channelSep: 1.4,
    defaults: { intensity: 0.20, size: 0.40, grade: 0.90 },
    buildCSSFilter(s) {
      if (s === 0) return '';
      return [
        `sepia(${(0.18 * s).toFixed(3)})`,
        `saturate(${(1.0 - 0.18 * s).toFixed(3)})`,
        `brightness(${(1.0 + 0.04 * s).toFixed(3)})`,
        `contrast(${(1.0 - 0.07 * s).toFixed(3)})`,
        `hue-rotate(${(8 * s).toFixed(1)}deg)`,
      ].join(' ');
    },
  },

  hp5: {
    name: 'Ilford HP5+ 400',
    cardName: 'Delta 100',
    description: 'B&W · pushed · reportage grain',
    swatch: 'hp5',
    brand: 'ilford',
    grainIntensity: 1.6,
    grainSize: 1.45,
    channelSep: 0.0,
    monoGrain: true,
    defaults: { intensity: 0.30, size: 0.30, grade: 1.20 },
    buildCSSFilter(s) {
      if (s === 0) return '';
      return [
        `grayscale(${Math.min(s, 1).toFixed(3)})`,
        `brightness(${(1.0 + 0.03 * s).toFixed(3)})`,
        `contrast(${(1.0 + 0.30 * s).toFixed(3)})`,
        `brightness(${(1.0 - 0.08 * s).toFixed(3)})`,
      ].join(' ');
    },
  },

  eterna: {
    name: 'Fuji Eterna 250T',
    cardName: 'Eterna 250T',
    description: 'Teal shadows · amber highs · motion blur',
    swatch: 'eterna',
    brand: 'fuji',
    grainIntensity: 0.85,
    grainSize: 1.0,
    channelSep: 1.2,
    defaults: { intensity: 0.25, size: 0.50, grade: 1.00, shutter: 0.50 },
    buildCSSFilter(s) {
      if (s === 0) return '';
      return [
        `sepia(${(0.35 * s).toFixed(3)})`,
        `saturate(${(1.0 + 0.55 * s).toFixed(3)})`,
        `brightness(${(1.0 - 0.04 * s).toFixed(3)})`,
        `contrast(${(1.0 + 0.22 * s).toFixed(3)})`,
        `hue-rotate(${(-28 * s).toFixed(1)}deg)`,
      ].join(' ');
    },
  },
};

export default STOCKS;
