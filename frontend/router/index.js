import { createRouter, createWebHashHistory } from 'vue-router';

// 路由组件的懒加载
const MTRTest = () => import('../components/advanced-tools/mtr-test.vue');
const PingTest = () => import('../components/advanced-tools/global-latency.vue');
const RuleTest = () => import('../components/advanced-tools/rule-test.vue');
const DNSResolver = () => import('../components/advanced-tools/dns-resolver.vue');
const CensorshipCheck = () => import('../components/advanced-tools/censorship-check.vue');
const Whois = () => import('../components/advanced-tools/whois.vue');
const InvisibilityTest = () => import('../components/advanced-tools/invisibility-test.vue');
const EmptyComponent = () => import('../components/advanced-tools/empty.vue');

const routes = [
  { path: '/', component: EmptyComponent },
  { path: '/mtrtest', component: MTRTest },
  { path: '/pingtest', component: PingTest },
  { path: '/ruletest', component: RuleTest },
  { path: '/dnsresolver', component: DNSResolver },
  { path: '/censorshipcheck', component: CensorshipCheck },
  { path: '/whois', component: Whois },
  { path: '/invisibilitytest', component: InvisibilityTest },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
