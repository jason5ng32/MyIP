import { createRouter, createWebHistory } from 'vue-router';
import Home from '@/components/Home.vue';

// Real pages:
//   /              → the homepage. Advanced tools open as an in-page drawer,
//                    driven by the `?tool=<slug>` query (handled in Advanced.vue).
//   /tools/:slug   → a standalone full page for one tool (shareable + SEO).
//   /r/:id         → read-only shared diagnostic report (KV-backed, noindex).
// The tool pages render the SAME tool components as the drawer; only the
// wrapper differs.
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
    // Opening/closing the drawer only flips the query on the home route — don't
    // scroll the homepage in that case. Genuine page changes go to the top.
    if (to.path === from.path) return false;
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
});

export default router;
