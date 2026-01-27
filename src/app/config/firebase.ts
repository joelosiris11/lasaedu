// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  // This will be replaced with actual config
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "http://127.0.0.1:9000/?ns=demo-project-default-rtdb",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abc123"
};

// Check if we should use emulators
const USE_EMULATOR = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' || 
                     import.meta.env.DEV; // Auto-enable in development

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Realtime Database
export const database = getDatabase(app);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Connect to emulators if enabled
if (USE_EMULATOR) {
  try {
    // Connect to Database Emulator
    connectDatabaseEmulator(database, '127.0.0.1', 9000);
    console.log('🔧 Connected to Firebase Database Emulator');
    
    // Connect to Firestore Emulator
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.log('🔧 Connected to Firestore Emulator');
    
    // Connect to Storage Emulator
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    console.log('🔧 Connected to Firebase Storage Emulator');
  } catch (error) {
    // Already connected or emulator not running
    console.log('Firebase emulator connection:', error);
  }
}

export const isUsingEmulator = USE_EMULATOR;

export default app;