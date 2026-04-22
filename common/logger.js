// common/logger.js — shared pino logger for all backend code.
//
// LOG_LEVEL defaults to 'warn'; LOG_FORMAT=json switches off pino-pretty
// for log shippers. No NODE_ENV dependency.
//
// ES module imports are hoisted, so backend-server.js's dotenv.config()
// runs after this file — we load .env ourselves here so LOG_LEVEL is
// honored. dotenv is idempotent; `quiet: true` avoids double banners.

import dotenv from 'dotenv';
import pino from 'pino';

dotenv.config({ quiet: true });

const useJson = process.env.LOG_FORMAT === 'json';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    ...(useJson ? {} : {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss.l',
                ignore: 'pid,hostname',
                singleLine: true,
            },
        },
    }),
});

export default logger;
