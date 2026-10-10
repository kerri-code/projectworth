# CHAT-0006 deployment review

Status: **implemented locally, not deployed**. This proposal supersedes the
CHAT-0005 direct-production private-message CloudFormation change set. That
change set has not been executed; the working production website is intact.

The GitHub and local `dev` branches exist. Confirm the AMOS development hosting
account and region and a separately administered recovery account before
selecting deployment credentials. Cached CDK availability-zone/account context
is not provider verification or authorization to deploy to that account.

Reviewed scope: new isolated Project Worth dev identity/table, A/B static release
slots with JWT-protected APIs, and destination-owned locked recovery copies.
This creates new development infrastructure; it does not modify/import existing
AMOS resources, existing Cognito identities, the website distribution or DNS.
Production migration and full AMOS/production backups remain separate required
work after target-account inventory and a verified restore design.

Before live deployment, attach:

- Confirmed source/recovery account IDs, regions, independently controlled
  credential/administrator model and alarm recipient.
- Frozen release IDs/backend hashes, exact frontend manifest hashes and provider
  readback of uploaded slot versions and complete artifact archives.
- Actual TypeScript, unit-test, CDK security/synth and browser results plus a diff
  generated against the intended live stacks. Example-account synth is not a live diff.
- Retention choice. Example: Object Lock **COMPLIANCE 90 days**, irreversibly
  preventing deletion/shortening for retained versions; no delete propagation.
- Expected charges for CloudFront, S3 storage/locked backup versions, hourly full
  DynamoDB exports, Lambda, logs, Cognito and monitoring. No paid resources have
  been provisioned by this change.
- Confirmed source writer role and destination bucket policy; no primary account
  administrative trust in recovery. Confirm default retention on actual exported
  fragments and copied artifacts, not only the template.
- Restore drill evidence proving recovery credentials can decrypt/import data,
  rebuild both release artifacts, restore identities with password resets and
  verify private membership while source credentials are unavailable.

Initial release traffic is 100/0 blue/green. Candidate staging and exact-release
promotion guards exist; traffic switching, rollback execution and authenticated
live smoke tests have not occurred. CloudWatch alerts do not automatically
roll back traffic. Do not describe an account clone or guarantee zero downtime
until live deployment and primary-disconnected restoration pass.

See README.md and RECOVERY_RUNBOOK.md for commands, sequencing, coverage and
known limitations. The new source/archive upload requires its own exact payload
review; the previous approval covered a different snapshot.
