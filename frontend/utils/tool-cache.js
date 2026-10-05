// Tool-page cache policy: ToolPage keeps every visited tool alive in a
// KeepAlive, and a tool's state can hold one account's results (quota hints,
// signed-in test runs). When the signed-in account goes away — sign-out or a
// switch to another account — the cache is dropped so the next viewer never
// sees the previous account's results. A first sign-in keeps it: nothing in
// there belonged to anyone else.

export const shouldDropToolCache = (prevUid, nextUid) => Boolean(prevUid) && prevUid !== nextUid;
