import { Firestore } from '@google-cloud/firestore'
import { readFileSync } from 'fs'

const db = new Firestore({ projectId: 'lostcity-screenshots' })

const ids: string[] = JSON.parse(readFileSync('/tmp/hidden-ids.json', 'utf-8'))
console.log(`Pushing ${ids.length} hidden IDs to prod Firestore...`)

for (let i = 0; i < ids.length; i += 500) {
  const chunk = ids.slice(i, i + 500)
  const batch = db.batch()
  for (const id of chunk) {
    batch.set(db.collection('hidden').doc(id), { hidden: true })
  }
  await batch.commit()
  console.log(`  Written ${Math.min(i + 500, ids.length)} / ${ids.length}`)
}

console.log('Done!')
process.exit(0)
