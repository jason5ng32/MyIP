// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

let auth;
// import.meta.env 只在 Vite 下存在；Node / 测试环境可能没有，用可选链兜底
const env = import.meta.env ?? {};
const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
};

const isFireBaseSet = !!firebaseConfig.apiKey && !!firebaseConfig.authDomain && !!firebaseConfig.projectId;

if (isFireBaseSet) {

const app = initializeApp(firebaseConfig);
auth = getAuth(app);

} else {
    auth = null;
}

export { auth };