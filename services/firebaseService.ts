
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Greeting } from '../types';

// TODO: Replace with your Firebase configuration
// You can get this from your Firebase project settings
const firebaseConfig = {
  apiKey: "AIzaSyDUXkZHySvB2S1aiLBXK5nW5aD9GNBQT7g",
  authDomain: "egreetz-d0846.firebaseapp.com",
  projectId: "egreetz-d0846",
  storageBucket: "egreetz-d0846.firebasestorage.app",
  messagingSenderId: "546450368214",
  appId: "1:546450368214:web:2e0827d27d3c0506174b77",
  measurementId: "G-MRV9FYGGEQ"
};

let app: FirebaseApp;
let db;
let storage;

export const initFirebase = () => {
  if (!app) {
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
