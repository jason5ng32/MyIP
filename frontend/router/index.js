import { createRouter, createWebHistory } from 'vue-router';
import Home from '@/components/Home.vue';
import { resolveLegacyToolLink } from '@/utils/legacy-tool-link.js';
import { installPageTransitions } from '@/utils/page-transition.js';
import { installAnimationRevival } from '@/utils/revive-animations.js';

// Pages:
//   /              → the homepage (tests, sections, Advanced Tools cards).
//   /tools/:slug   → one Advanced Tool (shareable + crawlable). Every opener —
//                    cards, nav, shortcuts, in-app links — routes here.
//   /privacy       → the privacy policy.
//   /r/:id         → read-only shared diagnostic report (KV-backed, noindex).
//
// Home is imported eagerly (it's the default landing); everything else is
// lazy so it stays out of the homepage bundle.
const ToolPage = () => import('@/components/ToolPage.vue');
const PrivacyPolicy = () => import('@/components/PrivacyPolicy.vue');
const ReportPage = () => import('@/components/report/ReportPage.vue');

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/tools/:slug', name: 'tool', component: ToolPage },
  { path: '/privacy', name: 'privacy', component: PrivacyPolicy },
  { path: '/r/:id', name: 'report', component: ReportPage },
  // Unknown paths fall back to the homepage.
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // A query-only change on the same page (a tool writing back its `?q=`)
    // keeps the scroll; history steps restore it; new pages start at the top.
    if (to.path === from.path) return false;
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
});

// Legacy `/?tool=<slug>` links → /tools/<slug>, replacing the history entry.
router.beforeEach((to) => resolveLegacyToolLink(to) ?? undefined);

// Hooked here, not in a component, so they exist before the first navigation
// and outlive any page.
installPageTransitions(router);
installAnimationRevival(router);

export default router;
