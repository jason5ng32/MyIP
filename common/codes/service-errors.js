// Error codes and auth reasons the deep tools' API routes answer with.

// `code` of a failed answer.
export const SERVICE_ERROR_CODE = Object.freeze({
    AUTH: 'auth',   // sign-in missing or rejected; see AUTH_REASON
    QUOTA: 'quota', // usage limit reached
});

// `reason` beside the auth code.
export const AUTH_REASON = Object.freeze({
    SIGN_IN_REQUIRED: 'sign_in_required',
    INVALID_TOKEN: 'invalid_token',
});
