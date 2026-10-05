/**
 * Global debug flag stored from plugin options.
 *
 * Using a `const` object instead of rewriting a `let` variable to clear linting warnings about reassigning a top-level variable.
 *
 * @type {{ debugOption: boolean | undefined }}
 */
const debugState = {
    debugOption: undefined,
};

/**
 * Configure global debug mode state from plugin options.
 *
 * @param {boolean | undefined} debugOption The value of the plugin's `debug` option, or `undefined` if not provided.
 */
export function setDebugOption(debugOption) {
    debugState.debugOption = debugOption;
}

/**
 * Check whether debug mode is currently enabled.
 * If an explicit option value is provided (or configured), it takes precedence.
 * The environment variable `VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG` is only considered when the option is `undefined` or `null`.
 *
 * @param {boolean} [optionDebug] Optional explicit debug flag from plugin options.
 * @returns {boolean} `true` if debug mode is enabled.
 */
export function isDebugEnabled(optionDebug) {
    const activeOption = optionDebug ?? debugState.debugOption;
    if ((activeOption !== undefined) && (activeOption !== null)) return Boolean(activeOption);

    const envVal = process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
    if ((envVal !== undefined) && (envVal !== null) && (envVal !== '')) {
        const normalized = String(envVal).trim().toLowerCase();
        return ['1', 'on', 'true', 'yes'].includes(normalized);
    }

    return false;
}

/**
 * Output a debug log message to console when debug mode is enabled.
 *
 * @param {string} message Debug message to display.
 * @param {...any} args Additional arguments to log.
 */
export function debugLog(message, ...args) {
    if (isDebugEnabled()) {
        console.log(`[vite-plugin-mkcert-containerized:debug] ${message}`, ...args);
    }
}
