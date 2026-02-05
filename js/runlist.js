import {seconds, formatMMSS} from "./utils.js";

// Amount of pixels to the left of run bars
const RUNS_MARGIN = 220;
// Pixels per minute in the run bars (for scaling)
const RUNS_PER_MINUTE = 45;

export function buildRuns(runs) {
    rebuildRuns(runs);

    // View settings
    document.getElementById("show-only-nether").addEventListener("change", () => {
        rebuildRuns(runs);
    });

    // Runs tooltip
    const tooltip = document.getElementById("runs-tooltip");
    document.getElementById("runs").addEventListener("mousemove", (e) => {
        const bar = e.target?.closest?.(".run-bar-container");
        if (!bar) {
            tooltip.style.display = "none";
            return;
        }

        const rowRect = bar.getBoundingClientRect();
        const seconds = (e.clientX - rowRect.left) * (60 / RUNS_PER_MINUTE);

        tooltip.textContent = formatMMSS(seconds) + " (click to go to VOD)";
        tooltip.style.left = `${e.clientX + 8}px`;
        tooltip.style.top = `${e.clientY - 24}px`;
        tooltip.style.display = "block";
    });

    document.getElementById("runs").addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });

    document.getElementById("runs").addEventListener("click", (e) => {
        const bar = e.target?.closest?.(".run-bar-container");
        if (!bar) return;

        const run = runs[Number(bar.getAttribute("data-run"))];
        const rowRect = bar.getBoundingClientRect();
        const secs = (e.clientX - rowRect.left) * (60 / RUNS_PER_MINUTE);

        // Find closest entry to clicked time
        let closestEntry = run.data.find(entry => seconds(entry) >= secs) || run.data[run.data.length - 1];

        const timestampParam = closestEntry.timestamp.replace(":", "h").replace(":", "m");
        window.open(`${run.vod}?t=${timestampParam}s`, "_blank");
    });
}

function rebuildRuns(runs) {
    // Add time labels every minute
    const runElement = document.getElementById("runs");
    const secs = Math.max(...runs.map(d => d.data).flat(1).map(r => seconds(r)));
    runElement.style.width = `${secs / (60 / RUNS_PER_MINUTE) + RUNS_MARGIN + 70}px`;

    let labelString = "";
    for (let m = 1; m * 60 < secs + 60; m++) {
        labelString += `<span style="text-align: center; width: ${RUNS_PER_MINUTE}px;">${m}:00</span>`;
    }

    runElement.innerHTML = `<div class="run-label-container">${labelString}</div>`;

    let runStr = "";
    for (let r = runs.length - 1; r > 0; r--) {
        const run = runs[r].data;
        const netherI = run.findIndex(entry => entry.achievement?.includes("Need"));
        const bastionI = run.findIndex(entry => entry.achievement?.includes("Those"));
        const fortI = run.findIndex(entry => entry.achievement?.includes("Terri"));
        const blindI = run.findIndex(entry => entry.ninja?.includes("Certain"));

        if (document.getElementById("show-only-nether").checked && netherI === -1) {
            continue;
        }

        const netherEntry = netherI > -1 ? seconds(run[netherI]) : 0;
        const struct1Entry = bastionI > -1 && fortI === -1 ? seconds(run[bastionI])
            : fortI > -1 && bastionI === -1 ? seconds(run[fortI])
                : bastionI !== -1 && fortI !== -1 ? seconds(run[Math.min(bastionI, fortI)]) : 0;
        const struct2Entry = bastionI !== -1 && fortI !== -1 ? seconds(run[Math.max(bastionI, fortI)]) : 0;
        const blindEntry = blindI > -1 && struct2Entry > 0 ? seconds(run[blindI]) : 0;

        const overworldTime = netherEntry > 0 ? netherEntry : seconds(run[run.length - 1]);
        const netherTime = netherEntry === 0 ? 0 : (struct1Entry > 0 ? struct1Entry - netherEntry : seconds(run[run.length - 1]) - netherEntry);
        const struct1Time = struct1Entry === 0 ? 0 : (struct2Entry > 0 ? struct2Entry - struct1Entry : seconds(run[run.length - 1]) - struct1Entry);
        const struct2Time = struct2Entry === 0 ? 0 : (blindEntry > 0 ? blindEntry - struct2Entry : seconds(run[run.length - 1]) - struct2Entry);
        const blindTime = blindEntry === 0 ? 0 : seconds(run[run.length - 1]) - blindEntry;

        const segments = [
            { w: overworldTime, color: "#55ee55" },
            { w: netherTime, color: "#ee5555" },
            { w: struct1Time, color: fortI > -1 && struct1Entry === seconds(run[fortI]) ? "#7a0000" : "#635b55" },
            { w: struct2Time, color: fortI > -1 && struct2Entry === seconds(run[fortI]) ? "#7a0000" : "#635b55" },
            { w: blindTime, color: "#8855ee" },
        ].filter(s => s.w > 0);

        const deathMessage = run.findLast(entry => entry.death?.includes("LUL"))?.death ?? "";
        const deathIcon = deathMessage.includes("lava") ? `<img src="/static/hoppedin.avif" height="14" title="${deathMessage}" alt="${deathMessage}">` :
            deathMessage.includes("burn") ? `<img src="/static/forsenfire.avif" height="14" title="${deathMessage}" alt="${deathMessage}">` :
            deathMessage.includes("Pig") ? `<img src="/static/piglin.avif" height="14" title="${deathMessage}" alt="${deathMessage}">` :
                deathMessage.includes("Hog") ? `<img src="/static/hoglin.avif" height="14" title="${deathMessage}" alt="${deathMessage}">` : deathMessage;

        runStr += `
                    <div>
                        <span style="display: inline-block; width: ${RUNS_MARGIN}px;">
                            #${r} - <a target="_blank" href="${runs[r].vod}?t=${run[0].timestamp.replace(":", "h").replace(":", "m")}s">${runs[r].date} ${run[0].timestamp}</a>
                        </span>
                        <div class="run-bar-container" data-run="${r}">
                        ${segments.map((s, i) => `<div
                            class="run-bar${i === 0 ? " first" : ""} ${i === segments.length - 1 ? " last" : ""}"
                            style="width: ${s.w * (RUNS_PER_MINUTE / 60)}px; background-color: ${s.color};"
                          ></div>`).join("")}
                        </div>
                        <span class="run-bar-desc">${deathIcon} ${run[run.length - 1].timer}</span>
                    </div>
                `.replaceAll(/>\n\s+/g, ">");
    }

    runElement.innerHTML += runStr;
}