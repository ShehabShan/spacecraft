// Audit-only loader: resolve both TS and TSX extensionless imports.
// React hooks are not used by the pure exports exercised in this Node probe.
import { transform } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const stubs = {
  react: 'export const useEffect = () => {};',
  '@react-three/fiber': 'export const useFrame = () => {}; export const useThree = () => ({});',
};
export async function resolve(s,c,next) {
  if (s in stubs) return {url:'data:text/javascript,'+encodeURIComponent(stubs[s]),shortCircuit:true};
  if (s.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(s))
    for (const ext of ['.ts','.tsx']) { try { return await next(s+ext,c); } catch {} }
  return next(s,c);
}
export async function load(url,c,next) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const src=await readFile(fileURLToPath(url),'utf8');
    return {format:'module',source:(await transform(src,{loader:url.endsWith('.tsx')?'tsx':'ts',format:'esm',jsx:'automatic',target:'es2022'})).code,shortCircuit:true};
  }
  return next(url,c);
}