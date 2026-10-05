import { createRouter, createWebHistory } from 'vue-router';
import Home from '@/components/Home.vue';
import { resolveLegacyToolLink } from '@/utils/legacy-tool-link.js';
import { installPageTransitions } from '@/utils/page-transition.js';

// Pages:
//   /              → the homepage (tests, sections, Advanced Tools cards).
//   /tools/:slug   → one Advanced Tool (shareable + crawlable). Every opener —
//                    cards, nav, shortcuts, in-app links — routes here.
//   /privacy       → the privacy policy.
//   /r/:id         → read-only shared diagnostic report (KV-backed, noindex).
// App.vue keeps the homepage and the tool page alive across navigation, so
// back / forward between them is plain history that restores both as left.
// The drawer-era `/?tool=<slug>` links redirect to /tools/<slug>
// (utils/legacy-tool-link.js). Page changes slide / fade as View Transitions
// (utils/page-transition.js).
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

// `/?tool=<slug>` → /tools/<slug> (or `/` for an unknown slug); a page load
// replaces the entry, so the legacy URL leaves no trace in history. null lets
// every other navigation through.
router.beforeEach((to) => resolveLegacyToolLink(to) ?? undefined);

// Page changes animate as View Transitions (utils/page-transition.js). Hooked
// here, not in a component, so the guards exist before the first navigation
// and outlive any page.
installPageTransitions(router);

export default router;
