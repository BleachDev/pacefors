import {C_BASTION, C_BLIND, C_FORT, C_NETHER, C_OVERWORLD, C_STRONGHOLD, formatMMSS, pushOrCreate} from "./utils.js";

Chart.defaults.borderColor = "#252540";
Chart.defaults.color = "#999";
Chart.defaults.font.family = "Jetbrains Mono, monospace";

Chart.defaults.elements.point.hitRadius = 10;
Chart.defaults.elements.point.radius = 3;
Chart.defaults.elements.line.borderWidth = 2;
Chart.defaults.elements.line.tension = 0.25;

let entryChart = null;
let avgEntryChart = null;

export function buildEntryChart(runs) {
    const netherPoints = [];
    const struct1Points = [];
    const struct2Points = [];
    const blindPoints = [];
    const strongholdPoints = [];

    // Use same reverse ordering convention as buildRuns (latest first)
    for (let r = runs.length - 1; r > 0; r--) {
        const run = runs[r];

        if (run.nether) netherPoints.push({ x: r, y: run.nether });
        if (run.bastion || run.fort) struct1Points.push({ x: r, y: !run.bastion ? run.fort : !run.fort ? run.bastion : Math.min(run.fort, run.bastion) });
        if (run.bastion && run.fort) struct2Points.push({ x: r, y: Math.max(run.fort, run.bastion) });
        if (run.blind) blindPoints.push({ x: r, y: run.blind });
            if (run.stronghold) strongholdPoints.push({ x: r, y: run.stronghold });
    }

    const ctx = document.getElementById("entry-chart").getContext("2d");

    if (entryChart) entryChart.destroy();
    entryChart = new Chart(ctx, {
        type: "line",
        data: {
            datasets: [
                {
                    label: "Nether Entry",
                    data: netherPoints,
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: C_NETHER,
                    borderColor: C_NETHER,
                    backgroundColor: C_OVERWORLD + "70"
                },
                {
                    label: "Struct 1 Entry",
                    data: struct1Points,
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: C_BASTION,
                    borderColor: C_BASTION,
                    backgroundColor: C_NETHER + "70"
                },
                {
                    label: "Struct 2 Entry",
                    data: struct2Points,
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: C_FORT,
                    borderColor: C_FORT,
                    backgroundColor: C_BASTION + "70"
                },
                {
                    label: "Blind",
                    data: blindPoints,
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: C_BLIND,
                    borderColor: C_BLIND,
                    backgroundColor: C_FORT + "70"
                },
                {
                    label: "Stronghold Entry",
                    data: strongholdPoints,
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: C_STRONGHOLD,
                    borderColor: C_STRONGHOLD,
                    backgroundColor: C_BLIND + "70"
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: "linear",
                    parsing: false,
                    title: {display: true, text: "Run #"}
                },
                y: {
                    type: "linear",
                    parsing: false,
                    min: 0,
                    title: { display: true, text: "Entry Time" },
                    ticks: {
                        callback: (value) => formatMMSS(Number(value))
                    },
                },
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (c) => `${c.dataset.label ?? ""}: ${formatMMSS(c.parsed?.y)}`,
                    },
                },
            },
        },
    });
}

export function buildAvgEntryChart(runs) {
    const netherDays = {};
    const struct1Days = {};
    const struct2Days = {};
    const blindDays = {};
    const strongholdDays = {};

    // Use same reverse ordering convention as buildRuns (latest first)
    for (let r = 0; r < runs.length; r++) {
        const run = runs[r];

        if (run.nether) pushOrCreate(netherDays, run.date, run.nether);
        if (run.bastion || run.fort) pushOrCreate(struct1Days, run.date, !run.bastion ? run.fort : !run.fort ? run.bastion : Math.min(run.fort, run.bastion));
        if (run.bastion && run.fort) pushOrCreate(struct2Days, run.date, Math.max(run.fort, run.bastion));
        if (run.blind)  pushOrCreate(blindDays, run.date, run.blind);
        if (run.stronghold) pushOrCreate(strongholdDays, run.date, run.stronghold);
    }

    // Average the times for each day
    [netherDays, struct1Days, struct2Days, blindDays, strongholdDays].forEach(dayObj => {
        Object.entries(dayObj).forEach(([k, v]) => dayObj[k] = v.reduce((a, b) => a + b, 0) / v.length);
    });

    const dates = Object.keys(netherDays);

    const ctx = document.getElementById("avg-entry-chart").getContext("2d");

    if (avgEntryChart) entryChart.destroy();
    avgEntryChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: dates,
            datasets: [
                {
                    label: "Nether Entry",
                    data: dates.map(d => netherDays[d]),
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: C_NETHER,
                    borderColor: C_NETHER,
                    backgroundColor: C_OVERWORLD + "70"
                },
                {
                    label: "Struct 1 Entry",
                    data: dates.map(d => struct1Days[d]),
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: C_BASTION,
                    borderColor: C_BASTION,
                    backgroundColor: C_NETHER + "70"
                },
                {
                    label: "Struct 2 Entry",
                    data: dates.map(d => struct2Days[d]),
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: C_FORT,
                    borderColor: C_FORT,
                    backgroundColor: C_BASTION + "70"
                },
                {
                    label: "Blind",
                    data: dates.map(d => blindDays[d]),
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: C_BLIND,
                    borderColor: C_BLIND,
                    backgroundColor: C_FORT + "70"
                },
                {
                    label: "Stronghold Entry",
                    data: dates.map(d => strongholdDays[d]),
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: C_STRONGHOLD,
                    borderColor: C_STRONGHOLD,
                    backgroundColor: C_BLIND + "70"
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: "category",
                    parsing: false,
                    title: {display: true, text: "Day #"}
                },
                y: {
                    type: "linear",
                    parsing: false,
                    min: 0,
                    title: { display: true, text: "Entry Time" },
                    ticks: {
                        callback: (value) => formatMMSS(Number(value))
                    },
                },
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (c) => `${c.dataset.label ?? ""}: ${formatMMSS(c.parsed?.y)}`,
                    },
                },
            },
        },
    });
}