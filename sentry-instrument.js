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

import { scrubBreadcrumb, scrubEventRequest, scrubSpan } from './server/sentry-scrub.js';

dotenv.config({ quiet: true });

// SENTRY_ENVIRONMENT=development (a local `pnpm dev` machine) skips init:
// experiments in progress are not production signal, same rule as the cron
// check-ins in server/sentry-cron.js.
if (process.env.SENTRY_DSN_BACKEND && process.env.SENTRY_ENVIRONMENT !== 'development') {
    const Sentry = await import('@sentry/node');
    Sentry.init({
        dsn: process.env.SENTRY_DSN_BACKEND,
        environment: process.env.SENTRY_ENVIRONMENT || 'production',
        // 100% trace sampling (per-route latency / throughput / error rate under Insights)
        tracesSampleRate: 1.0,
        // Sentry Logs need no switch: the logMethod hook in server/logger.js
        // forwards warn/error/fatal lines on its own.
        // Never attach caller IPs, headers, cookies or bodies to events
        // (privacy tool). The SDK collects all of them unless each category
        // is switched off here; query strings stay and are redacted below.
        dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
        },
        // Upstream query strings carry API keys — redact those params in
        // breadcrumbs, spans, and request contexts (the rest of the query
        // stays: it's debugging context).
        beforeBreadcrumb: scrubBreadcrumb,
        beforeSendSpan: scrubSpan,
        beforeSend: scrubEventRequest,
        beforeSendTransaction: scrubEventRequest,
    });
}
