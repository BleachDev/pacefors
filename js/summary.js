import {C_BASTION, C_FORT, C_NETHER, C_BLIND, C_STRONGHOLD, C_END, C_FINISH, formatMMSS} from "./helpers/utils.js";
import {Runlist} from "./runlist.js";
import {getSplits} from "./helpers/runhelper.js";

const NAMES = ["Runs", "Nethers", "Bastions", "Forts", "Blinds", "Strongholds", "Ends", "Finishes"];
const COLORS = ["#55ee55", C_NETHER, C_BASTION, C_FORT, C_BLIND, C_STRONGHOLD, C_END, C_FINISH];
const FILTERS = [ () => true, r => r.nether, r => r.bastion, r => r.fort, r => r.blind, r => r.stronghold, r => r.end, r => r.finish ];

export function buildDailySummary(runs) {
    const runlist = new Runlist(document.getElementById("summary-runs"), []);

    // Group runs by day
    const runsByDay = {};
    runs.forEach(run => {
        if (!runsByDay[run.date]) runsByDay[run.date] = [];
        runsByDay[run.date].push(run);
    });

    const daySelect = document.getElementById("summary-day");
    for (const [day, dayRuns] of Object.entries(runsByDay)) {
        const option = document.createElement("option");
        option.value = day;
        option.textContent = `${day} (${dayRuns.length} run${dayRuns.length > 1 ? "s" : ""})`;
        daySelect.appendChild(option);
    }

    // Build summary elements
    const splits = getSplits(runs);
    const container = document.getElementById("daily-summary-container");
    const onChange = (day, dayRuns) => {
        const dayElement = document.createElement("div");
        dayElement.className = "daily-summary-day";
        dayElement.innerHTML = `
            <h3 style="text-align: left; margin: 0 0 15px 5px">${day}</h3>
            <table style="text-align: left; margin-bottom: 5px">
                <tr style="text-align: center">
                    <th></th>
                    <th>Count</th>
                    <th>Avg<br>Today</th>
                    <th>Avg<br>Total</th>
                    <th>Pace<br>fors™</th>
                </tr>
                ${NAMES.map((name, i) => {
                    const daySplits = i < 2 || i > 5 ? null : splits[i - 1][daySelect.value];
                    const dayAvg = daySplits ? daySplits.reduce((a, b) => a + b, 0) / daySplits.length : null;
                    
                    const totalSplits = i < 2 || i > 5 ? null : Object.values(splits[i - 1]).flat() ?? [];
                    const totalAvg = totalSplits ? totalSplits.reduce((a, b) => a + b, 0) / totalSplits.length : null;
                    return `
                    <tr>
                        <td>${name}</td>
                        <td style="color: ${COLORS[i]}">${dayRuns.filter(FILTERS[i]).length}</td>
                        <td>${i < 2 ? "" : dayAvg ? formatMMSS(dayAvg) : "-"}</td>
                        <td style="color: #999">${i < 2 ? "" : totalAvg ? formatMMSS(totalAvg) : "-"}</td>
                        <td>${!dayAvg || !totalAvg ? "" : (dayAvg < totalAvg ? "<span style='color: #99cc99'>-" : "<span style='color: #ee8888'>+") + formatMMSS(Math.abs(dayAvg - totalAvg)) + "<span>"}</td>
                    </tr>
                `}).join("")}
            </table>
            <span style="color: #ee8888">Deaths Today: ${dayRuns.filter(r => r.death).length}</span>
        `;
        container.appendChild(dayElement);

        runlist.runs = runsByDay[daySelect.value];
        runlist.rebuildRuns();
    };

    daySelect.onchange = () => {
        container.querySelectorAll(".daily-summary-day").forEach(e => e.remove());
        onChange(daySelect.value, runsByDay[daySelect.value]);
    };

    // Select most recent day by default
    daySelect.value = daySelect.options[daySelect.options.length - 1].value;
    onChange(daySelect.value, runsByDay[daySelect.value]);
}