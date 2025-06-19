// ==========================
// LIBRARY HEATMAP DASHBOARD
// ==========================
// This JavaScript handles dynamic heatmap visualisation for library environments,
// based on PMV (thermal comfort) and NC (acoustic comfort) indices.
// The script now supports both "normal" and "busy" day datasets,
// loading separate CSVs depending on the day type selected.
// Visualisation: Built using Plotly.js — https://plotly.com/javascript/heatmaps/
// CSV structure: time, pmv, ta (air temp), nc, spl (sound pressure level)

// === CONFIGURATION ===
const libraries = ['fisher', 'law', 'scitech', 'health']; // List of libraries in the dashboard
const allLibraryData = {}; // Global object to store data from all CSVs
let currentDayType = 'normal'; // Tracks whether we're in "normal" or "busy" mode


// === LOAD CSV DATA ===
// Load and parse CSV data for a single library
// CSV file structure: data/fisher.csv or data/fisher_busy.csv, etc.
async function loadData(library) {
  const suffix = currentDayType === 'normal' ? '' : `_${currentDayType}`; // add _busy if needed
  const response = await fetch(`data/${library}${suffix}.csv`);
  const text = await response.text();
  const rows = text.trim().split('\n').slice(1); // skip header row

  allLibraryData[library] = rows.map(row => {
    const [time, pmv, ta, nc, spl] = row.split(',');
    return {
      time: time.trim(),
      spl: parseFloat(spl),
      ta: parseFloat(ta),
      pmv: parseFloat(pmv),
      nc: parseFloat(nc)
    };
  });
}

// Reloads all data for current day type and re-renders visualisations
async function reloadAllDataAndRender() {
  for (const lib of libraries) {
    await loadData(lib);
  }

  const selectedTime = document.getElementById('timeSelector').value || '00:00';
  renderPlotlyHeatmaps(selectedTime);
  displayDataAtTime(selectedTime);
}


// === HELPER FUNCTIONS ===

// Emoji indicator based on PMV comfort level
function getEmoji(pmv) {
  const absPMV = Math.abs(pmv);
  if (absPMV <= 0.2) return '😊'; // Optimal comfort
  if (absPMV <= 0.5) return '😐'; // Slight discomfort
  return '😞'; // Uncomfortable
}

// Get color based on PMV (green = comfortable)
function getComfortColor(pmv) {
  const absPMV = Math.abs(pmv);
  if (absPMV <= 0.2) return '#4caf50'; // green (comfortable)
  if (absPMV <= 0.5) return '#ffeb3b'; // yellow (moderate comfort)
  return '#f44336'; // red (uncomfortable)
}

// Show the comfort level in the small boxes beside heatmaps
function displayDataAtTime(timeStr) {
  for (const lib of libraries) {
    const row = allLibraryData[lib].find(r => r.time === timeStr);
    const container = document.querySelector(`#${lib} .content`);
    if (row && container) {
      const comfortColor = getComfortColor(row.pmv);
      container.innerHTML = `
      <div style="background-color: ${comfortColor}; padding: 5px; border-radius: 5px;">
        Comfort Level ${getEmoji(row.pmv)}
      </div>`;
    }
  }

  updateMostComfortableLibrary(timeStr);
}

// Find and display the most comfortable library at a selected time
// Score = PMV closeness to 0 + a weighted noise factor (lower = better)
function updateMostComfortableLibrary(timeStr) {
  let bestLibrary = null;
  let bestScore = Infinity;

  for (const lib of libraries) {
    const row = allLibraryData[lib].find(r => r.time === timeStr);
    if (row) {
      const score = Math.abs(row.pmv) + row.nc * 0.05; // noise weight is adjustable
      if (score < bestScore) {
        bestScore = score;
        bestLibrary = lib;
      }
    }
  }

  const resultSpan = document.getElementById('mostComfortable');
  const timeSpan = document.getElementById('selectedTime');

  resultSpan.textContent = bestLibrary
    ? bestLibrary.charAt(0).toUpperCase() + bestLibrary.slice(1)
    : 'No data';
  timeSpan.textContent = timeStr;
}

// (Optional utility) Return a color index for visualizing PMV categories
function getPMVColorIndex(pmv) {
  const abs = Math.abs(pmv);
  if (abs <= 0.2) return 0;
  if (abs <= 0.5) return 1;
  return 2;
}


// === HEATMAP VISUALISATION ===
function renderPlotlyHeatmaps(selectedTime = '00:00') {
  const selectedTicks = ['00:00', '06:00', '12:00', '18:00', '23:00'];

  libraries.forEach(lib => {
    const containerId = `${lib}-heatmap`;
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = allLibraryData[lib];
    if (!data || data.length !== 24) return;

    const times = data.map(entry => entry.time);
    const pmvValues = data.map(entry => entry.pmv);
    const ncValues = data.map(entry => entry.nc);
    const temperatures = data.map(entry => entry.ta);

    // Add dynamic annotations for selected time
    let annotations = [
      {
        text: "Thermal Comfort — Temp: -",
        x: 0,
        y: 0.94,
        xref: "paper",
        yref: "paper",
        xanchor: "left",
        yanchor: "bottom",
        showarrow: false,
        font: { size: 12, color: "black" }
      },
      {
        text: "Sound Level Comfort — Sound(dB): - ",
        x: 0,
        y: 0.48,
        xref: "paper",
        yref: "paper",
        xanchor: "left",
        yanchor: "bottom",
        showarrow: false,
        font: { size: 12, color: "black" }
      }
    ];

    if (selectedTime && times.includes(selectedTime)) {
      const timeLabel = selectedTime;

      annotations.push(
        { text: "▼", x: timeLabel, y: 0.83, xref: "x", yref: "paper", showarrow: false, font: { size: 18 }, xanchor: "center", yanchor: "bottom" },
        { text: "▲", x: timeLabel, y: 0.21, xref: "x", yref: "paper", showarrow: false, font: { size: 18 }, xanchor: "center", yanchor: "bottom" }
      );
    }

    // Heatmap for PMV
    const pmvTrace = {
      z: [pmvValues.map(v => Math.abs(v))],
      x: times,
      y: ['PMV'],
      type: 'heatmap',
      xgap: 2,
      ygap: 2,
      xaxis: 'x',
      yaxis: 'y',
      colorscale: [
        [0.0, '#4caf50'], [0.2, '#4caf50'],    // Green
        [0.201, '#ffeb3b'], [0.5, '#ffeb3b'],  // Yellow
        [0.501, '#f44336'], [1.0, '#f44336']   // Red
      ],
      zmin: 0,
      zmax: 1,
      showscale: false,
      text: [temperatures.map(t => `${t.toFixed(1)} °C`)],
      customdata: [pmvValues.map(v => v.toFixed(2))],
      hovertemplate: '%{x}<br>PMV: %{customdata}<br>Temp: %{text}<extra></extra>'
    };

    // Heatmap for NC rating
    const ncTrace = {
      z: [ncValues],
      x: times,
      y: ['NC'],
      type: 'heatmap',
      xgap: 2,
      ygap: 2,
      xaxis: 'x2',
      yaxis: 'y2',
      colorscale: [
        [0.0, '#4caf50'], [0.33, '#4caf50'],
        [0.34, '#ffeb3b'], [0.66, '#ffeb3b'],
        [0.67, '#f44336'], [1.0, '#f44336']
      ],
      zmin: Math.min(...ncValues),
      zmax: Math.max(...ncValues),
      showscale: false,
      text: [ncValues.map(v => `NC ${v.toFixed(0)}`)],
      hovertemplate: '%{x}<br>%{text}<extra></extra>'
    };

    // Plot layout with dual heatmaps
    const layout = {
      grid: { rows: 2, columns: 1, pattern: 'independent' },
      height: 260,
      width: container.clientWidth,
      margin: { t: 40, b: 1, l: 40, r: 20 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      title: {
        text: `${lib.charAt(0).toUpperCase() + lib.slice(1)} Thermal & Acoustic Heatmaps`,
        font: { size: 14 },
        x: 0.01,
        xanchor: 'left'
      },
      xaxis: {
        domain: [0, 1],
        anchor: 'y',
        type: 'category',
        tickvals: selectedTicks,
        tickfont: { size: 10 },
        automargin: true
      },
      yaxis: {
        domain: [0.70, 0.92],
        showticklabels: false
      },
      xaxis2: {
        domain: [0, 1],
        anchor: 'y2',
        type: 'category',
        tickvals: selectedTicks,
        tickfont: { size: 10 },
        automargin: true
      },
      yaxis2: {
        domain: [0.23, 0.46],
        showticklabels: false
      },
      annotations: annotations
    };

    // Plot heatmaps
    Plotly.newPlot(containerId, [pmvTrace, ncTrace], layout, { responsive: true }).then(() => {
      const row = allLibraryData[lib].find(r => r.time === selectedTime);
      if (row) {
        Plotly.relayout(containerId, {
          'annotations[0].text': `Thermal Comfort — Temp: ${row.ta.toFixed(1)} °C`,
          'annotations[1].text': `Acoustic Comfort — Sound: ${row.nc.toFixed(0)} (dB)`
        });
      }
    });
  });
}


// === INITIALIZATION ===
async function init() {
  for (const lib of libraries) {
    await loadData(lib);
  }

  const selector = document.getElementById('timeSelector');
  const defaultTime = selector?.value || '00:00';

  renderPlotlyHeatmaps(defaultTime);
  displayDataAtTime(defaultTime);

  if (selector) {
    selector.addEventListener('change', () => {
      const selectedTime = selector.value;
      displayDataAtTime(selectedTime);
      renderPlotlyHeatmaps(selectedTime);
    });
  }

  if (typeof renderLineChart === 'function') {
    renderLineChart();
  }
}

// === DAY TYPE SWITCH HANDLER ===
// Allows user to switch between 'normal' and 'busy' CSVs
const daySelector = document.getElementById('daySelector');
if (daySelector) {
  daySelector.addEventListener('change', () => {
    currentDayType = daySelector.value;
    reloadAllDataAndRender();
  });
}

document.addEventListener('DOMContentLoaded', init);
