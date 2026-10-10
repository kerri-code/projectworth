import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
export const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
export function verifySiteManifest(filename: string) {
  const manifest = JSON.parse(readFileSync(filename,'utf8')) as { releaseId: string; slot: 'A'|'B'; artifactSha256: string; backendSha256: string; files: Array<{path:string;sha256:string}> };
  const {artifactSha256,...artifact}=manifest;
  if(sha256(JSON.stringify(artifact))!==artifactSha256) throw new Error('Site manifest hash mismatch');
  if(sha256(backendForRelease(manifest.releaseId))!==manifest.backendSha256) throw new Error('Site and frozen backend do not match');
  const directory=realpathSync(resolve(filename,'..','site','releases',manifest.slot,manifest.releaseId));
  for(const file of manifest.files){
    const path=realpathSync(resolve(directory,file.path));
    if(!path.startsWith(directory+'/'))throw new Error('Unsafe artifact path');
    if(sha256(readFileSync(path))!==file.sha256)throw new Error('Packaged file hash mismatch: '+file.path);
  }
  return manifest;
}
export function backendForRelease(id: string, fixture = false): string {
  if (fixture) return readFileSync(resolve(__dirname,'../../chat/handler.cjs'),'utf8');
  const directory = resolve(__dirname, '../releases', id);
  const manifest = JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')) as { releaseId: string; backendSha256: string };
  const source = readFileSync(join(directory,'handler.cjs'),'utf8');
  if (manifest.releaseId !== id || manifest.backendSha256 !== sha256(source)) throw new Error('Immutable backend snapshot does not match release manifest');
  return source;
}
export interface ReleaseEvidence { releaseId: string; artifactSha256: string; unit: 'passed'; build: 'passed'; e2e: 'passed'; authenticatedSmoke: 'passed'; testedURL: string; testedAt: string; schemaCompatible: boolean; }
export function approvePromotion(candidate: { releaseId: string; artifactSha256: string; url: string }, evidence: ReleaseEvidence) {
  if (candidate.releaseId !== evidence.releaseId || candidate.artifactSha256 !== evidence.artifactSha256 || candidate.url !== evidence.testedURL) throw new Error('Evidence belongs to another release');
  for (const check of ['unit','build','e2e','authenticatedSmoke'] as const) if (evidence[check] !== 'passed') throw new Error(`Promotion requires passing ${check}`);
  if (!evidence.schemaCompatible) throw new Error('Both slots must support the current data schema');
  const age = Date.now() - Date.parse(evidence.testedAt);
  if (!Number.isFinite(age) || age < 0 || age > 24*60*60*1000) throw new Error('Live verification must be within the last 24 hours');
  return { releaseId: candidate.releaseId, artifactSha256: candidate.artifactSha256, verifiedAt: evidence.testedAt };
}
