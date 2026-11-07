// server/listen-callback.js — the callback handed to app.listen(). Express 5
// calls it with the listen error too (e.g. EADDRINUSE), so a failed bind logs
// the cause and exits non-zero instead of announcing a server that isn't there.

export const createListenCallback = ({ port, logger, exit = process.exit }) => (err) => {
    if (err) {
        const message = err.code === 'EADDRINUSE'
            ? `❌ Backend failed to listen: port ${port} is already in use (EADDRINUSE) — stop the process holding it or set another port`
            : '❌ Backend failed to listen';
        logger.error({ err, port }, message);
        exit(1);
        return;
    }
    logger.info(`🚀 Backend server ready on http://localhost:${port}`);
};
