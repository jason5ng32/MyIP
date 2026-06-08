import { createRouter, createWebHashHistory } from 'vue-router';
import { useMainStore } from '@/store';
import { ADVANCED_TOOLS } from '@/data/tools.js';

// `/` renders an empty placeholder inside the drawer; every tool route renders
// its component there. Routes are derived from the shared tool registry
// (frontend/data/tools.js) so there's a single ordered list to maintain.
const EmptyComponent = () => import('@/components/advanced-tools/Empty.vue');

const routes = [
  { path: '/', component: EmptyComponent },
  ...ADVANCED_TOOLS.map((tool) => ({ path: `/${tool.slug}`, component: tool.component })),
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

router.afterEach((to) => {
  const store = useMainStore();


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
