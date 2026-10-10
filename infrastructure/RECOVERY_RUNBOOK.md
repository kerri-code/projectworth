# Recovery when the primary AWS account is unavailable

The completed dev recovery stack is only one part of recovery. Do not describe
AMOS or existing production as cloned until inventory, independent copies and a
primary-disconnected restore drill have passed.

## Before an incident

- Recovery account has independent root email, hardware MFA, administrators and
  billing recovery; source administrators cannot assume recovery admin roles.
  Review Organizations/SSO/bootstrap trust so compromised management access does
  not also control both accounts. Store emergency credentials outside the primary
  account. Subscribe/verify the independent alarm email.
- Keep repository source, lockfiles, tested release archives, CDK templates,
  config and deployment receipts offline or with a separately controlled provider.
  Preserve infrastructure and application artifacts, not just server disk images.
- Domain registrar and DNS recovery must be available independently of primary
  AWS access. Record who can change authoritative nameservers and TLS validation.
  Rotate integration credentials and secrets from their own provider; never put
  plaintext secrets in backup receipts or source snapshots.
- Review 90-day example retention before deploying Object Lock COMPLIANCE. Locked
  object versions cannot be deleted or have retention shortened, even by root,
  during their retention. Primary writes may be revoked independently; old
  versions remain. Do not propagate source deletes or purge destination copies.
- Verify destination export fragments/manifests/checksums and archive SHA-256,
  source object version IDs, ownership, retention and available decryption while
  authenticated exclusively as a recovery administrator. Test more than recency.

## Inventory still requiring confirmed live backup coverage

| Component | Existing/new | Required independent recovery |
| --- | --- | --- |
| New dev chat table | Implemented CDK | Destination-owned PITR exports; verify/import/check records |
| New dev identity pool | Implemented CDK | Exported profile/status metadata; password and MFA reset; verified subject remapping |
| New dev build artifacts | Implemented CDK | Every available S3 version plus deletion markers; package both release slots into this bucket |
| Existing CHAD DynamoDB ledger | Existing Project Worth | Additional confirmed table export and immutable provenance verification |
| Existing AMOS repository artifact bucket | Existing Project Worth | Seed/copy all versioned archives and per-file objects; retain source versions/hashes |
| Existing public website + private uploads | Existing Project Worth | Inventory all buckets, enable/version source as reviewed, seed/copy objects and manifests |
| Existing Cognito identities | Existing Project Worth | Export allowed attributes, enabled/status, groups and stable person mapping; passwords cannot be exported |
| Existing API/Lambda/CloudFront/DNS | Existing Project Worth | Capture exact configuration, code, IAM and DNS; import or reconstruct via reviewed CDK |
| AMOS authoritative engineering graph | Separate AMOS deployment | Confirm account/cluster/KMS; destination-owned Neptune snapshot copy using destination encryption, and restore/query validation |
| AMOS application/build assets | Separate AMOS deployment | Independent exact-version artifact copies and CDK/application source; integrate AMOS domain API and authorization |

The local AMOS CDK defines private encrypted Neptune with seven-day backups and
retained resources. Those backups alone are not proven independent copies. Do
not substitute this dev DynamoDB or S3 packaging for AMOS's authoritative Neptune
history. Cross-account AWS Backup has Organizations/service requirements; the
currently connected Project Worth account is not in an Organization. DynamoDB
S3 export works across accounts without requiring that relationship. Neptune
copying must separately verify key sharing and destination-owned re-encryption;
no AMOS cluster/account is assumed from cached CDK context.

## Restore drill with the primary account disconnected

1. Select a previously verified immutable backup in the recovery account. Verify
   retention/version IDs, export manifest/checksums and artifact hashes. Use a
   recovery role that cannot authenticate to the primary account during the drill.
2. Redeploy reviewed infrastructure in recovery using destination credentials
   and local source/build archives. Keep domain cutover disabled during validation.
   The current CDK entrypoint provisions dev only; production migration/import
   must be completed separately before claiming live production failover readiness.
3. Import DynamoDB full-export data into a new table with matching key schema,
   then enable PITR/deletion protection. Check record counts, sampled message
   hashes, unread state, original CHAT IDs and provenance. DynamoDB export is
   not a directly attachable volume or already-restored table.
4. Restore the correct S3 versions using receipt metadata; honor latest deletion
   markers rather than resurrecting deliberately removed files. Restore both
   known-good release artifacts and their pinned API configuration.
5. Restore identity metadata via a supported Cognito import process and issue
   password reset/re-enrollment for MFA. New Cognito subjects differ. Map verified
   people to new subjects through an operator-reviewed process; never grant a
   private-room role purely because an arbitrary account claims an old email.
   Disabled identities remain disabled. Test outsiders cannot access messages.
6. Restore AMOS Neptune from an independently owned/decryptable snapshot, verify
   graph invariants and exact-version engineering history, and reconnect the AMOS
   domain API. This step is not implemented by the dev chat backup worker.
7. Test login, private sending/reading with test accounts, unread counts, uploads,
   authorizations, release rollback and alarms. Measure actual data loss window
   (RPO) and time to restore service (RTO); record failed steps and repair them.
8. Only after the drill passes, document the approved DNS cutover procedure,
   certificate setup and operational ownership. Live cutover remains a separate
   reviewed action. Repeat drills after schema/infrastructure/identity changes.

## Current evidence

Local CDK synthesis, security checks and unit/browser fixture tests are evidence
of the implementation. No independently hosted account, locked backup, completed
live export, AMOS snapshot copy or successful restore drill has been verified.
