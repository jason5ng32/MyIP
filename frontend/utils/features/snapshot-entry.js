// Snapshots entry points: the pure layer behind the ways into the Snapshots
// tool from elsewhere in the app — the tool's path for the dock button, and
// the label-card preference as the Preferences picker shows and stores it.

export const SNAPSHOTS_TOOL_PATH = '/tools/snapshots';

// A stored label card → a 1-based IP card position within `cardCount`;
// anything invalid or out of range is card 1.
export const clampLabelCard = (value, cardCount) => {
    const max = Number.isInteger(cardCount) && cardCount > 0 ? cardCount : 1;
    return Number.isInteger(value) && value >= 1 && value <= max ? value : 1;
};
