// Persona Check enums the evaluating API answers with: rendered by
// frontend/utils/persona (check-ids.js), whitelisted by the report builders
// and validated by common/report-schema.js.

// What a check concluded.
export const PERSONA_VERDICT = {
    MATCH: 'match',           // observed value fits the declared persona
    MISMATCH: 'mismatch',     // observed value contradicts the persona
    LEAK: 'leak',             // a channel exposed the real identity outright
    UNNATURAL: 'unnatural',   // internally inconsistent — reads as "being spoofed"
    UNKNOWN: 'unknown',       // the data is missing but obtainable — run the test
    NOT_APPLICABLE: 'not-applicable', // no conclusion is possible or needed here
};

// Which of the three questions a check answers.
export const PERSONA_AXIS = {
    MATCH: 'match',           // do I look like the target country?
    COHERENCE: 'coherence',   // does my browser contradict itself?
    LEAK: 'leak',             // is my real identity escaping?
};

export const PERSONA_GRADE = { A: 'A', B: 'B', C: 'C', D: 'D', UNKNOWN: 'unknown' };
