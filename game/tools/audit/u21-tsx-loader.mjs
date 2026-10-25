// A1-U21 audit loader (read-only probe support): lets Node import the real
// render/MultiCameraRig.tsx. .tsx is transpiled by the repo's own esbuild;
// react / @react-three/fiber are stubbed because the probe only calls the
// pure exports (layerMaskFor, executePasses, constants), never the component.
import { transform } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const STUBS = {
  'react': 'export const useEffect = () => {};',
  '@react-three/fiber': 'export const useFrame = () => {}; export const useThree = () => ({});',
}

export async function resolve(specifier, context, next) {
  if (specifier in STUBS) return { url: 'data:text/javascript,' + encodeURIComponent(STUBS[specifier]), shortCircuit: true }
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    try { return await next(specifier + '.ts', context) } catch { /* fall through */ }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (url.endsWith('.tsx')) {
    const src = await readFile(fileURLToPath(url), 'utf8')
    const out = await transform(src, { loader: 'tsx', format: 'esm', jsx: 'automatic', target: 'es2022' })
    return { format: 'module', source: out.code, shortCircuit: true }
  }
  return next(url, context)
}