# Project Worth development and recovery

CHAT-0006 / CHAD-9, CHAD-10, CHAD-11. GitHub and local branch: `dev`.

This is an isolated development deployment, prepared for the confirmed AMOS
AWS account. Nothing here has been deployed. The connected account is not
confirmation of the AMOS hosting account. The example uses synthetic accounts;
`fixture: true` is restricted to those accounts and must not be deployed.

Three CDK stacks separate retained data/identity, release routing, and recovery:

- **Data:** new dev Cognito pool with mandatory TOTP and no self signup; new
  DynamoDB table with deletion protection and 35-day PITR; versioned artifacts;
  an hourly backup worker, disabled until `backupsEnabled: true` is reviewed.
- **Releases:** private versioned S3 buckets, separate JWT-protected API and
  retained Lambda versions for slots A/B. Both share the dev data and identity.
  A stable CloudFront hostname redirects entry pages to immutable
  `/releases/A/<id>/...` or `/releases/B/<id>/...` paths. Existing versioned paths
  remain usable. The inactive slot is the candidate. This is a blue/green,
  100/0 switch, not a percentage traffic experiment.
- **Recovery:** another account owns the private, versioned Object Lock bucket,
  its encryption and independent freshness monitor/alarm. Source backup role can
  write only its prefix; it cannot read/delete recovery objects, change retention,
  or assume an administrative role there. S3 ACLs are disabled (BucketOwnerEnforced);
  PutObjectAcl is present because DynamoDB export documents require it.

CDK pins dependencies and uses strict TypeScript, `tsx`, CDK assertions and
cdk-nag. Stateful stacks have termination protection and retained resources.
Security exceptions are recorded in source: dev uses the CloudFront certificate,
no WAF or paid Cognito Plus plan. The entrypoint rejects production deployment;
production migration must preserve existing accounts, conversations and DNS.

## Validate locally

```sh
cd infrastructure
npm ci
npm run check
npm test
npm run synth -- -c config=config.example.json
```

Example synthesis is offline preparation, not an AWS deployment. Browser tests
run separately from `chat/` using installed Chrome and synthetic API responses.

## Prepare and deploy dev

1. Confirm AMOS source account, region, independent recovery account, independently
   reachable alarm email, and retention. Use separate credentials/profiles and
   independent root recovery and MFA. Do not grant the primary account recovery
   administrative access via CDK bootstrap trust.
2. Freeze two distinct initial releases with `npx tsx freeze-release.ts <id>`.
   This copies backend source and SHA-256 once; existing IDs cannot be reused.
   Set `releaseA`/`releaseB` in a private config, `fixture: false`, and
   `backupsEnabled: false`. Save the exact tested manifests/config outside AWS too.
3. Bootstrap the confirmed accounts with independently controlled CDK deployment
   roles. Review resulting trust policies, bootstrap resources and charges.
4. Run `npm run check`, tests, `cdk synth --strict -c config=<config>`, and
   `cdk diff -c config=<config>`. Review IAM, replacement/deletion, retention,
   cross-account access and costs before live deployment.
5. Deploy Data first (creates the narrowly scoped source writer role). Then deploy
   Recovery using recovery credentials; its policy names the existing source role.
   COMPLIANCE retention cannot be shortened once applied to an object version.
   Confirm recovery ownership and SNS email subscription, then deploy Releases.
6. Obtain verified outputs. Run
   `npx tsx package-release.ts <id> <slot-api-url> <region> <dev-client-id> A`
   (or `B`). This packages public assets plus dev login and a minimal dev messaging
   portal. It excludes the production portal/API flows and private engineering files.
   HTML is bound to that slot's API and the dev identity client.
7. Review and upload only `releases/<id>/site/` contents to its slot bucket. Use
   versioned immutable keys and verify SHA-256 against `site-manifest.json`.
   Archive the frozen backend, packaged frontend, manifest, config, CDK templates
   and deployment outputs into the Data artifacts bucket; the backup worker copies
   that bucket. A/B asset buckets are **not** directly copied by the worker.
8. Create/verify the two dev users in the dev pool and enable explicit membership
   only after confirming their dev subjects. Existing production subjects do not
   authorize access in the dev pool. No users or memberships are seeded by CDK.
9. Run authenticated live candidate smoke/E2E tests with approved test accounts.
   No deployment or test step sends a message to a real person automatically.
10. Enable hourly backups, execute one, verify the destination's export manifest,
    checksum files, source versions, Object Lock and receipt, and perform a restore
    drill. A scheduled rule or fresh receipt alone does not prove recoverability.

## Promotion and rollback

Freeze a new release and change only the inactive slot's release ID. Deploy its
backend, publish its immutable assets, preserve its complete artifact archive,
then test its candidate URL. Keep the active slot's source/manifest unchanged.
API and schema changes must support both versions, including clients from older
frontend paths. Do not perform destructive schema migrations during a switch.

`promote.ts` validates matching release ID, artifact manifest hash, candidate URL,
passing unit/build/E2E and authenticated live smoke evidence, freshness (24 hours)
and an explicit schema-compatibility assertion. It prepares a new config with
only `activeSlot` changed. It does not collect live test evidence itself, upload
files, deploy, or bypass a reviewed diff. The operator must verify the supplied
results against actual logs and deployed files.

```sh
npx tsx promote.ts config.local.json evidence.json releases/<id>/site-manifest.json https://<frontdoor> promoted-config.json
npx cdk diff -c config=promoted-config.json
```

Save the prior configuration before promotion. After health checks, switch the
front door using the reviewed config. For rollback, deploy that preserved config
while both slot IDs/source remain unchanged; verify the old URL, authentication,
message reads and alarms. If a slot has since been overwritten by another release,
rebuild the frozen prior backend/manifest before routing users to it. Alarm wiring
alerts operators; automatic traffic rollback is not implemented.

## Independent recovery limitations

The worker covers the **new dev table, dev identity metadata and Data artifacts
bucket** only. It exports full DynamoDB snapshots with `S3BucketOwner` set to the
recovery account, copies every available artifact version, records delete markers,
and includes user enabled/status/subject metadata without passwords. It emits a
completed receipt only after the export and copies succeed. A >5 GiB artifact or
an export exceeding the worker deadline fails without a success receipt; multipart
copy and resumable long-export orchestration are prerequisites if that scale is
needed. Source-account quotas and failure alerts must be reviewed before use.

Hourly jobs target roughly a one-hour recovery point when they succeed. Backup
and restoration times are unmeasured until drills pass. Root/account closure in
the recovery account, correlated credential compromise, and retention expiry are
outside this protection. See RECOVERY_RUNBOOK.md for whole-system coverage,
including existing Project Worth resources and AMOS Neptune.
