import { isValidIP } from '@/utils/valid-ip.js';

// 从 Alicdn 获取 IP 地址
const getIPFromAliCDN = () => {
    return new Promise((resolve, reject) => {
        // 动态创建 script 标签发起 JSONP 请求
        let script = document.createElement("script");
        script.src = "https://tbip.alicdn.com/api/queryip?callback=ipCallback";
        document.head.appendChild(script);

        // 设置超时拒绝 Promise，以防万一请求挂起
        const timeoutId = setTimeout(() => {
            console.error("Request to AliCDN timed out");
            document.head.removeChild(script);
            delete window.ipCallback;
            reject(new Error("Request to AliCDN timed out"));
        }, 2000);

        // 设置成功获取数据的回调
        window.ipCallback = (data) => {
            clearTimeout(timeoutId); // 取消超时定时器
            try {
                let ip = data.data.ip;
                let source = "AliCDN";
                document.head.removeChild(script);
                delete window.ipCallback;
                if (isValidIP(ip)) {
                    resolve({ ip, source });
                } else {
                    console.error("Invalid IP from AliCDN:", ip);
                    resolve({ ip: null, source: "AliCDN" });
                }
            } catch (error) {
                console.error("Error processing IP data from AliCDN:", error);
                document.head.removeChild(script);
                delete window.ipCallback;
                resolve({ ip: null, source: "AliCDN" });
            }
        };

        // 设置加载错误处理
        script.onerror = () => {
            clearTimeout(timeoutId); // 取消超时定时器
            console.error("Error loading script for IP data from AliCDN");
            document.head.removeChild(script);
            delete window.ipCallback;
            resolve({ ip: null, source: "AliCDN" });
        };
    });
};

export { getIPFromAliCDN };