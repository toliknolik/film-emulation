/**
 * Film stock definitions.
 *
 * Each stock configures:
 *  - grainIntensity / grainSize / channelSep  → fed to the WebGL grain shader
 *  - buildCSSFilter(strength)                 → CSS filter string for the color grade
 *  - swatch                                   → CSS class suffix used by the UI
 *  - description                              → short label shown in sidebar
 */

const STOCKS = {
  none: {
    name: 'No Film',
    cardName: 'None',
    description: 'Original — no effect',
    swatch: 'none',
    grainIntensity: 0.0,
    grainSize: 1.0,
    channelSep: 0.0,
    cardGradient: 'linear-gradient(236deg, #d4d0c8 4%, #a09888 96%)',
    defaults: { intensity: 0, size: 1.0, grade: 0 },
    buildCSSFilter: () => '',
  },

  portra: {
    name: 'Kodak Portra 400',
    cardName: 'Gold 400',
    description: 'Warm · fine grain · lifted shadows',
    swatch: 'portra',
    grainIntensity: 1.0,
    grainSize: 1.1,
    channelSep: 1.4,
    cardGradient: 'linear-gradient(236deg, #c9ef6f 4%, #c9bc74 96%)',
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

  provia: {
    name: 'Fuji Provia 100F',
    cardName: 'Superia 100',
    description: 'Cool blues · neutral · slide film',
    swatch: 'provia',
    grainIntensity: 0.55,
    grainSize: 0.7,
    channelSep: 0.9,
    cardGradient: 'linear-gradient(236deg, #287cc2 4%, #25efb6 96%)',
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

  hp5: {
    name: 'Ilford HP5+ 400',
    cardName: 'HP5+ 400',
    description: 'B&W · pushed · reportage grain',
    swatch: 'hp5',
    grainIntensity: 1.6,
    grainSize: 1.45,
    channelSep: 0.0,
    monoGrain: true,
    cardGradient: 'linear-gradient(236deg, #ffffff 4%, #9f9f9f 96%)',
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
};

export default STOCKS;
