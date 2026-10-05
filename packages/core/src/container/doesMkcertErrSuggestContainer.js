import { ERRONEOUS_MKCERT_TOKENS } from '../consts.js';
import { debugLog } from '../utils/debug.js';

/**
 * Detect `mkcert` install failures that should trigger host-side trust guidance even outside explicit container detection.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function doesMkcertErrSuggestContainer(err) {
    if (!err || (typeof err !== 'object')) return false;

    const errorDetails = [err.message, err.cmd, err.stderr]
        .map(value => (typeof value === 'string') ? value : '')
        .join('\n')
        .toLowerCase();

    const isInstallCmd = errorDetails.includes('mkcert') && errorDetails.includes('-install');
    const matchedToken = isInstallCmd ? 'mkcert -install' : ERRONEOUS_MKCERT_TOKENS.find(token => errorDetails.includes(token));

    if (matchedToken) {
        debugLog(`mkcert error matched token "${matchedToken}".`);
        return true;
    }

    return false;
}
