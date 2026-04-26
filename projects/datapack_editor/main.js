// main.js
import { loadMeta, checkApi, bindFileInput } from './fileHandler.js';
import { init } from './ui.js';
import { showStatus } from './status.js';
import { state } from './state.js';

export function resetAll() {
    if (state.zipReader) {
        state.zipReader.close().catch(() => {});
        state.zipReader = null;
    }
    state.allEntries = [];
    state.structureEntries = [];
    state.fileName = null;
    state.selectedIndices.clear();

    // Re-init full UI
    init();
    bindFileInput();
}

// --------- BOOT ----------
globalThis.addEventListener("load", () => {
    loadMeta();
    checkApi();
    init();
    bindFileInput();
    document.getElementById("reset").addEventListener("click", resetAll);
});