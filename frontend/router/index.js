import { createRouter, createWebHashHistory } from 'vue-router';
import { Offcanvas } from 'bootstrap';
import { useMainStore } from '@/store';

// 路由组件的懒加载
const MTRTest = () => import('../components/advanced-tools/MtrTest.vue');
const PingTest = () => import('../components/advanced-tools/GlobalLatencyTest.vue');
const RuleTest = () => import('../components/advanced-tools/RuleTest.vue');
const DNSResolver = () => import('../components/advanced-tools/DnsResolver.vue');
const CensorshipCheck = () => import('../components/advanced-tools/CensorshipCheck.vue');
const Whois = () => import('../components/advanced-tools/Whois.vue');
const InvisibilityTest = () => import('../components/advanced-tools/InvisibilityTest.vue');
const MacChecker = () => import('../components/advanced-tools/MacChecker.vue');
const BrowserInfo = () => import('../components/advanced-tools/BrowserInfo.vue');
const Checklist = () => import('../components/advanced-tools/SecurityChecklist.vue');
const EmptyComponent = () => import('../components/advanced-tools/Empty.vue');

const routes = [
  { path: '/', component: EmptyComponent },
  { path: '/pingtest', component: PingTest },
  { path: '/mtrtest', component: MTRTest },
  { path: '/ruletest', component: RuleTest },
  { path: '/dnsresolver', component: DNSResolver },
  { path: '/censorshipcheck', component: CensorshipCheck },
  { path: '/whois', component: Whois },
  { path: '/macchecker', component: MacChecker },
  { path: '/browserinfo', component: BrowserInfo },
  { path: '/securitychecklist', component: Checklist },
  { path: '/invisibilitytest', component: InvisibilityTest },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const setOpenedCard = (currentPath) => {
  for (let i = 0; i < routes.length; i++) {
    if (currentPath === routes[i].path) {
      return i - 1;
    }
  }
};

// 检查是否为需要触发 offcanvas 的路由
router.afterEach((to, from) => {
  // 如果 to.path 不匹配 routes，隐藏可能存在的 offcanvas
  if (!routes.find(route => route.path === to.path)) {
    const offcanvasElement = document.getElementById('offcanvasTools');
    if (offcanvasElement) {
      const bsOffcanvas = Offcanvas.getInstance(offcanvasElement);
      bsOffcanvas.hide();
    }
    return;
  }

  const store = useMainStore();
  store.setCurrentPath(to.path, setOpenedCard(to.path));
  if (to.path !== '/') {
    const offcanvasElement = document.getElementById('offcanvasTools');
    if (offcanvasElement) {
      const bsOffcanvas = new Offcanvas(offcanvasElement);
      bsOffcanvas.show();
    }
  }
});


export default router;
