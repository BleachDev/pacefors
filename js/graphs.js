import {formatMMSS, pushOrCreate} from "./utils.js";

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

    // Use same reverse ordering convention as buildRuns (latest first)
    for (let r = runs.length - 1; r > 0; r--) {
        const run = runs[r];

        if (run.nether) netherPoints.push({ x: r, y: run.nether });
        if (run.bastion || run.fort) struct1Points.push({ x: r, y: !run.bastion ? run.fort : !run.fort ? run.bastion : Math.min(run.fort, run.bastion) });
        if (run.bastion && run.fort) struct2Points.push({ x: r, y: Math.max(run.fort, run.bastion) });
        if (run.blind) blindPoints.push({ x: r, y: run.blind });
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
                    pointBackgroundColor: "#ee5555",
                    borderColor: "#ee5555",
                    backgroundColor: "#55ee5570"
                },
                {
                    label: "Struct 1 Entry",
                    data: struct1Points,
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: "#635b55",
                    borderColor: "#635b55",
                    backgroundColor: "#ee555570"
                },
                {
                    label: "Struct 2 Entry",
                    data: struct2Points,
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: "#7a0000",
                    borderColor: "#7a0000",
                    backgroundColor: "#635b5570"
                },
                {
                    label: "Blind",
                    data: blindPoints,
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: "#8855ee",
                    borderColor: "#8855ee",
                    backgroundColor: "#8855ee70"
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

    // Use same reverse ordering convention as buildRuns (latest first)
    for (let r = 0; r < runs.length; r++) {
        const run = runs[r];

        if (run.nether) pushOrCreate(netherDays, run.date, run.nether);
        if (run.bastion || run.fort) pushOrCreate(struct1Days, run.date, !run.bastion ? run.fort : !run.fort ? run.bastion : Math.min(run.fort, run.bastion));
        if (run.bastion && run.fort) pushOrCreate(struct2Days, run.date, Math.max(run.fort, run.bastion));
        if (run.blind)  pushOrCreate(blindDays, run.date, run.blind);
    }

    // Average the times for each day
    [netherDays, struct1Days, struct2Days, blindDays].forEach(dayObj => {
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
                    pointBackgroundColor: "#ee5555",
                    borderColor: "#ee5555",
                    backgroundColor: "#55ee5570"
                },
                {
                    label: "Struct 1 Entry",
                    data: dates.map(d => struct1Days[d]),
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: "#635b55",
                    borderColor: "#635b55",
                    backgroundColor: "#ee555570",
                },
                {
                    label: "Struct 2 Entry",
                    data: dates.map(d => struct2Days[d]),
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: "#7a0000",
                    borderColor: "#7a0000",
                    backgroundColor: "#635b5570"
                },
                {
                    label: "Blind",
                    data: dates.map(d => blindDays[d]),
                    showLine: true,
                    fill: "start",
                    pointBackgroundColor: "#8855ee",
                    borderColor: "#8855ee",
                    backgroundColor: "#8855ee70"
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