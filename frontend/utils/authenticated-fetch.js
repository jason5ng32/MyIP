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

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            let errorDetail = '';
            try {
                // 获得具体的错误信息
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
