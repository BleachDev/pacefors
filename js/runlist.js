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
        const timestamp = run.timestamps[~~(secs / 5)].replace(":", "h").replace(":", "m");
        window.open(`${run.vod}?t=${timestamp}s`, "_blank");
    });
}

function rebuildRuns(runs) {
    // Add time labels every minute
    const runElement = document.getElementById("runs");
    const secs = Math.max(...runs.map(r => seconds(r.runTime)));
    runElement.style.width = `${secs / (60 / RUNS_PER_MINUTE) + RUNS_MARGIN + 70}px`;

    let labelString = "";
    for (let m = 1; m * 60 < secs + 60; m++) {
        labelString += `<span style="text-align: center; width: ${RUNS_PER_MINUTE}px;">${m}:00</span>`;
    }

    runElement.innerHTML = `<div class="run-label-container">${labelString}</div>`;

    let runStr = "";
    for (let r = runs.length - 1; r > 0; r--) {
        const run = runs[r];

        if (document.getElementById("show-only-nether").checked && !run.nether)
            continue;

        const netherEntry = run.nether ?? 0;
        const struct1Entry = !run.bastion && !run.fort ? 0
            : !run.fort ? run.bastion
            : !run.bastion ? run.fort
            : Math.min(run.bastion, run.fort);
        const struct2Entry = run.bastion && run.fort ? Math.max(run.bastion, run.fort) : 0;
        const blindEntry = run.blind ?? 0;

        const lastTime = seconds(run.runTime);
        const overworldTime = netherEntry > 0 ? netherEntry : lastTime;
        const netherTime = netherEntry === 0 ? 0 : (struct1Entry > 0 ? struct1Entry - netherEntry : lastTime - netherEntry);
        const struct1Time = struct1Entry === 0 ? 0 : (struct2Entry > 0 ? struct2Entry - struct1Entry : lastTime - struct1Entry);
        const struct2Time = struct2Entry === 0 ? 0 : (blindEntry > 0 ? blindEntry - struct2Entry : lastTime - struct2Entry);
        const blindTime = blindEntry === 0 ? 0 : lastTime - blindEntry;

        const segments = [
            { w: overworldTime, color: "#55ee55" },
            { w: netherTime, color: "#ee5555" },
            { w: struct1Time, color: run.fort < run.bastion ? "#7a0000" : "#635b55" },
            { w: struct2Time, color: run.fort > run.bastion ? "#7a0000" : "#635b55" },
            { w: blindTime, color: "#8855ee" },
        ].filter(s => s.w > 0);

        const deathIcon = !run.death ? "" :
            run.death.includes("lava") ? `<img src="/static/forsenHoppedin.webp" height="14" title="${run.death}" alt="${run.death}">` :
            run.death.includes("burn") ? `<img src="/static/forsenFire.webp" height="14" title="${run.death}" alt="${run.death}">` :
            run.death.includes("fell") ? `<img src="/static/forsenGravity.webp" height="14" title="${run.death}" alt="${run.death}">` :
            run.death.includes("Pig") ? `<img src="/static/piglin.webp" height="14" title="${run.death}" alt="${run.death}">` :
            run.death.includes("Hog") ? `<img src="/static/hoglin.webp" height="14" title="${run.death}" alt="${run.death}">` :
                `<span style="color: #ee8888">${run.death}</span>`;

        runStr += `
            <div>
                <span style="display: inline-block; width: ${RUNS_MARGIN}px;">
                    #${r} - <a target="_blank" href="${runs[r].vod}?t=${run.timestamps[0].replace(":", "h").replace(":", "m")}s">${run.date} ${run.timestamps[0]}</a>
                </span>
                <div class="run-bar-container" data-run="${r}">
                ${segments.map((s, i) => `<div
                    class="run-bar${i === 0 ? " first" : ""} ${i === segments.length - 1 ? " last" : ""}"
                    style="width: ${s.w * (RUNS_PER_MINUTE / 60)}px; background-color: ${s.color};"
                  ></div>`).join("")}
                </div>
                <span class="run-bar-desc">${deathIcon} ${run.runTime}</span>
            </div>
        `.replaceAll(/>\n\s+/g, ">");
    }

    runElement.innerHTML += runStr;
}