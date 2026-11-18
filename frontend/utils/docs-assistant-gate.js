// Whether this deployment ships the docs assistant: a docs site to answer from
// (build-time VITE_DOCS_URL, passed in by the caller) and sign-in, which the
// assistant requires. Read by its nav entry point and the privacy policy.

export const isDocsAssistantAvailable = (docsConfigured, capabilities) =>
    !!docsConfigured && !!capabilities?.accounts;
