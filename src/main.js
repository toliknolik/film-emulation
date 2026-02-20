import './styles/reset.css';
import './styles/sidebar.css';
import './styles/main.css';
import './styles/content.css';

import FilmEmulator from './FilmEmulator.js';
import { initUI } from './ui.js';

const content = document.getElementById('content');
const grainCanvas = document.getElementById('grain-canvas');
const glStatus = document.getElementById('gl-status');
const filmStatus = document.getElementById('film-status');
const sidebar = document.getElementById('sidebar');
const cardSelector = document.getElementById('film-card-selector');

const emulator = new FilmEmulator({
  content,
  grainCanvas,
  onStatusChange(msg) { glStatus.textContent = msg; },
});

initUI(emulator, sidebar, content, filmStatus, cardSelector);
emulator.apply();
