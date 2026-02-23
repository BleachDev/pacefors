import {seconds, formatMMSS} from "./helpers/utils.js";

// Amount of pixels to the left of run bars
const RUNS_MARGIN = 220;
// Pixels per minute in the run bars (for scaling)
const RUNS_PER_MINUTE = 45;

export class Runlist {

    constructor(element, runs) {
        this.element = element;
        this.runs = runs;
        this.initElement();
        this.rebuildRuns();
    }

    initElement() {
        this.element.style.textAlign = "left";
        this.element.innerHTML += `
            <div class="runs-settings">
                <label>
                    Show Only Runs Entering:
                    <select class="runs-split-filter">
                        <option value="all">All Runs</option>
                        <option value="nether">Nether</option>
                        <option value="struct1">Struct 1</option>
                        <option value="struct2">Struct 2</option>
                        <option value="blind">Blind</option>
                        <option value="stronghold">Stronghold</option>
                    </select>
                </label>

                <label>
                    Sort By:
                    <select class="runs-sort">
                        <option value="date">Date</option>
                        <option value="nether">Nether Entry Time</option>
                        <option value="struct1">Struct 1 Time</option>
                        <option value="struct2">Struct 2 Time</option>
                        <option value="blind">Blind Time</option>
                        <option value="stronghold">Stronghold Time</option>
                        <option value="death">Death Reason</option>
                        <option value="duration">Duration</option>
                    </select>
                </label>
            </div>

            <div class="runs"></div>
            <div class="runs-tooltip"></div>
        `;

        // View settings
        this.element.querySelector(".runs-split-filter").onchange = () => this.rebuildRuns();
        this.element.querySelector(".runs-sort").onchange = () => this.rebuildRuns();

        // Runs tooltip
        const tooltip = this.element.querySelector(".runs-tooltip");
        this.element.querySelector(".runs").addEventListener("mousemove", e => {
            const deathImage = e.target?.closest?.("img");
            if (deathImage) {
                tooltip.innerHTML = `
                <img src="${deathImage.getAttribute("src")}" height="32" alt="">
                <br>
                <span style="color: #ee8888">${deathImage.getAttribute("title")}</span>
            `;
                tooltip.style.left = `${e.clientX + 8}px`;
                tooltip.style.top = `${e.clientY - 60}px`;
                tooltip.style.display = "block";
                return;
            }

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

        this.element.querySelector(".runs").addEventListener("mouseleave", () => {
            tooltip.style.display = "none";
        });

        this.element.querySelector(".runs").addEventListener("click", (e) => {
            const bar = e.target?.closest?.(".run-bar-container");
            if (!bar) return;

            const run = this.runs[Number(bar.getAttribute("data-run"))];
            const rowRect = bar.getBoundingClientRect();
            const secs = (e.clientX - rowRect.left) * (60 / RUNS_PER_MINUTE);

            // Find closest entry to clicked time
            const timestamp = run.timestamps[~~(secs / 5)].replace(":", "h").replace(":", "m");
            window.open(`${run.vod}?t=${timestamp}s`, "_blank");
        });
    }

    rebuildRuns() {
        // Add time labels every minute
        const runElement = this.element.querySelector(".runs");

        const secs = Math.max(...this.runs.map(r => seconds(r.runTime)));
        runElement.style.width = `${secs / (60 / RUNS_PER_MINUTE) + RUNS_MARGIN + 70}px`;

        let labelString = "";
        for (let m = 1; m * 60 < secs + 60; m++) {
            labelString += `<span style="text-align: center; width: ${RUNS_PER_MINUTE}px;">${m}:00</span>`;
        }

        runElement.innerHTML = `<div class="run-label-container">${labelString}</div>`;

        const outRuns = [];
        for (let r = this.runs.length - 1; r > 0; r--) {
            const run = this.runs[r];

            const netherEntry = run.nether ?? 0;
            const struct1Entry = !run.bastion && !run.fort ? 0
                : !run.fort ? run.bastion
                    : !run.bastion ? run.fort
                        : Math.min(run.bastion, run.fort);
            const struct2Entry = run.bastion && run.fort ? Math.max(run.bastion, run.fort) : 0;
            const blindEntry = run.blind ?? 0;
            const strongholdEntry = run.stronghold ?? 0;

            const splitFilter = this.element.querySelector(".runs-split-filter").value;
            if (splitFilter === "nether" && !netherEntry) continue;
            if (splitFilter === "struct1" && !struct1Entry) continue;
            if (splitFilter === "struct2" && !struct2Entry) continue;
            if (splitFilter === "blind" && !blindEntry) continue;
            if (splitFilter === "stronghold" && !strongholdEntry) continue;

            const lastTime = seconds(run.runTime);
            const overworldTime = netherEntry ? netherEntry : lastTime;
            const netherTime = netherEntry ? (struct1Entry > 0 ? struct1Entry - netherEntry : lastTime - netherEntry) : 0;
            const struct1Time = struct1Entry ? (struct2Entry > 0 ? struct2Entry - struct1Entry : lastTime - struct1Entry) : 0;
            const struct2Time = struct2Entry ? (blindEntry > 0 ? blindEntry - struct2Entry : lastTime - struct2Entry) : 0;
            const blindTime = blindEntry ? (strongholdEntry > 0 ? strongholdEntry - blindEntry : lastTime - blindEntry) : 0;
            const strongholdTime = strongholdEntry ? lastTime - strongholdEntry : 0;


            const segments = [
                { w: overworldTime, color: "#55ee55" },
                { w: netherTime, color: "#ee5555" },
                { w: struct1Time, color: run.fort < run.bastion ? "#7a0000" : "#635b55" },
                { w: struct2Time, color: run.fort > run.bastion ? "#7a0000" : "#635b55" },
                { w: blindTime, color: "#8855ee" },
                { w: strongholdTime, color: "#558877" }
            ].filter(s => s.w > 0);

            const deathIcon = !run.death ? "" :
                run.death.includes("lava") ? `<img src="./static/forsenHoppedin.webp" height="14" title="${run.death}" alt="">` :
                run.death.includes("burn") ? `<img src="./static/forsenFire.webp" height="14" title="${run.death}" alt="">` :
                run.death.includes("fell") || run.death.includes("ground") ? `<img src="./static/forsenGravity.webp" height="14" title="${run.death}" alt="">` :
                run.death.includes("Pig") ? `<img src="./static/piglin.webp" height="14" title="${run.death}" alt="">` :
                run.death.includes("Hog") ? `<img src="./static/hoglin.webp" height="14" title="${run.death}" alt="">` :
                run.death.includes("ither") ? `<img src="./static/wither.webp" height="14" title="${run.death}" alt="">` :
                run.death.includes("Skel") ? `<img src="./static/skeleton.webp" height="14" title="${run.death}" alt="">` :
                run.death.includes("Blaze") ? `<img src="./static/blaze.webp" height="14" title="${run.death}" alt="">` :
                `<span style="color: #ee8888">${run.death}</span>`;

            outRuns.push({
                segments, deathIcon, r, runTime: run.runTime, date: run.date, vod: run.vod, timestamps: run.timestamps,
                deathStart: run.deathStart, deathEnd: run.deathEnd,
                netherEntry, struct1Entry, struct2Entry, blindEntry, strongholdEntry
            });
        }

        const sort = this.element.querySelector(".runs-sort").value;
        if (sort === "nether") outRuns.sort((a, b) => (a.netherEntry || Infinity) - (b.netherEntry || Infinity));
        else if (sort === "struct1") outRuns.sort((a, b) => (a.struct1Entry || Infinity) - (b.struct1Entry || Infinity));
        else if (sort === "struct2") outRuns.sort((a, b) => (a.struct2Entry || Infinity) - (b.struct2Entry || Infinity));
        else if (sort === "blind") outRuns.sort((a, b) => (a.blindEntry || Infinity) - (b.blindEntry || Infinity));
        else if (sort === "stronghold") outRuns.sort((a, b) => (a.strongholdEntry || Infinity) - (b.strongholdEntry || Infinity));
        else if (sort === "death") outRuns.sort((a, b) => b.deathIcon.localeCompare(a.deathIcon));
        else if (sort === "duration") outRuns.sort((a, b) => seconds(b.runTime) - seconds(a.runTime));

        let runStr = "";
        for (const outRun of outRuns) {
            const timeDiff = utcDiff(outRun.timestamps[outRun.timestamps.length - 1]);

            const date = outRun.vod ? outRun.date : "LIVE";
            const link = outRun.vod ? `href="${outRun.vod}?t=${outRun.timestamps[0].replace(":", "h").replace(":", "m")}s"` : "";
            const liveStyle = !outRun.vod && outRun.r === this.runs.length - 1 && timeDiff > 0 && timeDiff < 60 * 15
                ? `class="live-run"` : "";

            runStr += `
            <div>
                <span style="display: inline-block; width: ${RUNS_MARGIN}px;">
                    #${outRun.r} - <a target="_blank" ${liveStyle} ${link}">${date} ${outRun.timestamps[0]}</a>
                </span>
                <div class="run-bar-container" data-run="${outRun.r}">
                    ${outRun.segments.map((s, i) => `<div
                        class="run-bar${i === 0 ? " first" : ""} ${i === outRun.segments.length - 1 ? " last" : ""}"
                        style="width: ${s.w * (RUNS_PER_MINUTE / 60)}px; background-color: ${s.color};"
                      ></div>`).join("")}
                    ${outRun.deathStart ? `<div class="run-death-indicator" style="left: ${(outRun.deathStart - 3) * (RUNS_PER_MINUTE / 60)}px; width: ${(outRun.deathEnd - outRun.deathStart + 3) * (RUNS_PER_MINUTE / 60)}px;"></div>` : ""}
                    </div>
                <span class="run-bar-desc">${outRun.deathIcon} ${outRun.runTime}</span>
            </div>
        `.replaceAll(/>\n\s+/g, ">");
        }

        runElement.innerHTML += runStr;
    }
}

function utcDiff(timeStr) {
    const [h, m, s] = timeStr.split(":").map(Number);
    const now = new Date();
    return (now.getUTCHours() - h) * 3600 + (now.getUTCMinutes() - m) * 60 + (s - now.getUTCSeconds() - s);
}