import Analytics from 'analytics';
import googleAnalytics from '@analytics/google-analytics';

// Google Analytics 配置
const analytics = Analytics({
    app: 'MyIP',
    plugins: [
        googleAnalytics({
            measurementIds: ['G-TEYKKD81TL'],
        })
    ]
});

function trackEvent (category, action, label) {
    analytics.track(action, {
        category: category,
        label: label,
    });
}

export { analytics, trackEvent };