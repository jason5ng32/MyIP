import Analytics from 'analytics';
import googleAnalytics from '@analytics/google-analytics';

const analyticsID = import.meta.env.VITE_GOOGLE_ANALYTICS_ID || '';

// Google Analytics 配置
const analytics = Analytics({
    app: 'MyIP',
    plugins: [
        googleAnalytics({
            measurementIds: [analyticsID],
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