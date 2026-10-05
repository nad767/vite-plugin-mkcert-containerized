import { ansiRegex } from './regexes.js';

/**
 * Remove ANSI escape codes from a string.
 *
 * @param {string} str String to strip.
 * @returns {string} String without ANSI codes.
 */
export const stripAnsi = str => str.replace(ansiRegex, '');
