export const C_OVERWORLD = "#55ee55";
export const C_NETHER = "#ee5555";
export const C_BASTION = "#635b55";
export const C_FORT = "#7a0000";
export const C_BLIND = "#8855ee";
export const C_STRONGHOLD = "#558877";


// Push a value to an array in an object of arrays, creating the array if it doesn't exist
export function pushOrCreate(obj, key, val) {
    if (obj[key] === undefined) obj[key] = [];
    obj[key].push(val);
}

// Format a number of seconds as MM:SS, rounding to the nearest second
export function formatMMSS(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) return "";
    const s = Math.round(totalSeconds); // ticks are fine as whole seconds
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

// Convert a run timer to total seconds as a number
export function seconds(timer) {
    const split = timer.split(".");
    return Number(split[0]) * 60 + Number(split[1]) + Number(split[2]) / 1000;
}

// Clamp n to the range [lo, hi]
export function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}

// Convert minutes and seconds strings to total seconds, with basic validation
export function toSeconds(strMin, strSec) {
    return Math.max(Number(strMin || 0), 0) * 60
         + clamp(Number(strSec || 0), 0, 59);
}

// Abramowitz-Stegun style error function approximation
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

export function normalCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function logNormalCdfSeconds(tSeconds, mu, sigma) {
    if (!(tSeconds > 0) || !Number.isFinite(tSeconds)) return 0;
    const z = (Math.log(tSeconds) - mu) / sigma;
    const p = normalCdf(z);
    return Math.min(1, Math.max(0, p));
}

export function fitLogNormal(samples) {
    if (samples.length < 2) return null;

    const xs = samples.map(s => Math.log(s));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const varPop = xs.reduce((a, x) => a + (x - mean) * (x - mean), 0) / xs.length;
    const sigma = Math.sqrt(Math.max(0, varPop));

    if (!Number.isFinite(mean) || !Number.isFinite(sigma) || sigma === 0) return null;
    return { mu: mean, sigma };
}