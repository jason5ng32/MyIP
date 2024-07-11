import { createRouter, createWebHashHistory } from 'vue-router';

// 路由组件的懒加载
const MTRTest = () => import('../components/advanced-tools/MtrTest.vue');
const PingTest = () => import('../components/advanced-tools/GlobalLatencyTest.vue');
const RuleTest = () => import('../components/advanced-tools/RuleTest.vue');
const DNSResolver = () => import('../components/advanced-tools/DnsResolver.vue');
const CensorshipCheck = () => import('../components/advanced-tools/CensorshipCheck.vue');
const Whois = () => import('../components/advanced-tools/Whois.vue');
const InvisibilityTest = () => import('../components/advanced-tools/InvisibilityTest.vue');
const MacChecker = () => import('../components/advanced-tools/MacChecker.vue');
const EmptyComponent = () => import('../components/advanced-tools/Empty.vue');

const routes = [
  { path: '/', component: EmptyComponent },
  { path: '/mtrtest', component: MTRTest },
  { path: '/pingtest', component: PingTest },
  { path: '/ruletest', component: RuleTest },
  { path: '/dnsresolver', component: DNSResolver },
  { path: '/censorshipcheck', component: CensorshipCheck },
  { path: '/whois', component: Whois },
  { path: '/invisibilitytest', component: InvisibilityTest },
  { path: '/macchecker', component: MacChecker },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
