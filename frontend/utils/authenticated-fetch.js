import { useMainStore } from '../store';

export async function authenticatedFetch(url, method = 'GET', body = null) {
    const store = useMainStore();
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : null, // 如果提供了 body，则将其转换为 JSON 字符串
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