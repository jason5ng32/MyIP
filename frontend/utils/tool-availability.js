// Deployment gates for the Advanced Tools registry (data/tools.js): decides
// whether a tool is listed in the card grid and the nav. Callers pass the
// store's `capabilities` (the `/api/configs` flags plus the build-time facts).
// A tool can require sign-in (`requiresAccount`) and/or capability keys
// (`requiresConfig`: one key or an array, all of which must be true). Configs
// arrive asynchronously (`{}` until the fetch lands), so a config-gated tool
// reads as unavailable until then. A /tools/:slug link is not gated.

export const isToolAvailable = (tool, capabilities) => {
    if (!tool) return false;
    if (tool.requiresAccount && !capabilities?.accounts) return false;
    const keys = [].concat(tool.requiresConfig ?? []);
    if (keys.some((key) => !capabilities?.[key])) return false;
    return true;
};

export const listedTools = (tools, capabilities) => tools.filter((tool) => isToolAvailable(tool, capabilities));
