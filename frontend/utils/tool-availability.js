// Deployment gates for the Advanced Tools registry (data/tools.js): decides
// whether a tool is listed in the card grid and the nav. A tool can require
// the original site (`requiresOriginalSite`) and/or one `/api/configs` flag
// (`requiresConfig`). Configs arrive asynchronously (`{}` until the fetch
// lands), so a gated tool reads as unavailable until then. Deep links
// (`?tool=` drawer, `/tools/:slug`) are not gated.

export const isToolAvailable = (tool, configs) => {
    if (!tool) return false;
    if (tool.requiresOriginalSite && !configs?.originalSite) return false;
    if (tool.requiresConfig && !configs?.[tool.requiresConfig]) return false;
    return true;
};
