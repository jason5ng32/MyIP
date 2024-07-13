addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

// Change the allowed domains here
const allowedDomains = [
    'ipcheck.ing',
    'www.ipcheck.ing',
];

async function handleRequest(request) {
    const origin = request.headers.get("Origin");
    const originHostname = new URL(origin).hostname;

    if (!allowedDomains.includes(originHostname)) {
        return new Response("Access Denied", { status: 403 });
    }

    // Reverse proxy the request to the target server
    const url = new URL(request.url);
    const targetUrl = `https://speed.cloudflare.com${url.pathname}${url.search}`;

    // Copy the request headers
    const init = {
        method: request.method,
        headers: new Headers(request.headers),
    };

    // Remove the Origin header to prevent CORS errors
    init.headers.delete("Origin");

    // Send the request to the target server
    try {
        const response = await fetch(targetUrl, init);

        // Set the Access-Control-Allow-Origin header
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization');

        // Send the response
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
