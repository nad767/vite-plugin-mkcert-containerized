const EMOJIS = ['📜', '🔒', '✨', '⚡', '🛡️', '🔑'];

/**
 * Spawn floating certificate and security badge particles oozing outward from a source rectangle.
 *
 * @param {DOMRect} [originRect] Bounding rectangle of the source card element.
 * @param {number} [count=28] Number of particles to spawn.
 * @returns {void}
 */
export function spawnCertificateParticles(originRect, count = 28) {
    const container = document.createElement('div');
    container.className = 'easter-egg-particle-container';
    document.body.append(container);

    const centerX = originRect ? originRect.left + (originRect.width / 2) : (window.innerWidth / 2);
    const centerY = originRect ? originRect.top + (originRect.height / 2) : (window.innerHeight / 2);

    for (let i = 0; i < count; i += 1) {
        const particle = document.createElement('span');
        particle.className = 'easter-egg-particle';
        particle.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

        // Calculate random radial velocity oozing outward from the card center.
        const angle = Math.random() * Math.PI * 2;
        const velocity = 80 + (Math.random() * 220);
        const deltaX = Math.cos(angle) * velocity;
        const deltaY = (Math.sin(angle) * velocity) - 120; // Slight upward buoyancy.
        const duration = 1.6 + (Math.random() * 1.2);
        const scale = 0.8 + (Math.random() * 0.8);
        const rotation = (Math.random() - 0.5) * 360;

        particle.style.left = `${centerX}px`;
        particle.style.top = `${centerY}px`;
        particle.style.animationDuration = `${duration}s`;
        particle.style.setProperty('--delta-x', `${deltaX}px`);
        particle.style.setProperty('--delta-y', `${deltaY}px`);
        particle.style.setProperty('--particle-scale', scale);
        particle.style.setProperty('--particle-rotation', `${rotation}deg`);

        container.append(particle);
    }

    // Clean up particles container once animation concludes.
    setTimeout(() => {
        container.remove();
    }, 3500);
}
