/** Audit-only TS/TSX loader. Real React exports are needed by zustand imports;
 * no hooks or DOM mount are executed by the headless playFrame fixture. */
import {transform} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export async function resolve(s,c,next){
 if(s.startsWith('.')&&!/\.[cm]?[jt]sx?$/.test(s))
  for(const ext of ['.ts','.tsx'])try{return await next(s+ext,c)}catch{}
 return next(s,c);
}
export async function load(url,c,next){
 if(/\.tsx?$/.test(url))return {format:'module',shortCircuit:true,
 source:(await transform(await readFile(fileURLToPath(url),'utf8'),
 {loader:url.endsWith('.tsx')?'tsx':'ts',format:'esm',jsx:'automatic',target:'es2022'})).code};
 return next(url,c);
}