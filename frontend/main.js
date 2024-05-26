import { createApp } from 'vue'
import { createPinia } from 'pinia';
import { useMainStore } from './store';
import App from './App.vue'
import i18n from './locales/i18n';
import router from './router';
import 'bootstrap';
import { analytics } from './utils/use-analytics';

import { Tooltip } from 'bootstrap';
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

// 注册全局事件跟踪函数，改造完程序后移除
app.config.globalProperties.$trackEvent = function (category, action, label) {
    analytics.track(action, {
        category: category,
        label: label,
    });
};

// 注册全局 Tooltip 指令
app.directive('tooltip', {
    mounted(el, binding) {
        const isMobile = store.isMobile
        if (isMobile) {
            return
        }
        let options = {
            placement: 'left',
            trigger: 'hover focus',
        }
        // 如果 binding.value 是一个字符串，将其设置为 title
        // 否则，如果是一个对象，将其与默认配置合并
        if (typeof binding.value === 'string') {
            options.title = binding.value
        } else if (typeof binding.value === 'object') {
            options = { ...options, ...binding.value } // 合并对象
        }

        new Tooltip(el, options)
    },
    beforeUnmount(el) {
        const tooltipInstance = Tooltip.getInstance(el)
        if (tooltipInstance) {
            tooltipInstance.dispose()
        }
    }
})

// 获取后端配置和用户偏好
Promise.all([
    store.loadPreferences(), // 加载用户偏好设置
    store.fetchConfigs()      // 获取后端配置
]).then(() => {
    app.mount('#app');
}).catch(error => {
    console.error("Failed to initialize the app properly:", error);
    app.mount('#app'); // 即使初始化中存在错误，也继续挂载应用
});
