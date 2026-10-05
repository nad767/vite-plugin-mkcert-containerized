import { access, readFile } from 'node:fs/promises';

import { debugLog } from '../utils/debug.js';

/**
 * Detect common container and `devcontainer` heuristics so the plugin can warn when CA trust likely landed in the container only.
 *
 * @returns {Promise<boolean>}
 */
export async function doesEnvSuggestContainer() {
    debugLog('Checking container environment variables and filesystem markers...');

    // Check environment variables across diverse container environments (`Gitpod`, `Codespaces`, `Kubernetes`, `Docker`, `Podman`).
    // Checks rather than only `Dev Containers`, ensuring users in cloud IDEs and custom containers receive host-trust prompts.
    const isEnvSet = Boolean(
        process.env.DEVCONTAINER
        || process.env.REMOTE_CONTAINERS
        || process.env.CODESPACES
        || process.env.GITPOD_WORKSPACE_ID
        || process.env.KUBERNETES_SERVICE_HOST
        || process.env.CONTAINER
        || process.env.container,
    );
    if (isEnvSet) {
        debugLog('Container detected via environment variables.');
        return true;
    }

    // Check filesystem markers across `Docker`, `Podman`, and `systemd-nspawn` (since `/.dockerenv` is absent on `Podman`/`systemd`).
    const hasDockerEnv = await access('/.dockerenv').then(() => true).catch(() => false);
    const hasContainerEnv = await access('/run/.containerenv').then(() => true).catch(() => false);
    const hasSystemdContainer = await access('/run/systemd/container').then(() => true).catch(() => false);
    if (hasDockerEnv || hasContainerEnv || hasSystemdContainer) {
        debugLog('Container detected via filesystem markers.');
        return true;
    }

    const cgroup = await readFile('/proc/1/cgroup', 'utf8').catch(() => null);
    const cgroupMatch = Boolean(cgroup && /(docker|containerd|kubepods|podman|lxc)/i.test(cgroup));
    if (cgroupMatch) {
        debugLog('Container detected via /proc/1/cgroup keywords.');
        return true;
    }

    debugLog('No container environment indicators found.');
    return false;
}
