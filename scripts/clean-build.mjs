import { rm, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8'),
)

const targets = [
  'dist',
  'dist-electron',
  path.join('release', packageJson.version),
]

await Promise.all(
  targets.map((target) =>
    rm(path.join(root, target), { recursive: true, force: true }),
  ),
)
