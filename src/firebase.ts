import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyAOekIEl6Nj88oFo6JJNgco6jfu2NIeM6U',
  authDomain: 'lostcity-screenshots.firebaseapp.com',
  projectId: 'lostcity-screenshots',
  storageBucket: 'lostcity-screenshots.firebasestorage.app',
  messagingSenderId: '349558405068',
  appId: '1:349558405068:web:39c678610f539794d28f69',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  console.log('Connected to Firebase Auth emulator')
  connectFirestoreEmulator(db, '127.0.0.1', 8081)
  console.log('Connected to Firestore emulator')
}
