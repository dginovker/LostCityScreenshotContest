import { doc, setDoc, deleteDoc, getDocs, collection, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'

let hiddenIds: Set<string> | null = null

export async function loadHiddenIds(): Promise<Set<string>> {
  if (hiddenIds) return hiddenIds
  const snapshot = await getDocs(collection(db, 'hidden'))
  hiddenIds = new Set(snapshot.docs.map(d => d.id))
  return hiddenIds
}

export async function toggleHidden(imageId: string): Promise<boolean> {
  const set = await loadHiddenIds()
  const ref = doc(db, 'hidden', imageId)
  if (set.has(imageId)) {
    await deleteDoc(ref)
    set.delete(imageId)
    return false
  } else {
    await setDoc(ref, { hidden: true })
    set.add(imageId)
    return true
  }
}

export function isHidden(imageId: string): boolean {
  return hiddenIds?.has(imageId) ?? false
}

export async function hideMany(ids: string[]): Promise<void> {
  const set = await loadHiddenIds()
  // Firestore batches max 500 writes
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const batch = writeBatch(db)
    for (const id of chunk) {
      batch.set(doc(db, 'hidden', id), { hidden: true })
      set.add(id)
    }
    await batch.commit()
  }
}

export async function unhideMany(ids: string[]): Promise<void> {
  const set = await loadHiddenIds()
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const batch = writeBatch(db)
    for (const id of chunk) {
      batch.delete(doc(db, 'hidden', id))
      set.delete(id)
    }
    await batch.commit()
  }
}
