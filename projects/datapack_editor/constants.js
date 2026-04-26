// constants.js
export const DEFAULT_MIN_HEIGHT = -64;
export const DEFAULT_MAX_HEIGHT = 512;
export const DEFAULT_START_HEIGHT = -48;

// Template definitions
export const TEMPLATES = {
  basic: {
    id: "basic",
    name: "Basic",
    description: "Do not touch structures but add a platform AND wraps structure with height filter using delegating type",
    applyToStructure: (baseStructure, data) => baseStructure,
    wrapInDelegating: true,
  },
  deep_fried: {
    id: "deep_fried",
    name: "DEEP FRIED",
    description: "Encapsulate terrain adaptation (still wraps structures)",
    applyToStructure: (baseStructure, data) => ({
      ...baseStructure,
      terrain_adaptation: data.terrainAdaptation || "encapsulate"
    }),
    wrapInDelegating: true,
  },
  platform: {
    id: "platform",
    name: "PLATFORM",
    description: "Add a \"beard\" (platform) as terrain adaptation (still wraps structures)",
    applyToStructure: (baseStructure, data) => ({
      ...baseStructure,
      terrain_adaptation: data.terrainAdaptation || "beard_box"
    }),
    wrapInDelegating: true,
  }
};