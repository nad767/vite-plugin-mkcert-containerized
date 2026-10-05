import { stripAnsi } from '../ansi/stripAnsi.js';

/**
 * Check if a line of text represents a section divider pattern.
 *
 * @param {string} line The line of text to check.
 * @returns {boolean} True if the line is a section divider ('---').
 */
export const isDividerSignal = line => stripAnsi(line).trim() === '---';
