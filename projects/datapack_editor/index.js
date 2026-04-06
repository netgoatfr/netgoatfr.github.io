import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter
} from "https://cdn.jsdelivr.net/npm/@zip.js/zip.js/+esm";
// --------- META LOADING ----------
async function loadMeta() {
    try {
        const res = await fetch("meta.json");
        const meta = await res.json();
        document.title = meta.title + " - netgoatfr";
        document.getElementById("project-title").textContent = meta.title;
    } catch {
        document.title = "Minecraft Structure Datapack Modifier and Editor - netgoatfr";
        document.getElementById("project-title").textContent = "Minecraft Structure Datapack Modifier and Editor";
    }
    
}

// --------- HELPERS -------------

const DEFAULT_MIN_HEIGHT = -256;
const DEFAULT_MAX_HEIGHT = 1280;
const DEFAULT_START_HEIGHT = -232;

const state = {
    /** @type {ZipReader|null} */
    zipReader: null,
    /** @type {import("jsr:@zip-js/zip-js").Entry[]} */
    allEntries: [],
    /** @type {import("jsr:@zip-js/zip-js").Entry[]} */
    structureEntries: [],
    /** @type {string|null} */
    fileName: null,
    /** @type {string} */
    inputMode: "jar", // "jar" | "datapack"
    /** @type {string|null} */
    existingMcmeta: null,
    
    globalTerrainAdaptation: "none",
    /** @type {Array} */
    structureData: [],
};

function setApp(html) {
    document.getElementById("app").innerHTML = html;
}
function setControls(html) {
    document.getElementById("controls").innerHTML = html;
}
function setInfo(html) {
    document.getElementById("info").innerHTML = html;
}

function normalizeModName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// --------- PROJECT CODE ----------

function isTargetStructure(path) {
    const parts = path.split("/");
    /*
      0 => "data"
      1 => Namespace folder
      2 => "worldgen"
      3 => "structure"
      4+ => <file>.json
    */
    return (
        parts.length >= 5 &&
        parts[0] === "data" &&
        parts[2] === "worldgen" &&
        parts[3] === "structure" &&
        path.endsWith(".json")
    );
}

function getConfig() {
    const minHeightInput = parseInt(document.getElementById("cfg-min")?.value);
    const maxHeightInput = parseInt(document.getElementById("cfg-max")?.value);
    const startHeightInput = parseInt(document.getElementById("cfg-start")?.value);
    const terrainAdaptationInput = document.getElementById("cfg-terrain-adapt")?.value;

    return {
        minHeight: isNaN(minHeightInput) ? DEFAULT_MIN_HEIGHT : minHeightInput,
        maxHeight: isNaN(maxHeightInput) ? DEFAULT_MAX_HEIGHT : maxHeightInput,
        startHeight: isNaN(startHeightInput) ? DEFAULT_START_HEIGHT : startHeightInput,
        terrainAdaptation: terrainAdaptationInput || "none",
    };
}
function convertStructure(data) {
  const { minHeight, maxHeight, startHeight, terrainAdaptation } = getConfig();

  const heightFilter = {
    type: "lithostitched:height_filter",
    range_type: "absolute",
    permitted_range: {
      min_inclusive: data.overwriteHeights ? data.minHeight : minHeight,
      max_inclusive: data.overwriteHeights ? data.maxHeight : maxHeight
    }
  };

  const startHeightVal = data.overwriteHeights ? data.startHeight : startHeight;

  const modifiedDelegate = { ...data.delegate };

  // Set terrain_adaptation if changed from current
  if (data.terrainAdaptation  !== terrainAdaptation) {
    modifiedDelegate.terrain_adaptation = terrainAdaptation;
  }

  if (data.delegated) {
    return {
        type: "lithostitched:delegating",
        delegate: modifiedDelegate,
        spawn_condition: heightFilter,
        start_height: { absolute: startHeightVal }
        };
  } else {  
    // Modify directly
    modifiedDelegate.spawn_condition = heightFilter;
    modifiedDelegate.start_height = { absolute: startHeightVal };
    return modifiedDelegate;
  }
}

// --------- STEP 1: File open ----------

function checkApi() {
    if (!(globalThis.File && globalThis.FileReader && globalThis.FileList && globalThis.Blob)) {
        alert("File API not supported in this browser.");
    }
}

function bindFileInput() {
    const input = document.getElementById("inputFile");
    if (!input) return;
    input.addEventListener("change", handleFile, false);
}

async function handleFile(ev) {
    const file = /** @type {HTMLInputElement} */ (ev.target).files.item(0);
    if (!file) {
        showStatus("No file selected.", "error");
        return;
    }
    const isJar = file.name.endsWith(".jar");
    const isZip = file.name.endsWith(".zip");
    if (!isJar && !isZip) { showStatus("Please select a .jar or .zip file.", "error"); return; }

    state.inputMode = isJar ? "jar" : "datapack";

    state.fileName = file.name.replace(/\.jar$/i, "");

    try {
        showStatus("Opening archive…", "info");
        const zipFileReader = new BlobReader(file);
        state.zipReader = new ZipReader(zipFileReader);
        state.allEntries = await state.zipReader.getEntries();
        state.structureEntries = state.allEntries.filter(e => isTargetStructure(e.filename));

        if (state.structureEntries.length > 0) {
            showStatus("Loading structure data…", "info");
            state.structureData = await Promise.all(state.structureEntries.map(async (entry, _) => {
                const text = await entry.getData(new TextWriter());
                const original = JSON.parse(text);
                let isDelegated = false;
                let delegate = original;
                if (original.type === "lithostitched:delegating") {
                    isDelegated = true;
                    delegate = original.delegate;
                }
                const currentTerrainAdaptation = delegate.terrain_adaptation || "none";
                return {
                    entry,
                    original,
                    delegate,
                    isDelegated,
                    currentTerrainAdaptation,
                    delegated: true,
                    overwriteHeights: false,
                    minHeight: DEFAULT_MIN_HEIGHT,
                    maxHeight: DEFAULT_MAX_HEIGHT,
                    startHeight: DEFAULT_START_HEIGHT,
                    terrainAdaptation: currentTerrainAdaptation,
                };
            }));
        }

        if (state.inputMode === "datapack") {
            const mcmetaEntry = state.allEntries.find(e => e.filename === "pack.mcmeta");
            if (mcmetaEntry) {
                const text = await mcmetaEntry.getData(new TextWriter());
                state.existingMcmeta = JSON.parse(text);
            }
        }

        if (state.structureEntries.length === 0) {
            showStatus("No worldgen structure JSON files found in this .jar.", "warn");
            renderNoStructures();
        } else {
            showStatus(`Found <strong>${state.structureEntries.length}</strong> structure file(s).`, "success");
            renderStructureList();
        }
    } catch (err) {
        showStatus("Failed to open archive: " + err.message, "error");
    }
}

// --------- STEP 2: Structure list ----------

function renderStructureList() {
    const rows = state.structureData
        .map((data, i) => {
            const parts = data.entry.filename.split("/");
            const ns = parts[1];
            const name = parts.slice(4).join("/");
            return `
        <div class="entry-row" data-index="${i}">
          <label>
            <input type="checkbox" class="entry-check" data-index="${i}" checked />
            <span class="entry-ns">${ns}</span>
            <span class="entry-sep">:</span>
            <span class="entry-name">${name.replace(/\.json$/, "")}</span>
          </label>
          <button class="toggle-options" data-index="${i}">▼</button>
          <div class="entry-options" id="options-${i}" style="display: none;">
            <label>Delegated: <input type="checkbox" class="entry-delegated" data-index="${i}" checked /></label>
            <label>Overwrite heights: <input type="checkbox" class="entry-overwrite-heights" data-index="${i}" /></label>
            <label>Min H: <input type="number" class="entry-min-h" data-index="${i}" value="${DEFAULT_MIN_HEIGHT}" /></label>
            <label>Max H: <input type="number" class="entry-max-h" data-index="${i}" value="${DEFAULT_MAX_HEIGHT}" /></label>
            <label>Start H: <input type="number" class="entry-start-h" data-index="${i}" value="${DEFAULT_START_HEIGHT}" /></label>
            <label>Terrain adaptation: <select class="entry-terrain-adapt" data-index="${i}">
              <option value="none" ${data.currentTerrainAdaptation === "none" ? "selected" : ""}>none</option>
              <option value="beard_thin" ${data.currentTerrainAdaptation === "beard_thin" ? "selected" : ""}>beard_thin</option>
              <option value="beard_box" ${data.currentTerrainAdaptation === "beard_box" ? "selected" : ""}>beard_box</option>
              <option value="bury" ${data.currentTerrainAdaptation === "bury" ? "selected" : ""}>bury</option>
              <option value="encapsulate" ${data.currentTerrainAdaptation === "encapsulate" ? "selected" : ""}>encapsulate</option>
            </select></label>
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
      <span class="entry-count">${state.structureData.length} structures</span>
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

    document.getElementById("btn-select-all").addEventListener("click", () => {
        document.querySelectorAll(".entry-check").forEach(cb => (cb.checked = true));
    });
    document.getElementById("btn-deselect-all").addEventListener("click", () => {
        document.querySelectorAll(".entry-check").forEach(cb => (cb.checked = false));
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

function renderNoStructures() {
    setApp(`
    <div class="empty-state">
      <div class="empty-icon">📦</div>
      <p>No <code>data/&lt;ns&gt;/worldgen/structure/*.json</code> files found in this archive.</p>
      <p class="muted">Make sure you loaded the correct .jar file.</p>
    </div>
  `);
}

// --------- STEP 3: Process & export ----------

async function processAndExport() {
    const checkedBoxes = [...document.querySelectorAll(".entry-check:checked")];
    if (checkedBoxes.length === 0) {
        showStatus("No structures selected.", "warn");
        return;
    }

    // Determine the namespace with the most structures
    const namespaceCounts = {};
    for (const data of state.structureData) {
        const parts = data.entry.filename.split("/");
        const ns = parts[1];
        namespaceCounts[ns] = (namespaceCounts[ns] || 0) + 1;
    }
    let mostCommonNs = "mod";
    let maxCount = 0;
    for (const [ns, count] of Object.entries(namespaceCounts)) {
        if (count > maxCount) {
            maxCount = count;
            mostCommonNs = ns;
        }
    }

    const btn = document.getElementById("btn-process");
    btn.disabled = true;
    btn.textContent = "Processing…";

    try {
        showStatus("Reading selected structure files…", "info");

        const selectedIndices = new Set(checkedBoxes.map(cb => parseInt(cb.dataset.index)));

        // Update data from inputs
        for (const index of selectedIndices) {
            const data = state.structureData[index];
            data.delegated = document.querySelector(`.entry-delegated[data-index="${index}"]`).checked;
            data.overwriteHeights = document.querySelector(`.entry-overwrite-heights[data-index="${index}"]`).checked;
            data.minHeight = parseInt(document.querySelector(`.entry-min-h[data-index="${index}"]`).value) || DEFAULT_MIN_HEIGHT;
            data.maxHeight = parseInt(document.querySelector(`.entry-max-h[data-index="${index}"]`).value) || DEFAULT_MAX_HEIGHT;
            data.startHeight = parseInt(document.querySelector(`.entry-start-h[data-index="${index}"]`).value) || DEFAULT_START_HEIGHT;
            data.terrainAdaptation = document.querySelector(`.entry-terrain-adapt[data-index="${index}"]`).value;
        }

        const selectedData = state.structureData.filter((_, i) => selectedIndices.has(i));

        // Transform each file
        const transformed = selectedData.map(data => {
            const modified = convertStructure(data);
            return { path: data.entry.filename, content: JSON.stringify(modified, null, 2) };
        });

        showStatus(`Transformed ${transformed.length} file(s). Building output zip…`, "info");

        // Build output zip
        const zipBlobWriter = new BlobWriter("application/zip");
        const zipWriter = new ZipWriter(zipBlobWriter);

        // pack.mcmeta
        const mcmeta = JSON.stringify({
            pack: {
                description: `${mostCommonNs}_patched`,
                pack_format: 15
            }
        }, null, 2);

        if (state.inputMode === "datapack") {
            // Carry over every file that isn't one of the selected structures
            const selectedPaths = new Set(transformed.map(t => t.path));
            for (const entry of state.allEntries) {
                if (selectedPaths.has(entry.filename)) continue; // will be replaced below
                const blob = await entry.getData(new BlobWriter());
                await zipWriter.add(entry.filename, new BlobReader(blob));
            }
        } else {
            // Original .jar path: write a fresh pack.mcmeta
            await zipWriter.add("pack.mcmeta", new TextReader(mcmeta));
        }
        // Then write the transformed structures (applies to both modes)
        for (const { path, content } of transformed) {
            await zipWriter.add(path, new TextReader(content));
        }

        await zipWriter.close();
        const blob = await zipBlobWriter.getData();

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${mostCommonNs}_patched.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        showStatus(
            `<strong>Done!</strong> Exported <code>${a.download}</code> with ${transformed.length} modified structure(s).`,
            "success"
        );
    } catch (err) {
        showStatus("Export failed: " + err.message, "error");
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 3L6 10.5 3 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Apply fixes &amp; export`;
    }
}

// --------- STATUS ----------

function showStatus(html, type = "info") {
    const area = document.getElementById("status-area");
    if (!area) return;
    area.innerHTML = `<div class="status status-${type}">${html}</div>`;
}

// --------- RESET ----------

function resetAll() {
    if (state.zipReader) {
        state.zipReader.close().catch(() => {});
        state.zipReader = null;
    }
    state.allEntries = [];
    state.structureEntries = [];
    state.fileName = null;

    // Re-init full UI
    init();
}

// --------- INIT ----------

function init() {
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
        <button id="reset" class="btn-reset">↺ Reset</button>
    </div>
    <div class="right">
        <label>Global Min Height: <input type="number" id="cfg-min" value="${DEFAULT_MIN_HEIGHT}" /></label>
        <label>Global Max Height: <input type="number" id="cfg-max" value="${DEFAULT_MAX_HEIGHT}" /></label>
        <label>Global Start Height: <input type="number" id="cfg-start" value="${DEFAULT_START_HEIGHT}" /></label>
        <label>Global Terrain Adaptation: <select id="cfg-terrain-adapt">
        <option value="none">none</option>
        <option value="beard_thin">beard_thin</option>
        <option value="beard_box">beard_box</option>
        <option value="bury">bury</option>
        <option value="encapsulate">encapsulate</option>
        </select></label>
    </div>
  `);


    setInfo(`
    <p>Load a Minecraft mod <code>.jar</code> or an existing datapack <code>.zip</code>, select which worldgen structures to patch, then export a datapack zip that wraps each structure with <a href="https://modrinth.com/mod/lithostitched" target="_blank">Lithostitched</a>'s delegating type and height filter — preventing void spawning.</p>
  `);

    bindFileInput();

    document.getElementById("reset").addEventListener("click", resetAll);
}

// --------- BOOT ----------
globalThis.addEventListener("load", () => {
    loadMeta();
    checkApi();
    init();
});