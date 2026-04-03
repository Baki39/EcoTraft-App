import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error("Error signing in with Google", error);
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup')) {
      alert("Google Sign-In popup was blocked. If you are using this as an Android app, you need to implement a native Google Sign-In plugin (e.g., @capacitor-community/google-sign-in).");
    } else if (error.code === 'auth/unauthorized-domain' || error.message?.includes('unauthorized-domain')) {
      alert(`Origin not allowed: This domain (${window.location.hostname}) is not authorized for Firebase Authentication. Please add it to the Authorized Domains in your Firebase Console (Authentication -> Settings -> Authorized domains).`);
    } else {
      alert(`Failed to sign in: ${error.message || "Unknown error"}. Please try again.`);
    }
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
