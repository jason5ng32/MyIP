let googleAnalyticsId;

try {
  // Read the environment variable
  googleAnalyticsId = process.env.VUE_APP_GOOGLE_ANALYTICS_ID || 'GA-ID-Here';
} catch (e) {
  // If it's not defined, use the default value
  googleAnalyticsId = 'GA-ID-Here';
}

const config = {
  GOOGLE_ANALYTICS_ID: googleAnalyticsId
};

export default config;
