// Where a page header's "back to home" button goes. vue-router keeps the
// previous in-app location in `history.state.back` (null when the page was
// opened directly, from a bookmark or another site). When that entry is the
// homepage, stepping back in history restores it as it was left — the kept-
// alive page and its scroll position; anything else (no in-app entry, or
// another page such as a different tool) pushes `/` so the button always
// lands where its label says.
//
//   resolveBackTarget(window.history.state) → 'back' | '/'

const HOME_PATH = '/';

export const resolveBackTarget = (historyState) => {
    const back = historyState?.back;
    if (typeof back !== 'string') return HOME_PATH;
    const path = back.split(/[?#]/, 1)[0];
    return path === HOME_PATH ? 'back' : HOME_PATH;
};
