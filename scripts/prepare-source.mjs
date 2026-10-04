import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function joinParts(prefix, output) {
  const dir = path.join(root, 'src', 'fragments')
  const parts = fs.readdirSync(dir).filter((name) => name.startsWith(prefix) && name.endsWith('.part')).sort()
  fs.writeFileSync(path.join(root, output), parts.map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join(''))
}

joinParts('app-', 'src/App.tsx')
joinParts('styles-', 'src/styles.css')
console.log('✓ generated src/App.tsx and src/styles.css from source fragments')
