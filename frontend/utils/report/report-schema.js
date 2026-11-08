// Single source of truth is common/report-schema.js (shared with the
// backend, which runs the same validator on untrusted POST bodies). Thin
// re-export so front-end code keeps `@/utils/...` imports (same pattern as
// utils/ip/valid-ip.js).
export {
    REPORT_VERSION,
    REPORT_TTL_DAYS,
    REPORT_MAX_BYTES,
    REPORT_SECTION_IDS,
    CONNECTIVITY_STATUS,
    ANONYMITY_CODES,
    ABUSE_LEVELS,
    SCENARIO_FRICTION_IDS,
    SCENARIO_FRICTION_LEVELS,
    validateReport,
    maskIpTail,
    maskReportIps,
    stripLocalOnly,
    isMaskedIP,
} from '../../../common/report-schema.js';
