import {
    C_NETHER,
    C_BASTION,
    C_BLIND,
    C_END,
    C_FORT,
    C_STRONGHOLD,
    C_FINISH,
    formatMMSS,
    toSeconds
} from "./helpers/utils.js";
import {fitLogNormal, getSplits, logNormalCdfSeconds, logNormalInvCdfSeconds} from "./helpers/runhelper.js";

export function buildOdds(runs) {
    const [totalRunCount, ...splits] = getSplits(runs);

    const totalCount = reduceToSum(totalRunCount);
    const avgDayRuns = totalCount / Object.keys(totalRunCount).length;

    const colors = [ C_NETHER, C_BASTION, C_FORT, C_BLIND, C_STRONGHOLD, C_END ];
    const totals = splits.map(reduceToLength);
    const chances = totals.map(c => c / totalCount);

    document.getElementById("odds-chance").innerHTML += chances.map((c, i) =>
        `<td style="color: ${colors[i]}">${(c * 100).toFixed(2)}%<br>(${totals[i]})</td>`
    ).join("");

    document.getElementById("odds-day-chance").innerHTML += chances.map((c, i) =>
        `<td style="color: ${colors[i]}">${((1 - Math.pow(1 - c, avgDayRuns)) * 100).toFixed(2)}%</td>`
    ).join("");

    // Time percentile rows (10% / 50% / 90%) based on log-normal fits
    const fits = splits.map(s => fitLogNormal(Object.values(s).flat()));

    const top10Row = document.getElementById("odds-top10-time");
    const avgRow = document.getElementById("odds-avg-time");
    const top90Row = document.getElementById("odds-top90-time");

    const cell = (i, text) => `<td style="color: ${colors[i]}">${text}</td>`;

    top10Row.innerHTML += fits.map((fit, i) => {
        if (!fit) return cell(i, "\-");
        const s = logNormalInvCdfSeconds(0.10, fit.mu, fit.sigma);
        return cell(i, formatMMSS(Math.round(s)));
    }).join("");

    avgRow.innerHTML += fits.map((fit, i) => {
        if (!fit) return cell(i, "\-");
        const s = logNormalInvCdfSeconds(0.50, fit.mu, fit.sigma);
        return cell(i, formatMMSS(Math.round(s)));
    }).join("");

    top90Row.innerHTML += fits.map((fit, i) => {
        if (!fit) return cell(i, "\-");
        const s = logNormalInvCdfSeconds(0.90, fit.mu, fit.sigma);
        return cell(i, formatMMSS(Math.round(s)));
    }).join("");
}

const typeEl = document.getElementById("calc-type");
const dateEl = document.getElementById("calc-date");
const minEl = document.getElementById("calc-minutes");
const secEl = document.getElementById("calc-seconds");
const outEl = document.getElementById("calc-result");

export function buildCalculator(runs) {
    const [ totalRunCount, ...splits] = getSplits(runs);

    const totalCount = reduceToSum(totalRunCount);
    const avgDayRuns = totalCount / Object.keys(totalRunCount).length;

    const totals = splits.map(reduceToLength);
    const chances = totals.map(c => c / totalCount);

    const fits = splits.map(s => fitLogNormal(Object.values(s).flat()));

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
            outEl.innerHTML = `Not Enough Data <img src="/static/forsenHoppedin.webp" height="16" alt="">`;
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
    const [totalRunCount, , , , blinds] = getSplits(runs);

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
    const BLIND_TO_STRONGHOLD_TIME = 120;
    const BLIND_TO_STRONGHOLD_P = 0.25;
    const STRONGHOLD_TO_END_TIME = 60;
    const STRONGHOLD_TO_END_P = 0.70;
    const END_TO_FINISH_TIME = 120;
    const END_TO_FINISH_P = 0.25;

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
    while (cumulative < 0.9 && daysCumulative90 < 10000000) {
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

    for (const el of document.getElementsByClassName("predictions-template")) {
        el.innerHTML += `
            <h2>Predictions</h2>
            <p style="font-size: 16px; color: ${C_FINISH}; margin: 5px 0 10px 0;">
                <strong>Record Date</strong><br>
                <span style="font-size: 18px">
                    ${date50.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
                </span>
            </p>
            
            <div style="display: flex; justify-content: center; gap: 30px">
                <p style="font-size: 12px; color: #999; margin: 5px 0;">
                    <i>90% Chance After</i><br>
                    <span style="font-size: 14px">
                        ${date10.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
                    </span>
                </p>
                
                <p style="font-size: 12px; color: #999; margin: 5px 0;">
                    <i>90% Chance Before</i><br>
                    <span style="font-size: 14px">
                        ${date90.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
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
                        <li>Blind → Stronghold: ${formatMMSS(BLIND_TO_STRONGHOLD_TIME)} (${~~(BLIND_TO_STRONGHOLD_P * 100)}% success rate)</li>
                        <li>Stronghold → End: ${formatMMSS(STRONGHOLD_TO_END_TIME)} (${~~(STRONGHOLD_TO_END_P * 100)}% success rate)</li>
                        <li>End → Finish: ${formatMMSS(END_TO_FINISH_TIME)} (${~~(END_TO_FINISH_P * 100)}% success rate)</li>
                    </ul>
                    <p><strong>Required blind time:</strong> < ${formatMMSS(requiredBlindTime)}</p>
                    <p><strong>Chance per run:</strong> ${(pRecordPerRun * 100).toFixed(4)}%</p>
                    <p><strong>Chance per day:</strong> ${(pSuccessPerDay * 100).toFixed(2)}%</p>
                    <hr>
                    <div class="code-block">
                        <p style="font-size: 16px; color: ${C_FINISH}; margin: 5px 0;">
                            <strong>>50% Probability:</strong>
                            ${date50.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
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
}

function reduceToSum(obj) {
    return Object.values(obj).reduce((a, b) => a + b, 0);
}

function reduceToLength(obj) {
    return Object.values(obj).reduce((a, b) => a + b.length, 0);
}