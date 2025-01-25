import { useMainStore } from '../store';

export async function authenticatedFetch(url) {
    const store = useMainStore();
    const options = {
        method: 'GET',
        headers: {}
    };

    // 检查 URL 是否是需要认证的代理 API
    const isProxyApi = url.startsWith('/api/');

    if (isProxyApi && store.user) {
        const idToken = await store.user.getIdToken();
        options.headers.Authorization = `Bearer ${idToken}`;
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
}