import { createApp } from 'vue'
import { createPinia } from 'pinia';
import { useMainStore } from './store';
import App from './App.vue'
import i18n from './locales/i18n';
import router from './router';
// refactor/01：Modal / Offcanvas / Toast / Tooltip 已替换为 shadcn-vue，
// 但 Dropdown / Collapse / Tab / ScrollSpy 仍在各组件用 data-bs-toggle 驱动，
// 所以暂时保留 `import 'bootstrap'` 以维持它们的行为。这些部件会在阶段 C
// 视觉层重写时一并迁移，届时该 import 与 bootstrap CSS 一起删除。
import 'bootstrap';
import { analytics } from './utils/use-analytics';
import { registerServiceWorker } from './utils/register-service-worker';

import { tooltip } from './directives/tooltip';
import { detectOS } from './utils/system-detect';
import './style/style.css'

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
const store = useMainStore(pinia); 

app.use(i18n);
app.use(router);

//
// 初始化一系列操作
//

// 在应用启动时设置语言
store.lang = i18n.global.locale;

// 检测操作系统
const os = detectOS();

// 窗口大小变化处理
function handleResize() {
    store.setIsMobile(window.innerWidth < 768 || os.isAndroid || os.isIOS );
}
handleResize();

// 监听窗口大小变化
window.addEventListener('resize', handleResize);

// 启动 Google Analytics
analytics.page();
app.config.globalProperties.$analytics = analytics;
registerServiceWorker();

// 注册全局事件跟踪函数，改造完程序后移除
app.config.globalProperties.$trackEvent = function (category, action, label) {
    analytics.track(action, {
        category: category,
        label: label,
    });
};

// 注册全局 v-tooltip 指令（refactor/01 阶段 B：原 Bootstrap Tooltip → 自实现轻量 tooltip）
app.directive('tooltip', tooltip);

// 检查 Firebase 环境
store.checkFirebaseEnv();

// 获取后端配置和用户偏好
Promise.all([
    store.isFireBaseSet ? store.initializeAuthListener() : Promise.resolve(),
    store.loadPreferences(), // 加载用户偏好设置
    store.fetchConfigs()      // 获取后端配置
]).then(() => {
    app.mount('#app');
}).catch(error => {
    console.error("Failed to initialize the app properly:", error);
    app.mount('#app'); // 即使初始化中存在错误，也继续挂载应用
});
