// state.js
export const state = {
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
    /** @type {Array} */
    structureData: [],
    /** @type {Set<number>} */
    selectedIndices: new Set(),
};