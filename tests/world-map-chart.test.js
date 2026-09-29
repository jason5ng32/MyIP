// Exercise the map's country joins, interaction and updates without a browser.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { registerHooks } from 'node:module';

const created = [];
globalThis.__mapTestCharts = created;
globalThis.document = { documentElement: {} };
let theme = { '--info': '#38bdf8', '--border': '#eeeeee', '--foreground': '#111111', '--muted': '#f4f4f5' };
globalThis.getComputedStyle = () => ({ getPropertyValue: (key) => theme[key] || '' });
const stubs = {
    'chart.js/auto': `
        export const registerables = [];
        export class Chart {
            static register() {}
            constructor(canvas, config) {
                this.canvas = canvas; this.data = config.data; this.options = config.options;
                this.updates = 0; this.destroyed = false;
                globalThis.__mapTestCharts.push(this);
            }
            update() { this.updates += 1; }
            destroy() { this.destroyed = true; }
        }
    `,
    'chartjs-chart-geo': `
        export const ChoroplethController = {}, GeoFeature = {}, ColorScale = {}, ProjectionScale = {};
        export const topojson = { feature: () => ({ features: [
            { id: '840', properties: { name: 'United States' } },
            { id: '276', properties: { name: 'Germany' } },
            { id: '010', properties: { name: 'Antarctica' } },
        ] }) };
    `,
    'world-atlas/countries-110m.json': 'export default { objects: { countries: {} } };',
};
const hook = registerHooks({
    resolve(specifier, context, next) {
        if (stubs[specifier]) return { url: `map-test:${specifier}`, shortCircuit: true };
        return next(specifier, context);
    },
    load(url, context, next) {
        if (url.startsWith('map-test:')) return { format: 'module', source: stubs[url.slice(9)], shortCircuit: true };
        return next(url, context);
    },
});
after(() => {
    hook.deregister();
    delete globalThis.__mapTestCharts;
    delete globalThis.document;
    delete globalThis.getComputedStyle;
});

const { renderWorldMapChart } = await import('../frontend/utils/world-map-chart.js');
const options = () => ({
    canvas: { style: {} }, values: { US: 1 }, lang: 'en',
    colorFrom: '#000000', colorTo: '#ffffff', formatValue: (value) => `value:${value}`,
});

test('uniform countries ignore IP count, omit Antarctica and keep missing countries neutral', async () => {
    const chart = await renderWorldMapChart({ ...options(), uniformColor: true, values: { US: 1, DE: 99 } });
    assert.deepEqual(chart.data.datasets[0].backgroundColor, ['#38bdf8', '#38bdf8']);
    assert.equal(chart.data.datasets[0].data.length, 2);
    await renderWorldMapChart({ ...options(), canvas: chart.canvas, chart, uniformColor: true });
    assert.deepEqual(chart.data.datasets[0].backgroundColor, ['#38bdf8', '#f4f4f5']);
});

test('click and pointer feedback apply only to recorded countries', async () => {
    const selected = [];
    const chart = await renderWorldMapChart({ ...options(), onCountryClick: (code) => selected.push(code), tooltipOnMissing: false });
    const hit = (index) => [{ datasetIndex: 0, index }];
    chart.options.onClick({}, hit(0), chart);
    chart.options.onClick({}, hit(1), chart);
    chart.options.onClick({}, [], chart);
    assert.deepEqual(selected, ['US']);
    chart.options.onHover({}, hit(0), chart);
    assert.equal(chart.canvas.style.cursor, 'pointer');
    chart.options.onHover({}, hit(1), chart);
    assert.equal(chart.canvas.style.cursor, 'default');
    assert.equal(chart.options.plugins.tooltip.filter({ raw: { value: 1 } }), true);
    assert.equal(chart.options.plugins.tooltip.filter({ raw: {} }), false);
});

test('an update refreshes selection, theme, language and click callbacks on the same chart', async () => {
    const chart = await renderWorldMapChart({ ...options(), uniformColor: true, selectedCountries: ['US'] });
    assert.deepEqual(chart.data.datasets[0].borderWidth, [2, 0.5]);
    theme = { ...theme, '--info': '#7dd3fc', '--foreground': '#ffffff' };
    const clicks = [];
    const updated = await renderWorldMapChart({
        ...options(), canvas: chart.canvas, chart, uniformColor: true, values: { DE: 1 },
        selectedCountries: ['DE'], lang: 'de', formatValue: () => 'updated',
        onCountryClick: (code) => clicks.push(code),
    });
    assert.equal(updated, chart);
    assert.deepEqual(chart.data.datasets[0].borderWidth, [0.5, 2]);
    assert.equal(chart.data.datasets[0].borderColor[1], '#ffffff');
    assert.equal(chart.data.datasets[0].backgroundColor[1], '#7dd3fc');
    const tooltip = chart.options.plugins.tooltip.callbacks;
    assert.equal(tooltip.title([{ raw: { feature: { id: '276' } } }]), 'Deutschland');
    assert.equal(tooltip.label({ raw: { value: 1, feature: { id: '276' } } }), 'updated');
    chart.options.onClick({}, [{ datasetIndex: 0, index: 1 }], chart);
    assert.deepEqual(clicks, ['DE']);
});

test('heatmap callers retain the gradient and no click behavior', async () => {
    const chart = await renderWorldMapChart(options());
    assert.equal(chart.data.datasets[0].backgroundColor, undefined);
    assert.equal(chart.options.scales.color.interpolate(0), 'rgb(0, 0, 0)');
    assert.equal(chart.options.scales.color.interpolate(1), 'rgb(255, 255, 255)');
    assert.equal(chart.options.onClick, undefined);
    assert.equal(chart.options.onHover, undefined);
});

test('a stale lazy render does not construct a chart, and canvas replacement destroys the old one', async () => {
    const count = created.length;
    assert.equal(await renderWorldMapChart({ ...options(), isActive: () => false }), null);
    assert.equal(created.length, count);
    const chart = await renderWorldMapChart(options());
    const replacement = await renderWorldMapChart({ ...options(), chart });
    assert.notEqual(replacement, chart);
    assert.equal(chart.destroyed, true);
});
