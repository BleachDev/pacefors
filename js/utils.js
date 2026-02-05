/*function parseTimestamp(ts) {
    // "Feb 03 02:14:16" -> Date in local time (assumes current year)
    const [, monStr, dd, HH, MM, SS] = ts.match(/^([A-Za-z]{3})\s+(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    const month = months[monStr];
    if (month == null) return null;

    const year = new Date().getFullYear();
    return new Date(year, month, Number(dd), 16 + Number(HH), Number(MM), Number(SS));
}*/

export function formatMMSS(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) return "";
    const s = Math.round(totalSeconds); // ticks are fine as whole seconds
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function seconds(entry) {
    const split = entry.timer.split(".");
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