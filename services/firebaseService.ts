
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Greeting } from '../types';

// Firebase configuration using environment variables
// These variables must be defined in your .env file (Vite will pick them up if prefixed with VITE_)
// and set in your hosting environment (e.g., Render.com environment variables).
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let db;
let storage;

export const initFirebase = () => {
  if (!app) {
    // Check if essential Firebase config is available
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error("Firebase configuration is missing essential values. Check your environment variables.");
      // Optionally, throw an error or handle gracefully
      return; 
    }
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("Firebase initialized.");
  }
};

export const addGreeting = async (greeting: Omit<Greeting, 'id' | 'createdAt'>): Promise<Greeting> => {
  try {
    if (!db) throw new Error("Firestore not initialized.");
    const docRef = await addDoc(collection(db, "greetings"), {
      ...greeting,
      createdAt: serverTimestamp(),
    });
    console.log("Document written with ID: ", docRef.id);
    return { id: docRef.id, createdAt: Date.now(), ...greeting };
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};

export const getGreetings = async (): Promise<Greeting[]> => {
  try {
    if (!db) throw new Error("Firestore not initialized.");
    const q = query(collection(db, "greetings"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const greetings: Greeting[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      greetings.push({
        id: doc.id,
        occasion: data.occasion,
        message: data.message,
        imageUrl: data.imageUrl,
        audioUrl: data.audioUrl,
        videoUrl: data.videoUrl,
        voiceGender: data.voiceGender,
        voiceType: data.voiceType,
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(), // Convert Firestore Timestamp to JS Date ms
      });
    });
    return greetings;
  } catch (e) {
    console.error("Error getting documents: ", e);
    throw e;
  }
};

export const getGreetingById = async (id: string): Promise<Greeting | null> => {
  try {
    if (!db) throw new Error("Firestore not initialized.");
    const docRef = doc(db, "greetings", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        occasion: data.occasion,
        message: data.message,
        imageUrl: data.imageUrl,
        audioUrl: data.audioUrl,
        videoUrl: data.videoUrl,
        voiceGender: data.voiceGender,
        voiceType: data.voiceType,
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
      };
    } else {
      console.log("No such document!");
      return null;
    }
  } catch (e) {
    console.error("Error getting document by ID: ", e);
    throw e;
  }
};

export const deleteGreeting = async (id: string): Promise<void> => {
  try {
    if (!db) throw new Error("Firestore not initialized.");
    await deleteDoc(doc(db, "greetings", id));
    console.log("Document successfully deleted!");
  } catch (e) {
    console.error("Error removing document: ", e);
    throw e;
  }
};

export const uploadImage = async (file: File): Promise<string> => {
  try {
    if (!storage) throw new Error("Firebase Storage not initialized.");
    const storageRef = ref(storage, `images/${file.name}-${Date.now()}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (e) {
    console.error("Error uploading image: ", e);
    throw e;
  }
};