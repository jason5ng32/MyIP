import { createRouter, createWebHashHistory } from 'vue-router';

// 路由组件的懒加载
const MTRTest = () => import('../components/mtrtest.vue');
const PingTest = () => import('../components/globallatency.vue');
const RuleTest = () => import('../components/ruletest.vue');
const DNSResolver = () => import('../components/dnsresolver.vue');
const EmptyComponent = () => import('../components/empty.vue');

const routes = [
  { path: '/', component: EmptyComponent },
  { path: '/mtrtest', component: MTRTest },
  { path: '/pingtest', component: PingTest },
  { path: '/ruletest', component: RuleTest },
  { path: '/dnsresolver', component: DNSResolver },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
