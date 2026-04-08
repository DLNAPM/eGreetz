
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { Greeting } from '../types';
import firebaseConfig from '../firebase-applet-config.json';

let app: FirebaseApp;
let db: any;
let storage: any;
let auth: any;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const initFirebase = () => {
  if (!app) {
    // Check if essential Firebase config is available
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error("Firebase configuration is missing essential values. Check your environment variables.");
      // Optionally, throw an error or handle gracefully
      return; 
    }
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    storage = getStorage(app);
    auth = getAuth(app);
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
    handleFirestoreError(e, OperationType.CREATE, 'greetings');
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
    handleFirestoreError(e, OperationType.LIST, 'greetings');
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
    handleFirestoreError(e, OperationType.GET, `greetings/${id}`);
    throw e;
  }
};

export const deleteGreeting = async (id: string): Promise<void> => {
  try {
    if (!db) throw new Error("Firestore not initialized.");
    await deleteDoc(doc(db, "greetings", id));
    console.log("Document successfully deleted!");
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `greetings/${id}`);
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