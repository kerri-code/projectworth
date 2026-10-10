export interface Config {
  environment: 'dev' | 'prod'; primaryAccount: string; recoveryAccount: string;
  region: string; recoveryRegion: string; activeSlot: 'A' | 'B';
  releaseA: string; releaseB: string; retentionDays: number; alarmEmail: string;
  fixture?: boolean; backupsEnabled?: boolean;
}
export function validate(value: unknown): Config {
  if (!value || typeof value !== 'object') throw new Error('Configuration required');
  const c = value as Config;
  if (!['dev', 'prod'].includes(c.environment) || !['A','B'].includes(c.activeSlot)) throw new Error('Invalid environment or slot');
  if (![c.primaryAccount,c.recoveryAccount].every(x => /^\d{12}$/.test(x)) || c.primaryAccount === c.recoveryAccount) throw new Error('Recovery must be a different AWS account');
  if (![c.region,c.recoveryRegion].every(x => /^[a-z]{2}(-[a-z]+)+-\d$/.test(x))) throw new Error('Invalid region');
  if (![c.releaseA,c.releaseB].every(x => /^[a-zA-Z0-9_-]{1,64}$/.test(x))) throw new Error('Invalid immutable release ID');
  if (c.releaseA === c.releaseB) throw new Error('Each slot needs a distinct immutable release ID');
  if (c.fixture && (c.primaryAccount !== '111111111111' || c.recoveryAccount !== '222222222222')) throw new Error('Fixture mode is limited to synthetic accounts');
  if (!Number.isInteger(c.retentionDays) || c.retentionDays < 30 || c.retentionDays > 3650) throw new Error('Retention must be 30–3650 days');
  if (typeof c.alarmEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.alarmEmail)) throw new Error('Independent alarm email required');
  return c;
}
export const recoveryBucketName = (c: Config) => `pw-gh-1232513288-${c.environment}-recovery-${c.recoveryAccount}`;
export const backupRoleName = (c: Config) => `pw-${c.environment}-recovery-writer`;
