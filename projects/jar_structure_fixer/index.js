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
        document.title = "Jar Structure Fixer - netgoatfr";
        document.getElementById("project-title").textContent = "Jar Structure Fixer";
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

    return {
        minHeight: isNaN(minHeightInput) ? DEFAULT_MIN_HEIGHT : minHeightInput,
        maxHeight: isNaN(maxHeightInput) ? DEFAULT_MAX_HEIGHT : maxHeightInput,
        startHeight: isNaN(startHeightInput) ? DEFAULT_START_HEIGHT : startHeightInput,
    };
}
function convertStructure(original) {
  const { minHeight, maxHeight, startHeight } = getConfig();

  const heightFilter = {
    type: "lithostitched:height_filter",
    range_type: "absolute",
    permitted_range: {
      min_inclusive: minHeight,
      max_inclusive: maxHeight
    }
  };


  if (original.type === "lithostitched:delegating") {
    original.spawn_condition = heightFilter;
    original.start_height = { absolute: startHeight }
    return original;
  } else {  
    return {
        type: "lithostitched:delegating",
        delegate: original,
        spawn_condition: heightFilter,
        start_height: { absolute: startHeight }
        };
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
    const rows = state.structureEntries
        .map((entry, i) => {
            const parts = entry.filename.split("/");
            const ns = parts[1];
            const name = parts.slice(4).join("/");
            return `
        <label class="entry-row" data-index="${i}">
          <input type="checkbox" class="entry-check" data-index="${i}" checked />
          <span class="entry-ns">${ns}</span>
          <span class="entry-sep">:</span>
          <span class="entry-name">${name.replace(/\.json$/, "")}</span>
        </label>`;
        })
        .join("");

    setApp(`
    <div class="section-title">
      <span class="step-badge">2</span>
      Select structures to modify
    </div>
    <div class="entry-toolbar">
      <button id="btn-select-all" class="btn-small">Select all</button>
      <button id="btn-deselect-all" class="btn-small">Deselect all</button>
      <span class="entry-count">${state.structureEntries.length} structures</span>
    </div>
    <div class="entry-list" id="entry-list">${rows}</div>

    <div class="mod-name-row">
      <label for="mod-name-input">Mod name (used in pack description):</label>
      <input type="text" id="mod-name-input" placeholder="e.g. My Awesome Mod"
             value="${state.existingMcmeta?.pack?.description || state.fileName || ""}" autocomplete="off" spellcheck="false" />
      <span class="mod-name-preview" id="mod-name-preview"></span>
    </div>

    <div class="action-row">
      <button id="btn-process" class="btn-primary">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 3L6 10.5 3 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Apply fixes &amp; export
      </button>
    </div>
    <div id="status-area"></div>
  `);

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
        modPreview.textContent = norm ? `→ "no_void_${norm}"` : "";
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

    const modNameRaw = (document.getElementById("mod-name-input")?.value || state.fileName.replace("no_void","") || "mod");
    const modName = normalizeModName(modNameRaw) || "mod";

    const btn = document.getElementById("btn-process");
    btn.disabled = true;
    btn.textContent = "Processing…";

    try {
        showStatus("Reading selected structure files…", "info");

        const selectedIndices = new Set(checkedBoxes.map(cb => parseInt(cb.dataset.index)));
        const selectedEntries = state.structureEntries.filter((_, i) => selectedIndices.has(i));

        // Read & transform each file
        const transformed = [];
        for (const entry of selectedEntries) {
            const writer = new TextWriter();
            const text = await entry.getData(writer);
            const json = JSON.parse(text);
            const modified = convertStructure(json);
            transformed.push({ path: entry.filename, content: JSON.stringify(modified, null, 2) });
        }

        showStatus(`Transformed ${transformed.length} file(s). Building output zip…`, "info");

        // Build output zip
        const zipBlobWriter = new BlobWriter("application/zip");
        const zipWriter = new ZipWriter(zipBlobWriter);

        // pack.mcmeta
        const mcmeta = JSON.stringify({
            pack: {
                description: `no_void_${modName}`,
                pack_format: 15
            }
        }, null, 2);

        if (state.inputMode === "datapack") {
            // Carry over every file that isn't one of the selected structures
            const selectedPaths = new Set(selectedEntries.map(e => e.filename));
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
        a.download = state.inputMode === "datapack" ? `${state.fileName}_patched.zip` : `no_void_${modName}.zip`;
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
    <div class="file-input-wrap">
      <label for="inputFile" class="btn-file">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1v9M3.5 6l4-4 4 4M2 12h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Open .jar / .zip
        <input type="file" id="inputFile" accept=".jar,.zip" />
      </label>
    </div>
    <button id="reset" class="btn-reset">↺ Reset</button>
    <br>
    <label>Min height <input type="number" id="cfg-min" value="${DEFAULT_MIN_HEIGHT}" /></label>
    <label>Max height <input type="number" id="cfg-max" value="${DEFAULT_MAX_HEIGHT}" /></label>
    <label>Start height <input type="number" id="cfg-start" value="${DEFAULT_START_HEIGHT}" /></label>
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