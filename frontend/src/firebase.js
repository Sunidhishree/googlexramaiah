// Firebase client config
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDLV6-DJTOqlxNv6Lc79LrM-kpwpLUGEpw",
    authDomain: "ritconnect-f4c31.firebaseapp.com",
    projectId: "ritconnect-f4c31",
    storageBucket: "ritconnect-f4c31.firebasestorage.app",
    messagingSenderId: "440809006695",
    appId: "1:440809006695:web:a6565823de9a4eb35716c2",
    measurementId: "G-K22HEHMNVK"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
    return signInWithPopup(auth, googleProvider);
}

export default app;
