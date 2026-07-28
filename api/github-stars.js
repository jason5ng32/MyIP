// /api/github-stars — stargazer count for this repo, fetched from GitHub's
// public REST API without a token (`stargazers_count` is available
// unauthenticated). Edge-cached for a day (see backend-server.js), so behind
// Cloudflare the origin hits GitHub at most once per cache window — well under
// the 60 req/hour unauthenticated limit.
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

// The project's own repository. GitHub requires a User-Agent on every
// request; fetchUpstream's default project UA satisfies that.
const REPO = 'jason5ng32/MyIP';

export default async (req, res) => {
    // Defensive; app.get() in backend-server.js already gates method, but a
    // dedicated smoke test asserts this branch directly against the handler.
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const apiRes = await fetchUpstream(`https://api.github.com/repos/${REPO}`, {
            headers: {
                'Accept': 'application/vnd.github+json',
            },
        });
        if (!apiRes.ok) {
            throw new Error(`GitHub API responded ${apiRes.status}`);
        }
        const data = await apiRes.json();
        res.json({ stars: data.stargazers_count ?? 0 });
    } catch (error) {
        logger.error({ err: error }, 'github-stars handler failed');
        res.status(500).json({ error: 'Failed to fetch GitHub stars' });
    }
};
