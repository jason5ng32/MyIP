// Serialize lazy world-map renders and discard work after hide or scope disposal.
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
        failed.value = false;
        if (!toValue(visible) || !toValue(canvas)) {
            destroy();
            return;
        }
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
