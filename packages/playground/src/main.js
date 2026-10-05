import { initEasterEgg } from './easterEgg/initEasterEgg.js';
import './style.css';

/**
 * Render the minimal playground interface.
 *
 * @returns {void}
 */
function renderApp() {
    const appElement = document.querySelector('#app');
    if (!appElement) {
        return;
    }

    appElement.innerHTML = `
        <main class="card" tabindex="0" role="button" autofocus aria-label="vite-plugin-mkcert-containerized playground">
            <h1>vite-plugin-mkcert-containerized</h1>
            <p>Minimal playground dev server.</p>
        </main>
    `;

    initEasterEgg();
}

renderApp();
