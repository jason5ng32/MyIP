// Where the page breadcrumb's "Home" crumb goes: 'back' when vue-router's
// `history.state.back` is the homepage (stepping back restores the kept-alive
// page and its scroll), otherwise '/' (a push), so the crumb always lands home.

const HOME_PATH = '/';

export const resolveBackTarget = (historyState) => {
    const back = historyState?.back;
    if (typeof back !== 'string') return HOME_PATH;
    const path = back.split(/[?#]/, 1)[0];
    return path === HOME_PATH ? 'back' : HOME_PATH;
};
