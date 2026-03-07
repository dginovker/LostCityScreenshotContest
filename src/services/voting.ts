import { doc, getDoc, getDocs, writeBatch, increment, collection, addDoc, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

export interface ImageStats {
  wins: number
  comparisons: number
}

export async function recordVote(winnerId: string, loserId: string): Promise<void> {
  const batch = writeBatch(db)

  const winnerRef = doc(db, 'images', winnerId)
  batch.set(winnerRef, { wins: increment(1), comparisons: increment(1) }, { merge: true })

  const loserRef = doc(db, 'images', loserId)
  batch.set(loserRef, { comparisons: increment(1) }, { merge: true })

  await batch.commit()

  const userId = auth.currentUser?.uid
  if (userId) {
    await addDoc(collection(db, 'votes'), {
      userId,
      winnerId,
      loserId,
      timestamp: Timestamp.now(),
    })
  }
}

export async function getImageStats(imageId: string): Promise<ImageStats> {
  const ref = doc(db, 'images', imageId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { wins: 0, comparisons: 0 }
  const data = snap.data()
  return {
    wins: data.wins ?? 0,
    comparisons: data.comparisons ?? 0,
  }
}

export async function getImageStatsBatch(ids: string[]): Promise<ImageStats[]> {
  const results = await Promise.all(ids.map(id => getImageStats(id)))
  return results
}

export interface VoteRecord {
  winnerId: string
  loserId: string
  timestamp: Date
}

export async function getUserVotes(): Promise<VoteRecord[]> {
  const userId = auth.currentUser?.uid
  if (!userId) return []

  const q = query(
    collection(db, 'votes'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => {
    const data = d.data()
    return {
      winnerId: data.winnerId,
      loserId: data.loserId,
      timestamp: data.timestamp.toDate(),
    }
  })
}
