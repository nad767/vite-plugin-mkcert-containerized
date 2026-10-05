import { spawnCertificateParticles } from './spawnCertificateParticles.js';

const MIN_SCALE = 1;
const THRESHOLD_SCALE = 1.16;
const CLICK_BOOST = 0.075;
const DEFLATE_SPEED_PER_SEC = 0.2;
const PEAK_EXPANSION_DELAY_MS = 80;

/**
 * Initialize easter egg event listener on card clicks and keypresses with analog deflation decay.
 *
 * @returns {void}
 */
export function initEasterEgg() {
    const card = document.querySelector('.card');
    if (!card) return;

    // Acquire autofocus immediately on mount.
    card.focus();

    let currentScale = MIN_SCALE;
    let rafId = null;
    let lastTime = null;
    let collapseTimer = null;
    let collapseCleanupTimer = null;

    /**
     * Animation frame step that continuously deflates the card scale over time.
     *
     * @param {number} timestamp Current frame timestamp.
     * @returns {void}
     */
    const deflateStep = timestamp => {
        if (lastTime === null) {
            lastTime = timestamp;
        }

        const deltaSec = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        currentScale = Math.max(MIN_SCALE, currentScale - (DEFLATE_SPEED_PER_SEC * deltaSec));
        card.style.transform = `scale(${currentScale})`;

        // Keep loop running until card has completely deflated to resting scale.
        if (currentScale > MIN_SCALE) {
            rafId = requestAnimationFrame(deflateStep);
        }
        else {
            rafId = null;
            lastTime = null;
            card.style.transform = 'scale(1)';
        }
    };

    /**
     * Start the deflation loop if not currently active.
     *
     * @returns {void}
     */
    const ensureDeflateLoop = () => {
        if (rafId !== null) return;

        lastTime = null;
        rafId = requestAnimationFrame(deflateStep);
    };

    /**
     * Handle user activation (click or space/enter keystroke).
     *
     * @returns {void}
     */
    const handleTrigger = () => {
        // Cancel any pending collapse cleanup when triggered again.
        if (collapseCleanupTimer !== null) {
            clearTimeout(collapseCleanupTimer);
            collapseCleanupTimer = null;
            card.classList.remove('card-collapse');
        }

        currentScale += CLICK_BOOST;

        // Check if scale passed threshold to burst.
        if (currentScale >= THRESHOLD_SCALE) {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }

            // Visibly expand on trigger.
            card.style.transform = `scale(${currentScale})`;

            const rect = card.getBoundingClientRect();
            spawnCertificateParticles(rect, 24);

            // Schedule collapse once triggering ceases, preventing parallel burst loop conflicts.
            if (collapseTimer !== null) {
                clearTimeout(collapseTimer);
            }

            collapseTimer = setTimeout(() => {
                collapseTimer = null;
                currentScale = MIN_SCALE;

                card.classList.add('card-collapse');
                card.style.transform = 'scale(1)';

                collapseCleanupTimer = setTimeout(() => {
                    collapseCleanupTimer = null;
                    card.classList.remove('card-collapse');
                }, 250);
            }, PEAK_EXPANSION_DELAY_MS);

            return;
        }

        card.style.transform = `scale(${currentScale})`;
        ensureDeflateLoop();
    };

    card.addEventListener('click', handleTrigger);

    card.addEventListener('keydown', event => {
        if ((event.key !== ' ') && (event.key !== 'Enter')) return;

        event.preventDefault();
        handleTrigger();
    });
}
