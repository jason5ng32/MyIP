// Preloaded by `pnpm test` (node --import) before any spec. Keeps the shared
// logger off its pino-pretty worker thread: under a loaded parallel run that
// thread can keep a finished spec process from exiting. JSON output writes
// synchronously, with no worker.
process.env.LOG_FORMAT ??= 'json';
