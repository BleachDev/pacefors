import {
    C_BASTION,
    C_BLIND,
    C_END,
    C_FORT,
    C_STRONGHOLD,
    C_FINISH,
    fitLogNormal,
    formatMMSS,
    logNormalCdfSeconds,
    pushOrCreate,
    toSeconds
} from "./utils.js";

export function buildOdds(runs) {
    const [s1Entries, s2Entries, blinds,  strongholds, totalRunCount] = getSplits(runs);

    const totalCount = reduceToSum(totalRunCount);
    const avgDayRuns = totalCount / Object.keys(totalRunCount).length;

    const colors = [ C_BASTION, C_FORT, C_BLIND, C_STRONGHOLD, C_END ];
    const totals = [ reduceToLength(s1Entries), reduceToLength(s2Entries), reduceToLength(blinds), reduceToLength(strongholds), 0];
    const chances = totals.map(c => c / totalCount);

    document.getElementById("odds-chance").innerHTML += chances.map((c, i) =>
        `<td style="color: ${colors[i]}">${(c * 100).toFixed(2)}% (${totals[i]})</td>`
    ).join("");

    document.getElementById("odds-day-chance").innerHTML += chances.map((c, i) =>
        `<td style="color: ${colors[i]}">${((1 - Math.pow(1 - c, avgDayRuns)) * 100).toFixed(2)}%</td>`
    ).join("");
}

const typeEl = document.getElementById("calc-type");
const dateEl = document.getElementById("calc-date");
const minEl = document.getElementById("calc-minutes");
const secEl = document.getElementById("calc-seconds");
const outEl = document.getElementById("calc-result");

export function buildCalculator(runs) {
    const [s1Entries, s2Entries, blinds, strongholds, totalRunCount] = getSplits(runs);

    const totalCount = reduceToSum(totalRunCount);
    const avgDayRuns = totalCount / Object.keys(totalRunCount).length;

    const totals = [ reduceToLength(s1Entries), reduceToLength(s2Entries), reduceToLength(blinds), reduceToLength(strongholds), 0];
    const chances = totals.map(c => c / totalCount);

    const s1Fit = fitLogNormal(Object.values(s1Entries).flat());
    const s2Fit = fitLogNormal(Object.values(s2Entries).flat());
    const blindFit = fitLogNormal(Object.values(blinds).flat());
    const strongholdFit = fitLogNormal(Object.values(strongholds).flat());

    const fits = [s1Fit, s2Fit, blindFit, strongholdFit, null];

    const recalc = () => {
        const cutoff = toSeconds(minEl.value, secEl.value);

        const rawDate = dateEl.value;
        if (!rawDate) {
            outEl.textContent = "-";
            return;
        }

        const inputDate = new Date(rawDate);
        const daysFromNow = (inputDate - new Date()) / (1000 * 60 * 60 * 24);

        if (!Number.isFinite(daysFromNow) || daysFromNow <= 0) {
            outEl.textContent = `0%`;
            return;
        }

        const fit = fits[typeEl.selectedIndex];
        if (!fit) {
            outEl.innerHTML = `Not Enough Data <img src="/static/forsenHoppedin.webp" height="16">`;
            return;
        }

        const chancePerRun = chances[typeEl.selectedIndex];
        const chancePerRunUnderCutoff = logNormalCdfSeconds(cutoff, fit.mu, fit.sigma);

        const chanceByDate = 1 - Math.pow(1 - (chancePerRunUnderCutoff * chancePerRun), avgDayRuns * daysFromNow);
        outEl.textContent =
            `${(chanceByDate * 100).toFixed(chanceByDate > 0.99 || chanceByDate < 0.01 ? 5 : 2)}%`;
    };

    typeEl.addEventListener("change", recalc);
    dateEl.addEventListener("change", recalc);
    minEl.addEventListener("input", recalc);
    secEl.addEventListener("input", recalc);
    recalc();
}

export function buildPredictions(runs) {
    const [, , blinds, , totalRunCount] = getSplits(runs);

    const totalCount = reduceToSum(totalRunCount);
    const avgDayRuns = totalCount / Object.keys(totalRunCount).length;

    // Calculate chance per run to get to blind
    const blindCount = reduceToLength(blinds);
    const chanceBlindPerRun = blindCount / totalCount;

    // Fit log-normal distribution to blind times
    const blindFit = fitLogNormal(Object.values(blinds).flat());

    // Record time: 14:27
    const RECORD_TIME = 14 * 60 + 27;

    // Segment assumptions (in seconds)
    const BLIND_TO_STRONGHOLD_TIME = 120; // 3:30
    const BLIND_TO_STRONGHOLD_P = 0.25;
    const STRONGHOLD_TO_END_TIME = 60; // 1:30
    const STRONGHOLD_TO_END_P = 0.60;
    const END_TO_FINISH_TIME = 120; // 2:15
    const END_TO_FINISH_P = 0.2;

    // Calculate required blind time to beat Record
    const requiredBlindTime = RECORD_TIME - (BLIND_TO_STRONGHOLD_TIME + STRONGHOLD_TO_END_TIME + END_TO_FINISH_TIME);

    // Probability of beating Record given a single run that reaches blind
    const pBlindFastEnough = logNormalCdfSeconds(requiredBlindTime, blindFit.mu, blindFit.sigma);

    const pRecordPerBlind = pBlindFastEnough * BLIND_TO_STRONGHOLD_P * STRONGHOLD_TO_END_P * END_TO_FINISH_P;
    const pRecordPerRun = chanceBlindPerRun * pRecordPerBlind;

    // Probability of success on a single day
    const pSuccessPerDay = 1 - Math.pow(1 - pRecordPerRun, avgDayRuns);

    // Calculate cumulative probability over each day, and find when it crosses 10%, 50%, and 90%
    let daysCumulative10 = 0;
    let daysCumulative50 = 0;
    let daysCumulative90 = 0;
    let cumulative = 0;
    while (cumulative < 0.9 && daysCumulative90 < 100000000) {
        if (cumulative < 0.1) daysCumulative10++;
        if (cumulative < 0.5) daysCumulative50++;
        daysCumulative90++;
        cumulative = 1 - Math.pow(1 - pRecordPerRun, avgDayRuns * daysCumulative90);
    }


    const date10 = new Date();
    date10.setDate(date10.getDate() + daysCumulative10);

    const date50 = new Date();
    date50.setDate(date50.getDate() + daysCumulative50);

    const date90 = new Date();
    date90.setDate(date90.getDate() + daysCumulative90);

    const container = document.getElementById("predictions-container");
    container.innerHTML += `
        <p style="font-size: 16px; color: ${C_FINISH}; margin: 5px 0 10px 0;">
            <strong>Record Date</strong><br>
            <span style="font-size: 18px">
                ${date50.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
        </p>
        
        <div style="display: flex; justify-content: center; gap: 30px">
            <p style="font-size: 12px; color: #999; margin: 5px 0;">
                <i>90% Chance After</i><br>
                <span style="font-size: 14px">
                    ${date10.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            </p>
            
            <p style="font-size: 12px; color: #999; margin: 5px 0;">
                <i>90% Chance Before</i><br>
                <span style="font-size: 14px">
                    ${date90.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            </p>
        </div>
        
        <details>
            <summary style="cursor: pointer; color: #aaa; margin-top: 5px; text-align: left">
                <i>Show more details</i>
            </summary>
            
            <div style="text-align: left; line-height: 1.5;">
                <p><strong>Record to Beat:</strong> 14:27 (${RECORD_TIME}s)</p>
                <p><strong>Baseline Data:</strong> ${blindCount} blinds from ${totalCount} runs</p>
                <p><strong>Assumptions:</strong></p>
                <ul style="margin: 5px 0; padding-left: 20px;">
                    <li>Blind → Stronghold: ${formatMMSS(BLIND_TO_STRONGHOLD_TIME)} (${~~(BLIND_TO_STRONGHOLD_P*100)}% success rate)</li>
                    <li>Stronghold → End: ${formatMMSS(STRONGHOLD_TO_END_TIME)} (${~~(STRONGHOLD_TO_END_P*100)}% success rate)</li>
                    <li>End → Finish: ${formatMMSS(END_TO_FINISH_TIME)} (${~~(END_TO_FINISH_P*100)}% success rate)</li>
                </ul>
                <p><strong>Required blind time:</strong> < ${formatMMSS(requiredBlindTime)}</p>
                <p><strong>Chance per run:</strong> ${(pRecordPerRun * 100).toFixed(4)}%</p>
                <p><strong>Chance per day:</strong> ${(pSuccessPerDay * 100).toFixed(2)}%</p>
                <hr>
                <div class="code-block">
                    <p style="font-size: 16px; color: ${C_FINISH}; margin: 5px 0;">
                        <strong>>50% Probability:</strong>
                        ${date50.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        <span style="color: #aaa; font-size: 13px;">
                            - ${daysCumulative50} days from now
                        </span>
                    </p>
                    <p style="color: #999; font-size: 12px; margin: 5px 0 5px 20px; font-style: italic;">
                        <i>50% chance record is beaten by this date (earliest threshold)</i>
                    </p>
                </div>
            </div>
        </details>
    `;
}

function getSplits(runs, dayLimit = 20) {
    const s1Entries = {};
    const s2Entries = {};
    const blinds = {};
    const strongholds = {};
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
    }

    return [ s1Entries, s2Entries, blinds, strongholds, totalRunCount ];
}

function reduceToSum(obj) {
    return Object.values(obj).reduce((a, b) => a + b, 0);
}

function reduceToLength(obj) {
    return Object.values(obj).reduce((a, b) => a + b.length, 0);
}