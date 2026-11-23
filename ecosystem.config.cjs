// ecosystem.config.cjs — pm2 process definitions for production.
// `pm2 start ecosystem.config.cjs` so nobody has to remember the node flags:
// both apps read .env via `--env-file-if-exists=.env` (it can't ride
// NODE_OPTIONS), and the backend must load sentry-instrument.js via --import
// BEFORE express for Sentry's ESM auto-instrumentation (a no-op without
// SENTRY_DSN_BACKEND, so Sentry-less deployments can use this file unchanged).
// CommonJS on purpose: pm2 reads its config synchronously and the package is
// "type": "module", hence the .cjs extension.
module.exports = {
    apps: [
        {
            name: 'myip-backend',
            script: 'backend-server.js',
            cwd: __dirname,
            node_args: '--env-file-if-exists=.env --import ./sentry-instrument.js',
        },
        {
            name: 'myip-frontend',
            script: 'frontend-server.js',
            cwd: __dirname,
            node_args: '--env-file-if-exists=.env',
        },
    ],
};
