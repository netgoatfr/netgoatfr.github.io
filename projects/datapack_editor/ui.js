// ui.js
import { state } from './state.js';
import { TEMPLATES } from './constants.js';
import { processAndExport } from './structureProcessor.js';
import { showStatus } from './status.js';

export function setApp(html) {
    document.getElementById("app").innerHTML = html;
}
export function setControls(html) {
    document.getElementById("controls").innerHTML = html;
}
export function setInfo(html) {
    document.getElementById("info").innerHTML = html;
}

function normalizeModName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export function renderStructureList() {
    const rows = state.structureData
        .map((data, i) => {
            const parts = data.entry.filename.split("/");
            const ns = parts[1];
            const name = parts.slice(4).join("/");
            const isSelected = state.selectedIndices.has(i);
            
            return `
        <div class="entry-row ${isSelected ? 'selected' : ''}" data-index="${i}">
          <div class="entry-header">
            <input type="checkbox" class="entry-check" data-index="${i}" ${isSelected ? 'checked' : ''} />
            <span class="entry-ns">${ns}</span>
            <span class="entry-sep">:</span>
            <span class="entry-name">${name.replace(/\.json$/, "")}</span>
            <select class="entry-template" data-index="${i}">
              ${Object.values(TEMPLATES).map(tmpl => 
                `<option value="${tmpl.id}" ${data.template === tmpl.id ? "selected" : ""}>${tmpl.name}</option>`
              ).join('')}
            </select>
          </div>
          <button class="toggle-options" data-index="${i}">▼</button>
          <div class="entry-options" id="options-${i}" style="display: none;">
            ${data.template === "basic" ? `` : data.template === "deep_fried" ? `
              <label>Terrain adaptation: <select class="entry-terrain-adapt-deep" data-index="${i}">
                <option value="beard_thin" ${data.terrainAdaptation === "beard_thin" ? "selected" : ""}>beard_thin</option>
                <option value="beard_box" ${data.terrainAdaptation === "beard_box" ? "selected" : ""}>beard_box</option>
                <option value="bury" ${data.terrainAdaptation === "bury" ? "selected" : ""}>bury</option>
                <option value="encapsulate" ${(data.terrainAdaptation === "encapsulate" || data.terrainAdaptation === "none") ? "selected" : ""}>encapsulate</option>
              </select></label>
            ` : ''}
          </div>
        </div>`;
        })
        .join("");

    setApp(`
    <div class="section-title">
      <span class="step-badge">2</span>
      Select and configure structures to modify
    </div>
    <div class="entry-toolbar">
      <button id="btn-select-all" class="btn-small">Select all</button>
      <button id="btn-deselect-all" class="btn-small">Deselect all</button>
      <span class="entry-count">${state.structureData.length} structures (${state.selectedIndices.size} selected)</span>
    </div>
    <div class="entry-list" id="entry-list">${rows}</div>

    <div class="mod-name-row">
      <label for="mod-name-input">Mod name (used in pack description):</label>
      <input type="text" id="mod-name-input" placeholder="e.g. My Awesome Mod"
             value="${state.existingMcmeta?.pack?.description || state.fileName.replace("no_void","") || ""}" autocomplete="off" spellcheck="false" />
      <span class="mod-name-preview" id="mod-name-preview"></span>
    </div>

    <div class="action-row">
      <button id="btn-process" class="btn-primary">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 3L6 10.5 3 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Apply modifications &amp; export
      </button>
    </div>
    <div id="status-area"></div>
  `);

    // Toggle options display
    document.querySelectorAll('.toggle-options').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.dataset.index;
            const options = document.getElementById(`options-${index}`);
            if (options.style.display === 'none') {
                options.style.display = 'block';
                e.target.textContent = '▲';
            } else {
                options.style.display = 'none';
                e.target.textContent = '▼';
            }
        });
    });

    // Multi-select with Ctrl/Shift/Ctrl+Shift clicks
    let lastSelectedIndex = -1;
    document.querySelectorAll('.entry-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') return;
            if (e.target.tagName === 'SELECT') return;
            if (e.target.tagName === 'BUTTON') return;
            
            const index = parseInt(row.dataset.index);
            
            if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd+click: toggle selection
                if (state.selectedIndices.has(index)) {
                    state.selectedIndices.delete(index);
                } else {
                    state.selectedIndices.add(index);
                }
                lastSelectedIndex = index;
            } else if (e.shiftKey && lastSelectedIndex !== -1) {
                // Shift+click: select range
                const start = Math.min(lastSelectedIndex, index);
                const end = Math.max(lastSelectedIndex, index);
                for (let i = start; i <= end; i++) {
                    state.selectedIndices.add(i);
                }
            } else {
                // Regular click: select only this
                state.selectedIndices.clear();
                state.selectedIndices.add(index);
                lastSelectedIndex = index;
            }
            
            renderStructureList();
        });
    });

    // Checkbox sync
    document.querySelectorAll('.entry-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            if (e.target.checked) {
                state.selectedIndices.add(index);
            } else {
                state.selectedIndices.delete(index);
            }
        });
    });

    // Template selector
    document.querySelectorAll('.entry-template').forEach(select => {
        select.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            state.structureData[index].template = e.target.value;
            renderStructureList();
        });
    });

    document.getElementById("btn-select-all").addEventListener("click", () => {
        state.selectedIndices.clear();
        for (let i = 0; i < state.structureData.length; i++) {
            state.selectedIndices.add(i);
        }
        renderStructureList();
    });
    document.getElementById("btn-deselect-all").addEventListener("click", () => {
        state.selectedIndices.clear();
        renderStructureList();
    });

    const modInput = document.getElementById("mod-name-input");
    const modPreview = document.getElementById("mod-name-preview");
    const updatePreview = () => {
        const norm = normalizeModName(modInput.value);
        modPreview.textContent = norm ? `→ "${norm}_patched"` : "";
    };
    modInput.addEventListener("input", updatePreview);
    updatePreview();

    document.getElementById("btn-process").addEventListener("click", processAndExport);
}

function parseCsvLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = "";
            continue;
        }
        current += char;
    }
    values.push(current.trim());
    return values;
}

function loadCSV() {
    const fileInput = document.getElementById("csvFile");
    const file = fileInput.files[0];
    if (!file) {
        showStatus("No CSV file selected.", "warn");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length < 2) {
            showStatus("CSV must have at least a header and one data row.", "error");
            return;
        }

        const header = parseCsvLine(lines[0]);
        if (header[0] !== "path") {
            showStatus("CSV header must start with 'path'.", "error");
            return;
        }

        const allowedColumns = new Set(["path", "template", "overwriteHeights", "minHeight", "maxHeight", "startHeight", "terrainAdaptation"]);
        const invalidColumns = header.filter(column => !allowedColumns.has(column));
        if (invalidColumns.length > 0) {
            showStatus(`Invalid CSV columns: ${invalidColumns.join(", ")}.`, "error");
            return;
        }

        if (header.length === 1) {
            showStatus("CSV must include at least one column besides 'path'.", "error");
            return;
        }

        let updated = 0;
        for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
            const values = parseCsvLine(lines[rowIndex]);
            if (values.length !== header.length) continue;


            const row = Object.fromEntries(header.map((key, index) => [key, values[index]]));
            console.log(row)
            const data = state.structureData.find((d) => d.entry.filename.split("/").slice(4).join("/").replace(/\.json$/, "") === row.path);
            if (!data) continue;

            console.log(row)

            let modified = false;
            if (row.template && row.template !== data.template && row.template !== "none") {
                data.template = row.template;
                modified = true;
            }
            if (typeof row.overwriteHeights !== "undefined" && row.overwriteHeights !== "") {
                const normalized = row.overwriteHeights.toLowerCase();
                data.overwriteHeights = normalized === "true" || normalized === "1";
                modified = true;
            }
            if (typeof row.minHeight !== "undefined" && row.minHeight !== "") {
                const value = parseInt(row.minHeight, 10);
                if (!Number.isNaN(value)) {
                    data.minHeight = value;
                    modified = true;
                }
            }
            if (typeof row.maxHeight !== "undefined" && row.maxHeight !== "") {
                const value = parseInt(row.maxHeight, 10);
                if (!Number.isNaN(value)) {
                    data.maxHeight = value;
                    modified = true;
                }
            }
            if (typeof row.startHeight !== "undefined" && row.startHeight !== "") {
                const value = parseInt(row.startHeight, 10);
                if (!Number.isNaN(value)) {
                    data.startHeight = value;
                    modified = true;
                }
            }
            if (typeof row.terrainAdaptation !== "undefined" && row.terrainAdaptation !== "") {
                data.terrainAdaptation = row.terrainAdaptation;
                modified = true;
            }

            if (modified) {
                updated += 1;
            }
        }
        renderStructureList();
        showStatus(`Loaded CSV: updated ${updated} structure(s).`, "success");
    };
    reader.readAsText(file);
}

export function renderNoStructures() {
    setApp(`
    <div class="empty-state">
      <div class="empty-icon">📦</div>
      <p>No <code>data/&lt;ns&gt;/worldgen/structure/*.json</code> files found in this archive.</p>
      <p class="muted">Make sure you loaded the correct .jar file.</p>
    </div>
  `);
}

export function init() {
    setApp(`
    <div class="welcome">
      <div class="section-title">
        <span class="step-badge">1</span>
        Load a mod .jar file
      </div>
      <p class="muted">Select a Minecraft mod <code>.jar</code> to scan for worldgen structure definitions.</p>
    </div>
    <div id="status-area"></div>
  `);

    setControls(`
    <div class="left">
        <div class="file-input-wrap">
        <label for="inputFile" class="btn-file">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1v9M3.5 6l4-4 4 4M2 12h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Open .jar / .zip
            <input type="file" id="inputFile" accept=".jar,.zip" />
        </label>
        </div>
        <div class="csv-input-wrap">
        <label for="csvFile">Load CSV for mass modify:</label>
        <input type="file" id="csvFile" accept=".csv" />
        <button id="btn-load-csv" class="btn-small">Load CSV</button>
        </div>
        <button id="reset" class="btn-reset">↺ Reset</button>
    </div>
    <div class="right">
        <label>Global Min Height: <input type="number" id="cfg-min" value="-64" /></label>
        <label>Global Max Height: <input type="number" id="cfg-max" value="512" /></label>
        <label>Global Start Height: <input type="number" id="cfg-start" value="-48" /></label>
    </div>
  `);


    setInfo(`
    <p>Load a Minecraft mod <code>.jar</code> or an existing datapack <code>.zip</code>, select which worldgen structures to patch, then export a datapack zip that wraps each structure with <a href="https://modrinth.com/mod/lithostitched" target="_blank">Lithostitched</a>'s delegating type and height filter — preventing void spawning.</p>
  `);

    document.getElementById("btn-load-csv").addEventListener("click", loadCSV);
}