import { mount } from 'svelte';
// Fuentes dentro del proyecto: el kiosko funciona sin internet.
// Lexend: diseñada para leer más fácil y rápido (ayuda a quien tiene poca práctica de lectura).
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/500.css';
import '@fontsource/lexend/600.css';
import '@fontsource/lexend/700.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-black/400.css';
import App from './App.svelte';
import './app.css';

export default mount(App, { target: document.getElementById('app') });
