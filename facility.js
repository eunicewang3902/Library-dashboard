// =============================
// LIBRARY COMFORT DASHBOARD
// =============================
// This script loads CSV data for different library spaces,
// parses thermal (PMV, temp) and acoustic (NC, SPL) comfort metrics,
// and renders both individual and comparative charts using Plotly.js.
// The structure and style of charts are loosely inspired by Plotly gallery examples:
// https://plotly.com/javascript/line-charts/
// https://plotly.com/javascript/multiple-axes/

// --- Global setup ---
// List of libraries to load data for
const libraries = ['fisher', 'law', 'scitech', 'health'];

// Store parsed CSV data per library
const allLibraryData = {};

// Mode flags for user-selected views
let currentMode = 'thermal'; // Switches individual charts (thermal vs acoustic)
let comparisonMode = 'pmv';  // Switches top comparison chart (PMV vs NC)

// --- Load CSV Data ---
// Load and parse CSV for a given library
// PapaParse used elsewhere, but here using native split for simplicity
async function loadData(library) {
  const response = await fetch(`data/${library}.csv`);
  const text = await response.text();
  const rows = text.trim().split('\n').slice(1); // skip CSV header

  allLibraryData[library] = rows.map(row => {
    const [time, pmv, ta, nc, spl] = row.split(',').map(s => s.replace(/['"]+/g, '').trim());
    return {
      time,
      pmv: parseFloat(pmv) || 0,
      ta: parseFloat(ta) || 0,
      nc: parseFloat(nc) || 0,
      spl: parseFloat(spl) || 0
    };
  });
}

// --- Render Comparison Chart ---
// Shows PMV or NC Rating comparison across all libraries in one line chart
function renderPMVComparisonChart() {
  const chartId = 'pmvComparisonChart';
  const traces = [];

  // Generate a trace (line) per library
  libraries.forEach(lib => {
    const data = allLibraryData[lib];
    if (!data) return;

    traces.push({
      x: data.map(row => row.time),
      y: comparisonMode === 'pmv' ? data.map(row => row.pmv) : data.map(row => row.nc),
      name: lib.charAt(0).toUpperCase() + lib.slice(1), // Capitalize
      type: 'scatter',
      mode: 'lines+markers'
    });
  });

  // Plotly line chart config
  Plotly.newPlot(chartId, traces, {
    title: `${comparisonMode === 'pmv' ? 'PMV' : 'NC Rating'} Comparison Across Libraries (24 Hours)`,
    height: 500,
    xaxis: {
      title: 'Time',
      tickmode: 'array',
      tickvals: allLibraryData[libraries[0]]?.map(row => row.time),
      tickangle: -45
    },
    yaxis: {
      title: comparisonMode === 'pmv' ? 'PMV Value' : 'NC Rating',
      range: comparisonMode === 'pmv' ? [0, 0.7] : undefined // Optional y-range clamp for PMV
    },
    legend: {
      orientation: 'h',
      x: 0.5,
      xanchor: 'center',
      y: 1.05,
      font: {
        size: 12
      },
      itemwidth: 100
    },
    margin: { t: 60, b: 100 }
  });
}

// --- Render All Library Charts ---
// For each library, draw its individual thermal or acoustic chart
async function renderCharts() {
  const container = document.getElementById("chartContainer");
  container.innerHTML = ""; // Clear previous

  // Ensure all CSV data is loaded before drawing
  await Promise.all(
    libraries.map(lib =>
      allLibraryData[lib]
        ? Promise.resolve()
        : loadData(lib)
    )
  );

  renderPMVComparisonChart(); // Always show comparison on top

  // Loop over each library and create its chart
  libraries.forEach((lib) => {
    const libName = lib.charAt(0).toUpperCase() + lib.slice(1);

    const chartBox = document.createElement("div");
    chartBox.className = "chart-box";

    const chartTitle = document.createElement("div");
    chartTitle.className = "chart-title";
    chartTitle.textContent = `${libName} Library - ${currentMode === 'thermal' ? 'Thermal Comfort' : 'Acoustic Comfort'}`;

    const chartDiv = document.createElement("div");
    chartDiv.id = `${lib}-chart`;

    chartBox.appendChild(chartTitle);
    chartBox.appendChild(chartDiv);
    container.appendChild(chartBox);

    drawChart(lib, chartDiv.id);
  });
}

// --- Draw Single Library Chart ---
// Supports dual y-axis chart via Plotly's 'overlaying' feature
// Ref: https://plotly.com/javascript/multiple-axes/
function drawChart(lib, chartId) {
  const data = allLibraryData[lib];
  const time = data.map(row => row.time);

  if (currentMode === 'thermal') {
    const temp = data.map(row => row.ta);
    const pmv = data.map(row => row.pmv);

    Plotly.newPlot(chartId, [
      {
        x: time,
        y: temp,
        name: 'Temperature (°C)',
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y1'
      },
      {
        x: time,
        y: pmv,
        name: 'PMV',
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y2'
      }
    ], {
      xaxis: {
        title: 'Time',
        tickvals: ['00:00', '06:00', '12:00', '18:00', '23:00']
      },
      yaxis: { title: 'Temperature (°C)', side: 'left' },
      yaxis2: { title: 'PMV', overlaying: 'y', side: 'right', range: [-1, 1] },
      legend: { x: 0, y: 1.1, orientation: 'h' },
      margin: { t: 30 }
    });
  } else {
    const spl = data.map(row => row.spl);
    const nc = data.map(row => row.nc);

    Plotly.newPlot(chartId, [
      {
        x: time,
        y: spl,
        name: 'Noise Level (dB)',
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y1'
      },
      {
        x: time,
        y: nc,
        name: 'NC Rating',
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y2'
      }
    ], {
      xaxis: {
        title: 'Time',
        tickvals: ['00:00', '06:00', '12:00', '18:00', '23:00']
      },
      yaxis: { title: 'Noise Level (dB)', side: 'left' },
      yaxis2: { title: 'NC Rating', overlaying: 'y', side: 'right' },
      legend: { x: 0, y: 1.1, orientation: 'h' },
      margin: { t: 30 }
    });
  }
}

// --- Dropdown Event Listener ---
// Switch between "Thermal Comfort" and "Acoustic Comfort"
document.getElementById("modeMenu").addEventListener("change", (e) => {
  currentMode = e.target.value;
  renderCharts();
});

// --- Comparison Toggle Event Listener ---
// Switch between PMV and NC comparison views
document.getElementById("toggleComparison").addEventListener("click", () => {
  comparisonMode = comparisonMode === 'pmv' ? 'nc' : 'pmv';
  document.getElementById("toggleComparison").textContent = 
    comparisonMode === 'pmv' ? "Switch to NC Rating Comparison" : "Switch to PMV Comparison";
  renderPMVComparisonChart();
});

// --- Initial Chart Rendering ---
renderCharts();
