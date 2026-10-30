// Footer garland geometry (pure): a cord sagging in equal scallops across the
// footer's width, one hang point at each scallop's low point. Rendered by
// components/festival/Garland.vue; each skin's FooterTrim draws the pieces.

export const GARLAND_DEFAULTS = { spacing: 56, sag: 7, top: 2 };

// Enough scallops to cover `width`; the last may run past it (clipped).
export const garlandLayout = (width, { spacing, sag, top } = GARLAND_DEFAULTS) => {
    const count = Math.max(1, Math.ceil(width / spacing));
    const points = [];
    let path = `M0 ${top}`;
    for (let i = 0; i < count; i += 1) {
        const x0 = i * spacing;
        path += ` Q${x0 + spacing / 2} ${top + sag * 2} ${x0 + spacing} ${top}`;
        points.push({ i, x: x0 + spacing / 2, y: top + sag });
    }
    return { path, points };
};

// A point on scallop i at t ∈ [0, 1], with the cord's angle there (degrees).
export const scallopPoint = (i, t, { spacing, sag, top } = GARLAND_DEFAULTS) => {
    const x0 = i * spacing;
    const cx = x0 + spacing / 2;
    const cy = top + sag * 2;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * (x0 + spacing);
    const y = u * u * top + 2 * u * t * cy + t * t * top;
    const dx = 2 * u * (cx - x0) + 2 * t * (x0 + spacing - cx);
    const dy = 2 * u * (cy - top) + 2 * t * (top - cy);
    return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
};

// Per-piece variety: cycle each trait over its own short list; coprime
// lengths (3, 4, 5…) multiply into a period no screen is wide enough to show.
export const cycle = (list, i) => list[i % list.length];
