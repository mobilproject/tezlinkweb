import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

// Configuration from Mobile App (FirebaseAuthService.cs / RideService.cs)
const firebaseConfig = {
  apiKey: "AIzaSyBoXPCzv9gvzTeDYusH5FiJ6qUx8tejqy4",
  authDomain: "fuzaliot.firebaseapp.com",
  databaseURL: "https://fuzaliot-default-rtdb.firebaseio.com",
  projectId: "fuzaliot",
  storageBucket: "fuzaliot.appspot.com",
  messagingSenderId: "383882081238", // Inferred or placeholder
  appId: "1:383882081238:web:placeholder" // Placeholder if not known
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const firestore = getFirestore(app);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup, GoogleAuthProvider };
export default app;
