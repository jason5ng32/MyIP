import { createRouter, createWebHashHistory } from 'vue-router';
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

// refactor/01：原实现通过 document.getElementById + Bootstrap Offcanvas.show/hide 操作 DOM，
// 现在改为设置 store.openSheet，由 Advanced.vue 的 <Sheet v-bind:open> 响应式渲染。
router.afterEach((to) => {
  const store = useMainStore();

  // 路由非工具页：关闭 tools sheet
  if (!routes.find(route => route.path === to.path)) {
    if (store.openSheet === 'tools') {
      store.setOpenSheet(null);
    }
    return;
  }

  store.setCurrentPath(to.path, setOpenedCard(to.path));

  if (to.path !== '/') {
    store.setOpenSheet('tools');
  } else if (store.openSheet === 'tools') {
    store.setOpenSheet(null);
  }
});


export default router;
