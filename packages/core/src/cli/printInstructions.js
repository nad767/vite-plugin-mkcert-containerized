import { stdout } from 'node:process';
import { styleText } from 'node:util';

import { formatDuration } from '../time/formatDuration.js';
import { formatTimeWithUtcOffset } from '../time/formatTimeWithUtcOffset.js';
import { emboxText } from './emboxText.js';

/**
 * Format text with ANSI styles explicitly targeting `stdout` to align with `console.log`.
 * If logging via `console.warn` or `console.error`, `stderr` would be passed instead.
 * De facto, terminal color support detection rarely differs between the two streams.
 *
 * @param {string | string[]} format ANSI format style or array of styles.
 * @param {string} text Text string to format.
 * @returns {string} Styled text string.
 */
const styleForStdout = (format, text) => styleText(format, text, { stream: stdout });

/**
 * Log host trust instructions to the console in a boxed layout.
 *
 * @param {Object} params
 * @param {{ archiveDownloadUrl: string, port: number, expiresAt?: number }} params.ephemeralServerState Ephemeral server configuration and status details.
 * @param {any} [params.basePluginErr] Optional error object reported by the base `vite-plugin-mkcert`.
 */
export function printInstructions({ ephemeralServerState, basePluginErr }) {
    const url = ephemeralServerState.archiveDownloadUrl;

    const isTimeoutEnabled = typeof ephemeralServerState.expiresAt === 'number';
    const relativeTime = isTimeoutEnabled
        ? styleForStdout('yellow', formatDuration(ephemeralServerState.expiresAt - Date.now()))
        : null;
    const absoluteTime = isTimeoutEnabled
        ? styleForStdout('yellow', formatTimeWithUtcOffset(new Date(ephemeralServerState.expiresAt)))
        : null;

    const instructions = [
        styleForStdout('bold', 'vite-plugin-mkcert-containerized'),
        '---',
        'Trust the CA certificate on host machine:',
        '',
        `  1. Download CA certificate & installation helpers: ${styleForStdout('magenta', url)}`,
        '',
        ...isTimeoutEnabled
            ? [
                `     · Link expires ${relativeTime} (at ${absoluteTime}).`,
                '       Restart the Vite dev server to renew.',
            ]
            : [],
        // Port mapping cannot be reliably detected from inside the container, as they may be assigned dynamically based on their availability on the host.
        // Settling for the following suggestion to the user.
        '     · In a VSCode devcontainer setup, following the link from the integrated terminal should automatically rewrite the port to its host mapping.',
        '       Otherwise, you must rewrite the URL port manually (check VSCode\'s "Ports" tab).',
        '',
        '  2. Extract the archive on your host machine and run the installer:',
        '',
        `     · ${styleForStdout('bold', 'Windows')}: ${styleForStdout('blue', 'install-rootCA.cmd')} or ${styleForStdout('blue', 'install-rootCA.ps1')}.`,
        `     · ${styleForStdout('bold', 'macOS, Linux')}: ${styleForStdout('blue', 'install-rootCA.sh')}.`,
        ...basePluginErr
            ? [`  · Note: ${styleForStdout('blue', 'mkcert')} reported a CA installation failure inside the container.`]
            : [],
    ];

    const boxedInstructions = emboxText(instructions, { stream: stdout });
    console.log(boxedInstructions);
}
