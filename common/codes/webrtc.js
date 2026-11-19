// WebRTC NAT type codes: recorded by WebRtcTest.vue per STUN server,
// whitelisted by the report builders and validated by common/report-schema.js.

// ICE candidate types read off a candidate line.
export const ICE_CANDIDATE_TYPES = ['host', 'srflx', 'prflx', 'relay'];

// Every recorded code: a candidate type, an unrecognized one, or a failed test.
export const NAT_TYPE_CODES = [...ICE_CANDIDATE_TYPES, 'unknown', 'unavailable', 'error'];
