// Reusable choropleth world map on chartjs-chart-geo — shared by Earth
// Online (visitor shares) and any other per-country map (e.g. Global
// Latency). Owns the lazy loading of Chart.js + the geo plugin + the
// world-atlas topology (all cached module-wide), the alpha-2 →
// numeric-feature-id join, theme-token border/no-data colors, and the
// create-vs-update lifecycle. Callers keep the returned instance and
// destroy it when their canvas unmounts.
//
// renderWorldMapChart({
//   canvas,          — target <canvas> element
//   chart,           — previously returned instance (or null)
//   values,          — { 'US': number, ... } keyed by ISO alpha-2
//   lang,            — UI language for country names in tooltips
//   colorFrom/To,    — '#rrggbb' scale endpoints (low → high)
//   formatValue,     — (value|undefined, alpha2|undefined) => tooltip line(s)
//                      below the name; return a string array for multi-line
//   tooltipOnMissing — default true; false hides the tooltip entirely on
//                      countries that carry no value
//   uniformColor    — true uses the info token for every recorded country
//   selectedCountries — ISO alpha-2 codes to outline
//   onCountryClick  — optional callback, only called for countries with data
//   isActive        — optional guard checked after lazy loading
// }) → Promise<Chart|null>   (null on load failure or a stale render)
import { NUMERIC_TO_ALPHA2 } from '../data/country-numeric.js';
import getCountryName from '../data/country-name.js';

let chartCtor = null;
let worldFeatures = null;

// One-shot lazy loader; a failure leaves everything null so the caller's
// map area just stays empty — maps are decorative, never load-bearing.
// Memoized as a promise, not just by its result: a preload and the first
// real render overlap, and one download must serve both. A failed attempt
// clears the memo so a later render retries.
let modulesPromise = null;
const loadModules = () => {
    if (chartCtor) return Promise.resolve(true);
    if (!modulesPromise) {
        modulesPromise = (async () => {
            const [chartMod, geoMod, world] = await Promise.all([
                import('chart.js/auto').catch(() => null),
                import('chartjs-chart-geo').catch(() => null),
                import('world-atlas/countries-110m.json').catch(() => null),
            ]);
            if (!chartMod || !geoMod || !world) {
                modulesPromise = null;
                return false;
            }
            const { Chart, registerables } = chartMod;
            Chart.register(...registerables);
            Chart.register(geoMod.ChoroplethController, geoMod.GeoFeature, geoMod.ColorScale, geoMod.ProjectionScale);
            const topology = world.default ?? world;
            worldFeatures = geoMod.topojson.feature(topology, topology.objects.countries)
                .features.filter((f) => f.id !== '010'); // Antarctica — dead space
            chartCtor = Chart;
            return true;
        })();
    }
    return modulesPromise;
};

// Start the download without waiting for it — call this the moment a map is
// known to be coming (its panel opened), so the chunk travels in parallel
// with the data fetch that feeds the map instead of starting after it.
export const preloadWorldMapChart = () => {
    loadModules();
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Theme tokens resolved at draw time — canvas needs concrete colors.
const cssColor = (name, fallback) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
};

// Localized name for a feature; entities without an ISO id (a few Natural
// Earth disputed territories) fall back to their English name.
const featureName = (feature, lang) => {
    const alpha2 = NUMERIC_TO_ALPHA2[feature.id];
    return (alpha2 && getCountryName(alpha2, lang)) || feature.properties?.name || '';
};

// Static initial zoom — tune by eye with these two knobs:
//   projectionScale     zoom factor; higher = larger map, more edge cropping
//   projectionOffset    [x, y] pixel shift; negative x = map moves left,
//                       positive y = map moves down
// The auto-fit reserves room for the full sphere (including the Antarctica
// band we don't draw) and the un-drawn central Pacific, hence the overscale
// and the left/down shift. Interactive pan/zoom is NOT available for geo
// charts (chartjs-plugin-zoom only drives regular scales), so keep the zoom
// conservative — cropped areas are unreachable.
export const renderWorldMapChart = async ({
    canvas, chart, values, lang, colorFrom, colorTo, formatValue,
    tooltipOnMissing = true,
    projectionScale = 1.2, projectionOffset = [-18, 16],
    uniformColor = false, selectedCountries = [], onCountryClick,
    isActive = () => true,
}) => {
    if (!(await loadModules()) || !canvas) return chart ?? null;
    if (!isActive()) return null;

    const data = worldFeatures.map((feature) => ({
        feature,
        value: values[NUMERIC_TO_ALPHA2[feature.id]],
    }));

    // Selection changes the outline only; IPv6 churn cannot change fill weight.
    const selected = new Set(selectedCountries);
    const border = cssColor('--border', '#e5e7eb');
    const foreground = cssColor('--foreground', '#171717');
    const fill = cssColor('--info', '#0ea5e9');
    const missing = cssColor('--muted', '#f4f4f5');
    const dataset = {
        data,
        borderColor: data.map(({ feature }) => selected.has(NUMERIC_TO_ALPHA2[feature.id]) ? foreground : border),
        borderWidth: data.map(({ feature }) => selected.has(NUMERIC_TO_ALPHA2[feature.id]) ? 2 : 0.5),
        ...(uniformColor ? { backgroundColor: data.map(({ value }) => value === undefined ? missing : fill) } : {}),
    };
    const clickedCountry = (elements, instance) => {
        const hit = elements[0];
        const item = hit && instance.data.datasets[hit.datasetIndex]?.data[hit.index];
        return item?.value !== undefined ? NUMERIC_TO_ALPHA2[item.feature?.id] : undefined;
    };
    const onClick = onCountryClick ? (_event, elements, instance) => {
        const code = clickedCountry(elements, instance);
        if (code) onCountryClick(code);
    } : undefined;
    const onHover = onCountryClick ? (_event, elements, instance) => {
        instance.canvas.style.cursor = clickedCountry(elements, instance) ? 'pointer' : 'default';
    } : undefined;
    const tooltip = {
        displayColors: false,
        filter: tooltipOnMissing ? undefined : (item) => item.raw?.value !== undefined,
        callbacks: {
            title: (items) => (items[0]?.raw?.feature ? featureName(items[0].raw.feature, lang) : ''),
            label: (ctx) => formatValue(ctx.raw.value, NUMERIC_TO_ALPHA2[ctx.raw.feature?.id]),
        },
    };

    // A kept instance may point at an unmounted canvas (panels destroy their
    // content on close) — rebuild then; update in place otherwise.
    if (chart && chart.canvas !== canvas) {
        chart.destroy();
        chart = null;
    }
    if (chart) {
        chart.data.datasets[0] = dataset;
        chart.options.onClick = onClick;
        chart.options.onHover = onHover;
        chart.options.plugins.tooltip = tooltip;
        chart.options.scales.color.missing = missing;
        chart.canvas.style.cursor = 'default';
        chart.update();
        return chart;
    }

    const from = hexToRgb(colorFrom || '#0ea5e9');
    const to = hexToRgb(colorTo || '#0ea5e9');
    const interpolate = (v) => {
        const t = Math.min(1, Math.max(0, v));
        const mix = from.map((c, i) => Math.round(c + (to[i] - c) * t));
        return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
    };

    return new chartCtor(canvas, {
        type: 'choropleth',
        data: {
            datasets: [dataset],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            showOutline: false,
            showGraticule: false,
            onClick,
            onHover,
            plugins: {
                legend: { display: false },
                tooltip,
            },
            scales: {
                projection: {
                    axis: 'x',
                    projection: 'equalEarth',
                    projectionScale,
                    projectionOffset,
                },
                color: {
                    axis: 'x',
                    display: false,
                    min: 0,
                    interpolate,
                    missing,
                },
            },
        },
    });
};
