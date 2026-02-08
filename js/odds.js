import {fitLogNormal, logNormalCdfSeconds, toSeconds} from "./utils.js";

export function buildOdds(runs) {
    const [s2Entries, blinds,  strongholds, totalRunCount] = getSplits(runs);

    const s2Count = Object.values(s2Entries).reduce((a, b) => a + b.length, 0);
    const blindCount = Object.values(blinds).reduce((a, b) => a + b.length, 0);
    const strongholdCount = Object.values(strongholds).reduce((a, b) => a + b.length, 0);
    const totalCount = Object.values(totalRunCount).reduce((a, b) => a + b, 0);
    const avgDayRuns = totalCount / Object.keys(totalRunCount).length;

    const s2ChancePerRun = s2Count / totalCount;
    const blindChancePerRun = blindCount / totalCount;
    const strongholdChancePerRun = strongholdCount / totalCount;

    document.getElementById("s2-odds").textContent =
        `${(s2ChancePerRun * 100).toFixed(2)}% (${s2Count}/${totalCount})`;
    document.getElementById("s2-day-odds").textContent =
        `${((1 - Math.pow(1 - s2ChancePerRun, avgDayRuns)) * 100).toFixed(2)}%`;

    document.getElementById("blind-odds").textContent =
        `${(blindChancePerRun * 100).toFixed(2)}% (${blindCount}/${totalCount})`;
    document.getElementById("blind-day-odds").textContent =
        `${((1 - Math.pow(1 - blindChancePerRun, avgDayRuns)) * 100).toFixed(2)}%`;

    document.getElementById("stronghold-odds").textContent =
        `${(strongholdChancePerRun * 100).toFixed(2)}% (${strongholdCount}/${totalCount})`;
    document.getElementById("stronghold-day-odds").textContent =
        `${((1 - Math.pow(1 - strongholdChancePerRun, avgDayRuns)) * 100).toFixed(2)}%`;

    buildCalculator(runs, s2ChancePerRun, blindChancePerRun, strongholdChancePerRun, avgDayRuns);
}

const typeEl = document.getElementById("calc-type");
const dateEl = document.getElementById("calc-date");
const minEl = document.getElementById("calc-minutes");
const secEl = document.getElementById("calc-seconds");
const outEl = document.getElementById("calc-odds");

export function buildCalculator(runs, s2ChancePerRun, blindChancePerRun, strongholdChancePerRun, avgDayRuns) {
    const [s2Entries, blinds, strongholds] = getSplits(runs);

    const s2Fit = fitLogNormal(Object.values(s2Entries).flat());
    const blindFit = fitLogNormal(Object.values(blinds).flat());
    const strongholdFit = fitLogNormal(Object.values(strongholds).flat());

    const recalc = () => {
        const cutoff = toSeconds(minEl.value, secEl.value);

        const rawDate = dateEl.value;
        if (!rawDate) {
            outEl.textContent = "><";
            return;
        }

        const inputDate = new Date(rawDate);
        const daysFromNow = (inputDate - new Date()) / (1000 * 60 * 60 * 24);

        if (!Number.isFinite(daysFromNow) || daysFromNow <= 0) {
            outEl.textContent = `> 0% <`;
            return;
        }

        const fit = typeEl.value === "s2" ? s2Fit : typeEl.value === "blind" ? blindFit : typeEl.value === "stronghold" ? strongholdFit : null;
        if (!fit) {
            outEl.innerHTML = `> No Data <img src="/static/forsenHoppedin.webp" height="16"> <`;
            return;
        }

        const chancePerRun = typeEl.value === "s2" ? s2ChancePerRun : typeEl.value === "blind"
            ? blindChancePerRun : typeEl.value === "stronghold" ? strongholdChancePerRun : 0;

        const chancePerRunUnderCutoff = logNormalCdfSeconds(cutoff, fit.mu, fit.sigma);
        const chanceByDate = 1 - Math.pow(1 - (chancePerRunUnderCutoff * chancePerRun), avgDayRuns * daysFromNow);
        outEl.textContent =
            `> ${(chanceByDate * 100).toFixed(chanceByDate > 0.99 || chanceByDate < 0.01 ? 5 : 2)}% <`;
    };

    typeEl.addEventListener("change", recalc);
    dateEl.addEventListener("change", recalc);
    minEl.addEventListener("input", recalc);
    secEl.addEventListener("input", recalc);
    recalc();
}

function getSplits(runs, dayLimit = 12) {
    const s2Entries = {};
    const blinds = {};
    const strongholds = {};
    const totalRunCount = {};
    for (let r = runs.length - 1; r >= 0; r--) {
        const run = runs[r];
        if (Object.keys(totalRunCount).length === dayLimit && !s2Entries[run.date]) break;

        totalRunCount[run.date] = (totalRunCount[run.date] ?? 0) + 1;

        const s2entry = run.bastion && run.fort ? Math.max(run.bastion, run.fort) : null;
        if (s2entry) {
            if (!s2Entries[run.date]) s2Entries[run.date] = [];
            s2Entries[run.date].push(s2entry);
        }

        const blind = s2entry !== null && run.blind ? run.blind : null;
        if (blind) {
            if (!blinds[run.date]) blinds[run.date] = [];
            blinds[run.date].push(blind);
        }

        const stronghold = blind !== null && run.stronghold ? run.stronghold : null;
        if (stronghold) {
            if (!strongholds[run.date]) strongholds[run.date] = [];
            strongholds[run.date].push(stronghold);
        }
    }

    return [ s2Entries, blinds, strongholds, totalRunCount ];
}