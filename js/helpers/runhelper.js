import {pushOrCreate} from "./utils.js";

/**
 * Approximation of the Gauss error function erf(x).
 *
 * Used to compute the normal CDF without external dependencies.
 * This is a common polynomial approximation (Abramowitz & Stegun style)
 *
 * @param {number} x
 * @returns {number} erf(x) in [-1, 1]
 */
export function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t = 1 / (1 + p * ax);
    const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
    return sign * y;
}

/**
 * Standard normal cumulative distribution function Φ(z).
 *
 * Φ(z) = P(Z <= z) for Z ~ N(0,1).
 *
 * @param {number} z
 * @returns {number} probability in [0, 1]
 */
export function normalCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Chance of a random time being lequal to {tSeconds} based on a log-normal distribution with parameters mu and sigma.
 *
 * If T ~ LogNormal(mu, sigma), then:
 *   P(T <= t) = Φ((ln(t) - mu) / sigma)
 *
 * @param {number} tSeconds time threshold in seconds
 * @param {number} mu mean of ln(T)
 * @param {number} sigma stddev of ln(T)
 * @returns {number} probability in [0, 1]
 */
export function logNormalCdfSeconds(tSeconds, mu, sigma) {
    if (!(tSeconds > 0) || !Number.isFinite(tSeconds)) return 0;
    const z = (Math.log(tSeconds) - mu) / sigma;
    const p = normalCdf(z);
    return Math.min(1, Math.max(0, p));
}

/**
 * Finds the time in seconds that *{p} percent* of values are lequal to, based on a log-normal distribution with parameters mu and sigma.
 *
 * E.g. finds the time tSeconds such that:
 *   P(T <= tSeconds) = p
 * for T ~ LogNormal(mu, sigma), using a numerical solve.
 *
 * Implementation details:
 * - Clamps p away from 0 and 1 to avoid infinite/degenerate targets.
 * - Exponentially expands an upper bound until CDF(hi) >= p (bracketing).
 * - Uses bisection on [lo, hi] since the CDF is monotonic in time.
 *
 * @param {number} p target probability in (0, 1)
 * @param {number} mu mean of ln(T)
 * @param {number} sigma stddev of ln(T)
 * @returns {number} time quantile in seconds
 */
export function logNormalInvCdfSeconds(p, mu, sigma) {
    // Clamp to avoid infinities
    const pp = Math.min(1 - 1e-10, Math.max(1e-10, p));

    // Find a high bound that has CDF >= p
    let lo = 0;
    let hi = 1;

    while (logNormalCdfSeconds(hi, mu, sigma) < pp && hi < 60 * 60 * 24) {
        hi *= 2;
    }

    // Bisection search
    for (let iter = 0; iter < 80; iter++) {
        const mid = (lo + hi) / 2;
        const c = logNormalCdfSeconds(mid, mu, sigma);
        if (c < pp) lo = mid;
        else hi = mid;
    }

    return (lo + hi) / 2;
}

/**
 * Fit a log-normal distribution to sample times.
 *
 * We model times as log-normal by taking logs and fitting a normal:
 *   x_i = ln(sample_i)
 *   mu = mean(x_i)
 *   sigma = sqrt(variance_pop(x_i))
 *
 * Notes:
 * - Uses population variance (divide by N), not sample variance.
 * - Returns null when there is insufficient data or degenerate variance.
 *
 * @param {number[]} samples array of positive times in seconds
 * @returns {{mu: number, sigma: number} | null}
 */
export function fitLogNormal(samples) {
    if (samples.length < 2) return null;

    const xs = samples.map(s => Math.log(s));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const varPop = xs.reduce((a, x) => a + (x - mean) * (x - mean), 0) / xs.length;
    const sigma = Math.sqrt(Math.max(0, varPop));

    if (!Number.isFinite(mean) || !Number.isFinite(sigma) || sigma === 0) return null;
    return { mu: mean, sigma };
}

// Get split times for runs in the last {dayLimit} day, grouped by day.
export function getSplits(runs, dayLimit = Infinity) {
    const s1Entries = {};
    const s2Entries = {};
    const blinds = {};
    const strongholds = {};
    const ends = {};

    const totalRunCount = {};
    for (let r = runs.length - 1; r >= 0; r--) {
        const run = runs[r];
        if (Object.keys(totalRunCount).length === dayLimit && !s2Entries[run.date]) break;

        totalRunCount[run.date] = (totalRunCount[run.date] ?? 0) + 1;

        const s1entry = run.bastion || run.fort ? Math.min(run.bastion ?? Infinity, run.fort ?? Infinity) : null;
        if (s1entry) pushOrCreate(s1Entries, run.date, s1entry);

        const s2entry = run.bastion && run.fort ? Math.max(run.bastion, run.fort) : null;
        if (s2entry) pushOrCreate(s2Entries, run.date, s2entry);

        const blind = s2entry !== null && run.blind ? run.blind : null;
        if (blind) pushOrCreate(blinds, run.date, blind);

        const stronghold = blind !== null && run.stronghold ? run.stronghold : null;
        if (stronghold) pushOrCreate(strongholds, run.date, stronghold);

        const end = stronghold !== null && run.end ? run.end : null;
        if (end) pushOrCreate(ends, run.date, end);
    }

    return [ totalRunCount, s1Entries, s2Entries, blinds, strongholds, ends ];
}