# Project Worth Light Submissions — deployment and security checklist

**Status: DRAFT, not deployed.** Do not activate the public form or imply a confidential portal until end-to-end tests pass.

## Design
- Public POST \`/api/light-submissions\` collects optional contact details and minimal voluntary perspectives.
- Authenticated GET/PATCH \`/api/light-submissions\` serves a private inbox only to the **two explicitly authorized Cognito subject IDs** (Kerri and Zac). Existing general Admin group membership alone MUST NOT grant access.
- Private DynamoDB table with partition key \`PK\` (String) and sort key \`SK\` (String), point-in-time recovery and encryption at rest. No public read access.
- Public submissions are not map items; \`publicApproved=false\` and \`publicationStatus=NOT_AUTHORIZED\` cannot be changed by this API. Sharing requires a separate explicit, recorded, human-reviewed approval process.
- Statuses are \`new\`, \`in-review\`, \`closed\`. No hard delete in the dashboard. Submission categories: \`survivors-families\`, \`professional-advocates\`, \`partners\`, \`community-policy\`.
- No detailed trauma history, case evidence or identifying details about children should be solicited. This is **not** a child abuse reporting or emergency channel. Display Wisconsin official reporting guidance on the form.

## Required AWS provisioning — NOT YET PERFORMED
1. Create separate DynamoDB table \`ProjectWorthLightSubmissions\` in us-east-2, PK/SK strings, encryption at rest, PITR, restrictive resource IAM, retention policy approved by leadership. Do not grant generic Team/Volunteer roles.
2. Create dedicated Lambda for \`backend/light_submissions_handler.py\`; environment variables \`LIGHT_SUBMISSIONS_TABLE\`, \`LIGHT_SUBMISSIONS_ADMIN_SUBS\` (two reviewed Cognito \`sub\` UUIDs), and \`LIGHT_SUBMISSIONS_ISSUER\` (exact verified JWT issuer).
3. Give Lambda only \`dynamodb:PutItem\`, \`Query\`, and \`UpdateItem\` on the **exact table ARN**, plus limited CloudWatch log permissions. No DynamoDB Scan/DeleteItem/BatchWrite, no access to unrelated tables, no SES access, no S3 public content access.
4. In existing portal HTTP API, create public \`POST /api/light-submissions\` and **JWT-authorized** \`GET /api/light-submissions\` and \`PATCH /api/light-submissions\` routes. Confirm same verified Cognito authorizer used by the actual secure admin portal, and server-side allowlist. Do not rely on the visibility of the dashboard tab.
5. Restrict CORS to \`https://projectworthwi.org\` and verified alternative host if used. Require TLS. Configure API throttling and bot mitigation (AWS WAF/CAPTCHA or equivalent); otherwise an unauthenticated route can be abused. Monitor failures without logging request bodies. Optional inbox email alerts may contain only a count/record ID — **never** full testimony or personal data.
6. Route forms to this service **only after** a privacy/security review and a test using synthetic submissions. Preserve contact email endpoint separately for ordinary contact forms.
7. Set protected cache behavior \`Cache-Control: no-store\`; keep sensitive response bodies out of analytics, logs and public browser storage; prevent indexing. Confirm no caching on CloudFront.
8. Validate GET/PATCH with: no token 403, volunteer token 403, unrelated Admin token 403, Kerri's reviewed subject 200, Zac's reviewed subject 200, expired token 401/403, tampered JWT rejected. Test paging and all status transitions with synthetic data.
9. Test POST in-browser, backend persistence/readback, zero-email submissions, consent requirements, server errors, spam throttling, county dropdown, and mobile UI. Only after passing tests enable the frontend and deploy through GitHub + S3 + CloudFront invalidation with rollback.

**Scope:** Status updates do not constitute consent to publish. Before implementing a public map publishing workflow, require separate explicit participant approval for exact wording and generalized location.

No production changes should be asserted based on this runbook or on GitHub contents alone.
