import { ref, reactive } from 'vue';

// 将 Chart.js 相关的配置抽离出来
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

export default function useSpeedTestCharts(t) {
    // 图表引用
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

    // 图表通用配置
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

    // 初始化图表
    const initCharts = async () => {
        // 动态导入 Chart.js
        const { Chart, registerables } = await import('chart.js/auto');
        Chart.register(...registerables);

        const config = getChartConfig(t);

        // 初始化每个图表
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
    };

    // 更新图表
    const updateCharts = (downloadSpeed, uploadSpeed, latency, jitter, rawData) => {
        if (!charts.download || !charts.upload || !charts.latency || !charts.jitter) return;

        try {
            const currentTime = Date.now();

            const updateSingleChart = (type, value, started) => {
                if (type === 'download' || type === 'upload') {
                    if (value > 0 && started && !rawData[type]?.finished) {
                        if (!chartData[type].started) {
                            chartData[type].started = true;
                            chartData[type].startTime = currentTime;
                        }

                        const relativeTime = (currentTime - chartData[type].startTime) / 1000;
                        const newLabel = relativeTime.toFixed(1);

                        chartData[type].labels.push(newLabel);
                        chartData[type].data.push(value);

                        charts[type].data.labels = [...chartData[type].labels];
                        charts[type].data.datasets[0].data = [...chartData[type].data];

                        const maxTime = Math.max(...chartData[type].labels.map(Number));
                        charts[type].options.scales.x.max = maxTime;
                    }
                } else if (value >= 0 && started) {
                    if (!chartData[type].started) {
                        chartData[type].started = true;
                        chartData[type].startTime = currentTime;
                    }

                    if ((type === 'latency' && !rawData.latency?.finished) ||
                        (type === 'jitter' && !rawData.latency?.finished)) {

                        const relativeTime = (currentTime - chartData[type].startTime) / 1000;
                        const newLabel = relativeTime.toFixed(1);
                        const newData = parseFloat(value.toFixed(2));

                        chartData[type].labels.push(newLabel);
                        chartData[type].data.push(newData);

                        const scatterData = chartData[type].data.map((value, index) => ({
                            x: parseFloat(chartData[type].labels[index]),
                            y: value
                        }));
                        charts[type].data.datasets[0].data = scatterData;

                        const maxTime = Math.max(...chartData[type].labels.map(Number));
                        charts[type].options.scales.x.max = maxTime;
                    }
                }
            };

            updateSingleChart('latency', latency, rawData.latency?.started);
            updateSingleChart('jitter', jitter, rawData.latency?.started);
            updateSingleChart('download', downloadSpeed, rawData.download?.started);
            updateSingleChart('upload', uploadSpeed, rawData.upload?.started);

            requestAnimationFrame(() => {
                Object.values(charts).forEach(chart => {
                    if (chart) {
                        chart.update('none');
                    }
                });
            });

        } catch (error) {
            console.error('Error updating charts:', error);
        }
    };

    // 初始化图表的起始点
    const initStartingPoints = async () => {
        // 确保图表已经初始化
        if (!charts.download || !charts.upload) {
            await initCharts();
        }

        const currentTime = Date.now();
        ['download', 'upload'].forEach(type => {
            if (charts[type]) {  // 添加额外检查
                chartData[type].started = true;
                chartData[type].startTime = currentTime;
                chartData[type].labels = ['0.0'];
                chartData[type].data = [0];

                charts[type].data.labels = ['0.0'];
                charts[type].data.datasets[0].data = [0];
                charts[type].options.scales.x.max = 0;
                charts[type].update('none');
            }
        });
    };

    // 清理图表
    const destroyCharts = () => {
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        charts = { download: null, upload: null, latency: null, jitter: null };
    };

    // 重置图表数据
    const resetChartData = () => {
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
} 