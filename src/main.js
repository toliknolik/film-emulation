import './styles/reset.css';
import './styles/sidebar.css';
import './styles/main.css';
import './styles/content.css';

import FilmEmulator from './FilmEmulator.js';
import { initUI } from './ui.js';

const content = document.getElementById('content');
const blurWrapper = document.getElementById('content-blur-wrapper');
const grainCanvas = document.getElementById('grain-canvas');
const sidebar = document.getElementById('sidebar');
const cardSelector = document.getElementById('film-card-selector');

const emulator = new FilmEmulator({ content, blurWrapper, grainCanvas });

initUI(emulator, sidebar, content, cardSelector);
// Defer initial render so mobile Safari finishes layout before grain canvas reads dimensions
requestAnimationFrame(() => emulator.apply());
