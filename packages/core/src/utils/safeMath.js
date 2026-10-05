/**
 * Return the maximum numeric value among the provided arguments, filtering out non-numeric and non-finite values.
 *
 * @param {...any} args Values to evaluate.
 * @returns {number} Maximum numeric value, or -Infinity if no valid numbers are provided.
 */
export const safeMax = (...args) => {
    const nums = args.filter(x => (typeof x === 'number') && Number.isFinite(x));
    return Math.max(...nums);
};

/**
 * Return the minimum numeric value among the provided arguments, filtering out non-numeric and non-finite values.
 *
 * @param {...any} args Values to evaluate.
 * @returns {number} Minimum numeric value, or Infinity if no valid numbers are provided.
 */
export const safeMin = (...args) => {
    const nums = args.filter(x => (typeof x === 'number') && Number.isFinite(x));
    return Math.min(...nums);
};

/**
 * Clamp a numeric value between a minimum and maximum bound using safeMin and safeMax.
 *
 * @param {Object} options Options object containing input value and bounds.
 * @param {number} options.num Value to clamp.
 * @param {number} options.min Minimum lower bound.
 * @param {number} options.max Maximum upper bound.
 * @returns {number} Clamped numeric value.
 */
export const safeClamp = ({ num, min, max } = {}) => {
    return safeMin(safeMax(num, min), max);
};
