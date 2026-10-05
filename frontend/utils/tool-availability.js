// Deployment gates for the Advanced Tools registry (data/tools.js): decides
// whether a tool is listed in the card grid, the nav and the tools menu. A
// tool can require the original site (`requiresOriginalSite`) and/or one
// `/api/configs` flag (`requiresConfig`). Configs arrive asynchronously (`{}` until the fetch
// lands), so a gated tool reads as unavailable until then. Deep links
// (`?tool=` drawer, `/tools/:slug`) are not gated.
//
// listedTools() applies the gates to a whole registry for a menu;
// `standaloneOnly` also drops the `noStandalone` tools, for callers that can
// only open a tool as its /tools/:slug page.

export const isToolAvailable = (tool, configs) => {
    if (!tool) return false;
    if (tool.requiresOriginalSite && !configs?.originalSite) return false;
    if (tool.requiresConfig && !configs?.[tool.requiresConfig]) return false;
    return true;
};

export const listedTools = (tools, configs, { standaloneOnly = false } = {}) => tools.filter((tool) => (
    isToolAvailable(tool, configs) && !(standaloneOnly && tool.noStandalone)
));
