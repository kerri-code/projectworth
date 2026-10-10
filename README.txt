Project Worth split site

Files created:
- index.html
- about.html
- kerris-story.html
- media.html
- awareness.html
- advocacy.html
- team.html
- merch.html
- light-the-way.html
- donate.html
- style.css
- script.js

Important:
Keep your image files in this same folder or update the image paths in the HTML. The original page references images such as PROJECT-WORTH-LOGO.png and other local image files.

Start by opening index.html in a browser.

Chad private chat MVP:
- Separate server application in chad/ (Node 24+).
- Setup, authentication integration, and deployment notes: chad/README.md.
- Run: cd chad && npm start
- Do not include chad/ source or runtime data in public static-site uploads.

Project Worth account-to-account messaging MVP:
- Existing Institute login/portal integration and bottom-right widget in chat/.
- Backend, storage, verification and deployment notes: chat/README.md.
- Private messages are separate from the Chad AI room.
- Publish only explicitly listed browser assets; never upload server source publicly.

Development infrastructure (CHAT-0006)
-------------------------------------
The dev branch includes infrastructure/ with CDK, A/B release slots and
independently owned recovery storage. See infrastructure/README.md and
RECOVERY_RUNBOOK.md. This is locally validated infrastructure; no AMOS dev
deployment or recovery-account restore has been verified yet.
