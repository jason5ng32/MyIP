import { useMainStore } from '../store';

export async function authenticatedFetch(url, method = 'GET', body = null) {
    const store = useMainStore();
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : null, // If body is provided, convert it to a JSON string
    };

    // Check if the URL is a proxy API that needs authentication
    const isProxyApi = url.startsWith('/api/');

    if (isProxyApi && store.user) {
        const idToken = await store.user.getIdToken();
        options.headers.Authorization = `Bearer ${idToken}`;
    }

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            let errorDetail = '';
            try {
                // Get specific error information
                const errorData = await response.json();
                errorDetail = errorData.message || JSON.stringify(errorData);
            } catch {
                errorDetail = response.statusText;
            }
            throw new Error(`HTTP error! Status: ${response.status} - ${errorDetail}`);
        }

        return response.json();
    } catch (error) {
        throw new Error(`Fetch failed: ${error.message}`);
    }
}