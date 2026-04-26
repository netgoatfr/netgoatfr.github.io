// structureProcessor.js
import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter
} from "https://cdn.jsdelivr.net/npm/@zip.js/zip.js/+esm";
import { state } from './state.js';
import { DEFAULT_MIN_HEIGHT, DEFAULT_MAX_HEIGHT, DEFAULT_START_HEIGHT, TEMPLATES } from './constants.js';
import { showStatus } from './status.js';

export function isTargetStructure(path) {
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

export function getConfig() {
    const minHeightInput = parseInt(document.getElementById("cfg-min")?.value);
    const maxHeightInput = parseInt(document.getElementById("cfg-max")?.value);
    const startHeightInput = parseInt(document.getElementById("cfg-start")?.value);

    return {
        minHeight: isNaN(minHeightInput) ? DEFAULT_MIN_HEIGHT : minHeightInput,
        maxHeight: isNaN(maxHeightInput) ? DEFAULT_MAX_HEIGHT : maxHeightInput,
        startHeight: isNaN(startHeightInput) ? DEFAULT_START_HEIGHT : startHeightInput,
    };
}

export function convertStructure(data) {
    const { minHeight, maxHeight, startHeight } = getConfig();
    const template = TEMPLATES[data.template];

    if (!template) {
        throw new Error(`Unknown template: ${data.template}`);
    }

    // Unwrap if already delegated
    let baseStructure = data.isDelegated ? data.delegate : data.original;

    // Apply template modifications
    baseStructure = template.applyToStructure(baseStructure, data);

    if (template.wrapInDelegating) {
        // Create height filter
        const heightFilter = {
            type: "lithostitched:height_filter",
            range_type: "absolute",
            permitted_range: {
                min_inclusive: data.overwriteHeights ? data.minHeight : minHeight,
                max_inclusive: data.overwriteHeights ? data.maxHeight : maxHeight
            }
        };

        const startHeightVal = data.overwriteHeights ? data.startHeight : startHeight;

        // Wrap in delegating
        return {
            type: "lithostitched:delegating",
            delegate: baseStructure,
            spawn_condition: heightFilter,
            start_height: { absolute: startHeightVal }
        };
    } else {
        return baseStructure;
    }
}

export async function processAndExport() {
    if (state.selectedIndices.size === 0) {
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

        // Update data from inputs
        for (const index of state.selectedIndices) {
            const data = state.structureData[index];
            
            if (data.template === "basic") {
                data.isDelegated = true; // Mark as processed
            } else if (data.template === "deep_fried") {
                data.isDelegated = true;
                data.terrainAdaptation = document.querySelector(`.entry-terrain-adapt-deep[data-index="${index}"]`)?.value || "encapsulate";
            }
        }

        const selectedData = state.structureData.filter((_, i) => state.selectedIndices.has(i));

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