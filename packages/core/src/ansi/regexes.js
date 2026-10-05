/**
 * ANSI escape code pattern.
 *
 * Used by `stripAnsi` and `wrapLine`.
 *
 * Note:
 * RegExp instances with the `/g` flag maintain state (`lastIndex`) across `.exec()` calls.
 * `wrapLine` constructs a fresh instance (`new RegExp(ansiRegex.source, 'g')`) per invocation.
 * This prevents `lastIndex` state leakage across multiple line wrapping calls.
 */
// We turn off `no-control-regex` because this regex is intended to match control characters. See https://eslint.org/docs/latest/rules/no-control-regex#:~:text=If%20you%20need%20to%20use%20control%20character%20pattern%20matching%2C%20then%20you%20should%20turn%20this%20rule%20off.
// eslint-disable-next-line no-control-regex
export const ansiRegex = /[\u{1B}\u{9B}][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/gu;

/**
 * Regex pattern matching leading indentation and list/bullet prefixes.
 *
 * Used by `wrapLine` and `getRequiredLineContentW`.
 */
export const prefixRegex = /^\s*(?:(?:[·•\-*+–—>▪▫◦‣⁃●○★☆☞→➜➤]|(?:\d+|[a-zA-Z]|\([0-9a-zA-Z]+\))[.)]|\[[ xX\-*]?\])\s+)*/;
