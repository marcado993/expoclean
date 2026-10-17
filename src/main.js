import { mount } from 'svelte';
// Fuentes dentro del proyecto: el kiosko funciona sin internet.
// Figtree: limpia y clara en pantallas pequeñas.
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-black/400.css';
import App from './App.svelte';
import './app.css';

export default mount(App, { target: document.getElementById('app') });
