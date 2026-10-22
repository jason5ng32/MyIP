// Tool-page cache policy: cached tools can hold one account's results, so
// ToolPage drops them on sign-out or an account switch; a first sign-in
// keeps them, as nothing there belonged to anyone else.

export const shouldDropToolCache = (prevUid, nextUid) => Boolean(prevUid) && prevUid !== nextUid;
