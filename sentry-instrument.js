// Sentry bootstrap for the Express backend. Loaded via `node --import` (see
// the dev / start scripts in package.json) so the SDK registers its ESM
// loader hooks BEFORE express & co. load — that's what makes automatic
// per-route tracing work.
//
// Gated on SENTRY_DSN_BACKEND, same philosophy as the frontend: when the env
// var is unset this module does nothing and @sentry/node is never even
// loaded. SENTRY_ENVIRONMENT=development skips init too, so a local run never
// reports. backend-server.js attaches the matching Express error handler.
import dotenv from 'dotenv';

import { scrubBreadcrumb, scrubEventRequest, scrubSpan } from './common/sentry-scrub.js';

dotenv.config({ quiet: true });

// SENTRY_ENVIRONMENT=development (a local `pnpm dev` machine) skips init:
// experiments in progress are not production signal, same rule as the cron
// check-ins in common/sentry-cron.js.
if (process.env.SENTRY_DSN_BACKEND && process.env.SENTRY_ENVIRONMENT !== 'development') {
    const Sentry = await import('@sentry/node');
    Sentry.init({
        dsn: process.env.SENTRY_DSN_BACKEND,
        environment: process.env.SENTRY_ENVIRONMENT || 'production',
        // 100% trace sampling (per-route latency / throughput / error rate under Insights)
        tracesSampleRate: 1.0,
        // Sentry Logs — receives warn/error/fatal lines forwarded by the
        // logMethod hook in common/logger.js
        enableLogs: true,
        // Never attach caller IPs / headers to events (privacy tool)
        sendDefaultPii: false,
        // Upstream query strings carry API keys — redact those params in
        // breadcrumbs, spans, and request contexts (the rest of the query
        // stays: it's debugging context).
        beforeBreadcrumb: scrubBreadcrumb,
        beforeSendSpan: scrubSpan,
        beforeSend: scrubEventRequest,
        beforeSendTransaction: scrubEventRequest,
    });
}
