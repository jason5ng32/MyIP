// Buffer speed-test samples independently of the asynchronously loaded charts.
import { ref, reactive } from 'vue';
import { getSpeedTestSampleCounts } from '../utils/speedtest-session.js';

// Extract Chart.js related configurations
const getChartConfig = (t) => ({
    download: {
        type: 'line',
        options: (gradient) => ({
            data: {
                labels: [],
                datasets: [{
                    label: t('speedtest.Download'),
                    data: [],
                    borderColor: '#0dcaf0',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.3
                }]
            }
        })
    },
    upload: {
        type: 'line',
        options: (gradient) => ({
            data: {
                labels: [],
                datasets: [{
                    label: t('speedtest.Upload'),
                    data: [],
                    borderColor: '#20c997',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.3
                }]
            }
        })
    },
    latency: {
        type: 'scatter',
        options: {
            data: {
                labels: [],
                datasets: [{
                    label: t('speedtest.Latency'),
                    data: [],
                    backgroundColor: 'rgba(255, 193, 7, 0.8)',
                    borderColor: '#ffc107',
                    borderWidth: 1,
                    pointRadius: 3,
                    pointHoverRadius: 3,
                    showLine: false,
                    pointStyle: 'circle'
                }]
            }
        }
    },
    jitter: {
        type: 'scatter',
        options: {
            data: {
                labels: [],
                datasets: [{
                    label: t('speedtest.Jitter'),
                    data: [],
                    backgroundColor: 'rgba(214, 51, 132, 0.8)',
                    borderColor: '#d63384',
                    borderWidth: 1,
                    pointRadius: 3,
                    pointHoverRadius: 3,
                    showLine: false,
                    pointStyle: 'circle'
                }]
            }
        }
    }
});

const useSpeedTestCharts = (t, {
    loadChart = () => import('chart.js/auto'),
    scheduleFrame = (callback) => requestAnimationFrame(callback),
    now = () => Date.now(),
} = {}) => {
    // Chart references
    const downloadChart = ref(null);
    const uploadChart = ref(null);
    const latencyChart = ref(null);
    const jitterChart = ref(null);

    let charts = {
        download: null,
        upload: null,
        latency: null,
        jitter: null
    };

    // Single-flight guard for the async initCharts (it awaits a dynamic
    // Chart.js import): rapid double-starts must share one init instead of
    // racing two `new Chart()` calls onto the same canvas.
    let chartInitInFlight = null;
    let generation = 0;
    let sampleCounts = new WeakMap();

    const chartData = reactive({
        download: {
            started: false,
            startTime: 0,
            labels: [],
            data: []
        },
        upload: {
            started: false,
            startTime: 0,
            labels: [],
            data: []
        },
        latency: {
            started: false,
            startTime: 0,
            labels: [],
            data: []
        },
        jitter: {
            started: false,
            startTime: 0,
            labels: [],
            data: []
        }
    });

    // Chart common configuration
    const getLineChartOptions = (yAxisLabel) => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 0
        },
        elements: {
            point: {
                radius: 0
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: yAxisLabel
                },
                grid: {
                    display: false
                },
                border: {
                    color: '#666666'
                },
                ticks: {
                    color: '#666666'
                }
            },
            x: {
                min: 0,
                display: true,
                grid: {
                    display: false
                },
                border: {
                    color: '#666666'
                },
                ticks: {
                    display: false,
                    color: '#666666'
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: false
            }
        },
        interaction: {
            mode: 'none'
        }
    });

    // Rendering consumes the buffer; it never owns or resets measurement data.
    const renderCharts = () => {
        Object.entries(charts).forEach(([type, chart]) => {
            if (!chart) return;
            const { labels, data } = chartData[type];
            chart.data.labels = [...labels];
            chart.data.datasets[0].data = type === 'download' || type === 'upload'
                ? [...data]
                : data.map((y, index) => ({ x: Number(labels[index]), y }));
            chart.options.scales.x.max = labels.length ? Number(labels.at(-1)) : 0;
            chart.update('none');
        });
    };

    // Initialize charts
    const initCharts = async () => {
        // Dynamically import Chart.js. On broken/blocked visitor networks
        // the chunk can fail or resolve null — bail and run chartless
        // (downstream already null-guards every charts.* access).
        const currentGeneration = generation;
        const mod = await loadChart().catch(() => null);
        if (currentGeneration !== generation || !mod?.Chart) return;
        const { Chart, registerables } = mod;
        Chart.register(...registerables);

        const config = getChartConfig(t);

        // Belt-and-suspenders: whatever instance is already bound to a
        // canvas (orphaned by any path), destroy it before creating anew —
        // Chart.js throws "Canvas is already in use" otherwise.
        [downloadChart, uploadChart, latencyChart, jitterChart].forEach((c) => {
            if (c.value) Chart.getChart(c.value)?.destroy();
        });

        // Initialize each chart
        if (downloadChart.value) {
            const ctx = downloadChart.value.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
            gradient.addColorStop(0, 'rgba(13, 202, 240, 0.6)');
            gradient.addColorStop(1, 'rgba(13, 202, 240, 0)');

            charts.download = new Chart(ctx, {
                type: config.download.type,
                ...config.download.options(gradient),
                options: getLineChartOptions(t('speedtest.Download') + ' (Mb/s)')
            });
        }

        if (uploadChart.value) {
            const ctx = uploadChart.value.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
            gradient.addColorStop(0, 'rgba(32, 201, 151, 0.6)');
            gradient.addColorStop(1, 'rgba(32, 201, 151, 0)');

            charts.upload = new Chart(ctx, {
                type: config.upload.type,
                ...config.upload.options(gradient),
                options: getLineChartOptions(t('speedtest.Upload') + ' (Mb/s)')
            });
        }

        if (latencyChart.value) {
            const ctx = latencyChart.value.getContext('2d');
            charts.latency = new Chart(ctx, {
                type: config.latency.type,
                ...config.latency.options,
                options: getLineChartOptions(t('speedtest.Latency') + ' (ms)')
            });
        }

        if (jitterChart.value) {
            const ctx = jitterChart.value.getContext('2d');
            charts.jitter = new Chart(ctx, {
                type: config.jitter.type,
                ...config.jitter.options,
                options: getLineChartOptions(t('speedtest.Jitter') + ' (ms)')
            });
        }
        renderCharts();
    };

    // Raw result identity separates preview samples from formal-test samples.
    // Completion events can contain new samples even when `finished` is true.
    const updateCharts = (downloadSpeed, uploadSpeed, latency, jitter, rawData) => {
        const counts = getSpeedTestSampleCounts(rawData);
        const seen = sampleCounts.get(rawData) || {};
        sampleCounts.set(rawData, seen);
        const values = { download: downloadSpeed, upload: uploadSpeed, latency, jitter };
        const currentTime = now();
        let changed = false;
        Object.entries(values).forEach(([type, value]) => {
            const count = counts[type === 'jitter' ? 'latency' : type];
            if (count < (type === 'jitter' ? 2 : 1) || count <= (seen[type] || 0)) return;
            if (!Number.isFinite(value) || value < 0) return;
            seen[type] = count;
            const series = chartData[type];
            if (!series.started) {
                series.started = true;
                series.startTime = currentTime;
            }
            series.labels.push(((currentTime - series.startTime) / 1000).toFixed(1));
            series.data.push(value);
            changed = true;
        });
        if (changed) {
            const currentGeneration = generation;
            scheduleFrame(() => {
                if (currentGeneration === generation) renderCharts();
            });
        }
    };

    const initStartingPoints = async () => {
        const currentTime = now();
        ['download', 'upload'].forEach(type => {
            const series = chartData[type];
            if (series.started) return;
            series.started = true;
            series.startTime = currentTime;
            series.labels = ['0.0'];
            series.data = [0];
        });
        if (!charts.download || !charts.upload) {
            if (!chartInitInFlight) {
                const pending = initCharts().finally(() => {
                    if (chartInitInFlight === pending) chartInitInFlight = null;
                });
                chartInitInFlight = pending;
            }
            await chartInitInFlight;
        }
    };

    // Clean up charts
    const destroyCharts = () => {
        generation += 1;
        chartInitInFlight = null;
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        charts = { download: null, upload: null, latency: null, jitter: null };
    };

    // Reset chart data
    const resetChartData = () => {
        sampleCounts = new WeakMap();
        ['download', 'upload', 'latency', 'jitter'].forEach(type => {
            chartData[type] = {
                started: false,
                startTime: 0,
                labels: [],
                data: []
            };
        });
    };

    return {
        downloadChart,
        uploadChart,
        latencyChart,
        jitterChart,
        charts,
        chartData,
        initCharts,
        updateCharts,
        initStartingPoints,
        destroyCharts,
        resetChartData
    };
};

export default useSpeedTestCharts;
