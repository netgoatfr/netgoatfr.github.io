// fileHandler.js
import { state } from './state.js';
import { DEFAULT_MIN_HEIGHT, DEFAULT_MAX_HEIGHT, DEFAULT_START_HEIGHT } from './constants.js';
import { showStatus } from './status.js';
import { isTargetStructure } from './structureProcessor.js';
import { renderStructureList, renderNoStructures } from './ui.js';

import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter
} from "https://cdn.jsdelivr.net/npm/@zip.js/zip.js/+esm";

export async function loadMeta() {
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

export function checkApi() {
    if (!(globalThis.File && globalThis.FileReader && globalThis.FileList && globalThis.Blob)) {
        alert("File API not supported in this browser.");
    }
}

export function bindFileInput() {
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
                    template: "basic",
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