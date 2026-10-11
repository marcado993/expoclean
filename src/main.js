import { mount } from 'svelte';
// Fuentes dentro del proyecto: el kiosko funciona sin internet.
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-black/400.css';
import App from './App.svelte';
import './app.css';

export default mount(App, { target: document.getElementById('app') });
