// server/logger.js — shared pino logger for all backend code.
//
// LOG_LEVEL defaults to 'warn'; LOG_FORMAT=json switches off pino-pretty
// for log shippers. No NODE_ENV dependency.
//
// When SENTRY_DSN_BACKEND is set, the logMethod hook below mirrors log lines
// to Sentry (no official pino transport exists; the hook runs in-process and
// needs no extra dependency), split by severity to match the frontend's
// signal philosophy:
//   - warn+  → Sentry Logs (queryable stream, Explore → Logs)
//   - error+ → ALSO a Sentry Issue (grouped by the `err` stack when present,
//              alertable) — a caught-and-logged upstream failure is a signal,
//              not just a log line
// Without the DSN, @sentry/node is never loaded and the hook is not
// installed at all — the usual gating philosophy.
//
// ES module imports are hoisted, so backend-server.js's dotenv.config()
// runs after this file — we load .env ourselves here so LOG_LEVEL is
// honored. dotenv is idempotent; `quiet: true` avoids double banners.

import dotenv from 'dotenv';
import pino from 'pino';

dotenv.config({ quiet: true });

const useJson = process.env.LOG_FORMAT === 'json';

let sentry = null;
if (process.env.SENTRY_DSN_BACKEND) {
    sentry = await import('@sentry/node');
}

// Flatten a pino context object into Sentry log attributes, which must be
// primitives: Errors become message + stack strings, nested objects become
// JSON. Exported for tests.
export const flattenLogAttributes = (ctx) => {
    const attributes = {};
    for (const [key, value] of Object.entries(ctx)) {
        if (value instanceof Error) {
            attributes[`${key}.message`] = value.message;
            attributes[`${key}.stack`] = value.stack ?? '';
        } else if (typeof value === 'object' && value !== null) {
            try {
                attributes[key] = JSON.stringify(value);
            } catch {
                attributes[key] = String(value);
            }
        } else {
            attributes[key] = value;
        }
    }
    return attributes;
};

// pino numeric level → Sentry log level; anything below warn stays local.
const SENTRY_LOG_LEVELS = { 40: 'warn', 50: 'error', 60: 'fatal' };

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    ...(sentry ? {
        hooks: {
            // Mirror warn+ lines to Sentry Logs and elevate error+ to Issues,
            // then log normally. pino call shapes are (msg) or (ctx, msg).
            // Only enabled levels reach this hook, so LOG_LEVEL filtering
            // applies to Sentry too.
            logMethod(args, method, level) {
                const sentryLevel = SENTRY_LOG_LEVELS[level];
                if (sentryLevel) {
                    try {
                        const [first, second] = args;
                        const msg = String(typeof first === 'string' ? first : (second ?? ''));
                        const ctx = (typeof first === 'object' && first !== null) ? first : {};
                        const attributes = flattenLogAttributes(ctx);
                        sentry.logger[sentryLevel](msg, attributes);
                        if (level >= 50) {
                            // Group by the original throw site when an err
                            // object is attached (the logger.error({ err }...)
                            // convention); the log message rides along as a
                            // searchable tag.
                            const captureContext = {
                                level: sentryLevel,
                                tags: { log_message: msg },
                                extra: attributes,
                            };
                            if (ctx.err instanceof Error) {
                                sentry.captureException(ctx.err, captureContext);
                            } else {
                                sentry.captureMessage(msg, captureContext);
                            }
                        }
                    } catch {
                        // Telemetry must never break local logging.
                    }
                }
                return method.apply(this, args);
            },
        },
    } : {}),
    ...(useJson ? {} : {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                // SYS: = host-local time; 'standard' carries date + UTC offset
                // (same rendering as the MyIP-api repo's logger)
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                singleLine: true,
            },
        },
    }),
});

export default logger;
