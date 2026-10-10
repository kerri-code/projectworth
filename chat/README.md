> CHAT-0006: deployment now uses the isolated CDK dev environment in
> `../infrastructure/`. The earlier direct-production CloudFormation proposal
> has not been executed and is superseded. See the infrastructure deployment
> review for A/B release and independent-account recovery status.

# Project Worth private messages

MVP: use the existing Project Worth Institute account to privately message Zac
or Kerri. The navy-and-gold box sits at the bottom right, collapsed and muted,
with an unread badge. Messages update while the page is visible, every five
seconds. The thread supports earlier history, retry-safe sends, readable sender
attribution, failed-send draft recovery and keyboard dismissal.

The existing public login and portal pages were brought into this checkout from
the live site. The login source is unchanged. The portal gets one widget script;
the existing site script loads the same widget on public pages. Production
uploads must guard the previously verified ETags to avoid overwriting concurrent
site changes. Source and runtime data must never be uploaded wholesale to the
public website bucket.

## Storage and authentication

`handler.cjs` is a Lambda handler behind four JWT-protected routes on the existing
ProjectWorthPortalAPI. It accepts only the current Institute app client's Cognito
access tokens. API Gateway verifies JWT signatures/expiry; the function validates
the verified issuer/client/token type, checks the explicitly provisioned
conversation membership and verifies the Cognito account is still enabled and
confirmed on every request. IDs/names supplied by the browser cannot confer
access. There is no anonymous chat or new account system.

Messages, retry records and per-person received/read counters live in the existing
DynamoDB history table, in partition `DM#zac-kerri`. Chat messages never enter the
separate Chad AI prototype, an AI request, plugin audit payload, or an analytics
event from this widget. The Lambda role only accesses that partition and reads
account status from the relevant Cognito pool. AWS account administrators retain
their usual infrastructure access; this is not end-to-end encryption.

Membership is explicit: provision the verified Zac/Kerri account subjects in
the MEMBERSHIP row. An account not listed there gets 403. Account aliases must be
deliberately mapped to their person. Disabling/deleting a Cognito account or
removing membership blocks subsequent requests. In-flight account-disable races
are bounded by the request; membership is checked again inside send transactions.

Sending atomically writes the message and retry fingerprint, increments only the
recipient's unread state, verifies membership, and enforces 12 new messages per
account per minute. Retrying the same ID/text is safe; changing content or sender
fails. A fetched received-count snapshot is acknowledged separately, so concurrent
new messages remain unread. Read counters never move backward. Rate records are
retained; a rate-record cleanup policy can be added separately.

S3 remains the destination for uploads/large files/development builds. Attachments
are not part of this MVP. No application-level message expiry is configured for
this private thread; choose deletion/retention policy before expanding membership.

## EMIE and future scope

EMIE is a quiet first-friend entry and a star peeking above the launcher. Clicking
opens a small introduction; the wand-shaped control immediately sends it home.
There are no sounds, autonomous advice, cursor tracking or AI calls. The adaptive
wand game/PID behavior, actual organization hierarchy, social feed, group messaging
and much-later email subscribers are captured in CHAD-7/CHAD-8 for future work.

## Verify and prepare

From `chat/`:

```
npm ci --ignore-scripts
npm test
npm run build
npm run test:e2e
```

The E2E fixture uses installed macOS Chrome and mocked AWS responses with synthetic
accounts; it never sends real messages to either spouse. Screenshots are saved to
ignored `test-results/`. CloudFormation output is ignored `dist/template.json`.
It reuses the existing API/authorizer and adds four routes, a Lambda, a least-privilege
execution role, a retained 30-day log group, integration and invoke permission.
Existing API routes and existing Cognito login configuration are not replaced.

Deploy in us-east-2 under stack `projectworth-private-messages`. Use a validated
CREATE change set and inspect predeployment validation before execution. Check
membership absence first and provision with a conditional put. Publish only
`chat/widget.js`, `chat/widget.css`, `script.js` and `institute-portal.html` to the
website bucket; cache-invalidate those paths. Upload the immutable check-in
archive and source files separately to the private AMOS repo bucket, and create
verified per-file Drive tickets.

Current status: implemented and tested locally, not deployed. Real-account
cross-device validation remains pending deployment and user sign-in.
