import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCDRN-Oqui4ncjj8tKM_OVqJYK_Ktbzbus",
  authDomain: "stock-kaca.firebaseapp.com",
  projectId: "stock-kaca",
  storageBucket: "stock-kaca.firebasestorage.app",
  messagingSenderId: "23779438270",
  appId: "1:23779438270:web:712d3b06a970bbc103f8ef",
  measurementId: "G-4285JQH6WP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);