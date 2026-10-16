import { mount } from 'svelte';
// Fuentes dentro del proyecto: el kiosko funciona sin internet.
// Overpass: nace de la señalética de carreteras; se lee de lejos y suena a etiqueta de seguridad.
import '@fontsource/overpass/400.css';
import '@fontsource/overpass/600.css';
import '@fontsource/overpass/800.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-black/400.css';
import App from './App.svelte';
import './app.css';

export default mount(App, { target: document.getElementById('app') });
