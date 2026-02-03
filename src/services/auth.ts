import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase';

export const login = async (email: string, pass: string) => {
    return await signInWithEmailAndPassword(auth, email, pass);
};

export const signup = async (email: string, pass: string) => {
    return await createUserWithEmailAndPassword(auth, email, pass);
};

export const logout = async () => {
    return await signOut(auth);
};

export const getCurrentUser = (): User | null => {
    return auth.currentUser;
};

// Hook or listener helper
export const subscribeToAuth = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};
