// Serialize lazy world-map renders. Hide skips new work but keeps a live
// chart on its canvas so a closing animation can finish; destroy when the
// canvas leaves or the scope is disposed.
import { ref, watch, onScopeDispose, toValue } from 'vue';
import { renderWorldMapChart } from '../utils/world-map-chart.js';

export const useWorldMapChart = ({ canvas, visible, options, theme }, { render = renderWorldMapChart } = {}) => {
    const ready = ref(false);
    const failed = ref(false);
    let chart = null;
    let queue = Promise.resolve();
    let generation = 0;
    let disposed = false;

    const destroy = () => {
        chart?.destroy();
        chart = null;
        ready.value = false;
    };

    watch([canvas, visible, options, () => toValue(theme)], () => {
        const current = ++generation;
        if (!toValue(canvas)) {
            failed.value = false;
            destroy();
            return;
        }
        if (!toValue(visible)) return;
        failed.value = false;
        queue = queue.then(async () => {
            const isActive = () => !disposed && current === generation;
            if (!isActive()) return;
            try {
                const next = await render({ ...toValue(options), canvas: toValue(canvas), chart, isActive });
                if (!isActive()) {
                    if (next && next !== chart) next.destroy();
                    return;
                }
                chart = next;
                ready.value = Boolean(chart);
                failed.value = !chart;
            } catch {
                if (isActive()) {
                    destroy();
                    failed.value = true;
                }
            }
        });
    }, { immediate: true, flush: 'post' });

    onScopeDispose(() => {
        disposed = true;
        generation += 1;
        destroy();
    });

    return { ready, failed };
};
