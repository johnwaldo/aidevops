---
description: iMessage/BlueBubbles bot integration — BlueBubbles REST API (recommended), imsg CLI (send-only), macOS requirements, messaging features, access control, privacy/security assessment, and aidevops runner dispatch
mode: subagent
tools:
  read: true
  write: false
  edit: false
  bash: true
  glob: false
  grep: false
  webfetch: false
  task: false
---

# iMessage / BlueBubbles Bot Integration

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Platform**: macOS only (Messages.app required)
- **BlueBubbles**: REST API + webhooks — DMs/groups/reactions/attachments/typing/read receipts. [Repo](https://github.com/BlueBubblesApp/bluebubbles-server) (Apache-2.0)
- **imsg**: Send-only CLI. [Repo](https://github.com/steipete/imsg) (MIT)
- **Encryption**: iMessage E2E (Apple-managed); BlueBubbles reads locally from `chat.db`
- **Identifier**: Apple ID (email) or phone number

**When to use**: iMessage for Apple users natively; imsg for send-only notifications; SimpleX for max privacy; Matrix for teams; Signal for secure 1:1.

<!-- AI-CONTEXT-END -->

## Architecture

**BlueBubbles flow**: Sender → APNs → Messages.app decrypts to `chat.db` → BlueBubbles detects → fires webhook → bot responds via REST API → Messages.app re-encrypts and sends. **imsg**: `imsg send` → AppleScript → Messages.app. Fire-and-forget, no inbound.

## Integration Path 1: BlueBubbles (Recommended)

**Requirements**: macOS 11+, Messages.app signed in, Full Disk Access + Accessibility permissions, persistent GUI session.

**Installation**: Download DMG from [GitHub Releases](https://github.com/BlueBubblesApp/bluebubbles-server/releases). The `bluebubbles` Homebrew cask is deprecated (disabled 2026-09-01).

**Server config**: port `1234`, password (required), Cloudflare proxy tunnel, `1000ms` chat.db poll interval. **Headless/VM**: `caffeinate -d` to prevent sleep; complete iCloud 2FA interactively before going headless.

### REST API

All requests require `Authorization: Bearer YOUR_PASSWORD` header (not query param — query strings are logged).

**Key endpoints**: `GET /api/v1/chat`, `GET /api/v1/chat/:guid/message`, `POST /api/v1/message/text`, `POST /api/v1/message/attachment`, `POST /api/v1/message/react`, `GET /api/v1/contact`, `GET /api/v1/server/info`.

**Send text**:

```bash
curl -X POST "http://localhost:1234/api/v1/message/text" \
  -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_PASSWORD" \
  -d '{"chatGuid":"iMessage;-;+1234567890","message":"Hello!","method":"apple-script"}'
```

**Chat GUID format**: `iMessage;-;+14155551234` (DM phone), `iMessage;-;user@example.com` (DM email), `iMessage;+;chat123456789` (group), `SMS;-;+14155551234` (SMS fallback).

**Reaction types**: `love`, `like`, `dislike`, `laugh`, `emphasize`, `question`

### Webhooks

Register: `POST /api/v1/server/webhook` with `{"url":"...","password":"YOUR_PASSWORD"}`.

**Events**: `new-message`, `updated-message`, `typing-indicator`, `read-receipt`, `group-name-change`, `participant-added`, `participant-removed`, `participant-left`, `chat-read-status-changed`

**`new-message` payload** (key fields): `type`, `data.guid`, `data.text`, `data.chatGuid`, `data.handle.address`, `data.dateCreated`, `data.isFromMe`, `data.hasAttachments`, `data.attachments`.

**Supported features**: send/receive text (DMs + groups), attachments, reactions (6 types), reply threading (`selectedMessageGuid`), edit/unsend detection, typing indicators (inbound), read receipts, SMS fallback. Not supported: mentions, stickers/Memoji.

## Integration Path 2: imsg CLI (Send-Only)

**Requirements**: macOS 12+, Messages.app signed in, Accessibility permissions for terminal.

```bash
brew install steipete/tap/imsg
imsg send "+14155551234" "Hello!"          # DM by phone
imsg send "user@example.com" "Hello!"     # DM by email
imsg send --group "Family" "Hello!"       # Group
imsg check "+14155551234"                 # Check iMessage capability
```

## macOS Host Requirements

Options: Mac mini (~$600+, reliable), macOS VM on Apple Silicon (UTM/Parallels), or cloud Mac (MacStadium/AWS EC2, $50–200/month).

**Keepalive**: `caffeinate -d &` (session) or `sudo pmset -a sleep 0` (persistent). Run launchd job `sh.aidevops.imessage-keepalive`: `pgrep -x Messages || open -a Messages; pgrep -x BlueBubbles || open -a BlueBubbles`.

## Access Control

Implement in the bot process: (1) allowlist by phone/email — ignore unknown handles; (2) allowlist by group; (3) command-level permissions — admin commands restricted to specific handles; (4) rate limiting — per-sender + global; (5) content filtering — scan inbound with `prompt-guard-helper.sh`.

**API security**: Bind to `127.0.0.1` + Cloudflare tunnel. Store password: `aidevops secret set BLUEBUBBLES_PASSWORD`.

## Privacy and Security

**iMessage encryption**: Classic: RSA-OAEP + AES-128-CTR. iOS 13+: ECIES P-256 + AES-128-CTR. PQ3 (iOS 17.4+): post-quantum key establishment + AES-256-CTR. Signing: ECDSA P-256. Key verification: Contact Key Verification (iOS 17.2+, optional).

**Apple visibility**: Metadata (who, when, IP) + contact graph. Not message content. iCloud Backup without Advanced Data Protection exposes backups — enable ADP (iOS 16.2+, macOS 13.1+).

**BlueBubbles threat model**: Reads `~/Library/Messages/chat.db`. Mac compromise = full message access. API password + tunnel mitigates network exposure.

**Recommendations**: (1) Enable ADP on macOS host. (2) Dedicated Apple ID for the bot. (3) Bind to localhost + Cloudflare tunnel. (4) Rotate server password periodically. (5) Monitor host (FileVault, firewall). (6) Don't store sensitive data in iMessage — metadata visible to Apple.

## Integration with aidevops

**Pattern**: iMessage User → Bot webhook handler → aidevops runner → AI session → response via BlueBubbles API.

**Bot handler steps**: (1) Listen on webhook port. (2) On `new-message`: verify sender allowlist, extract `text` + `chatGuid`. (3) If command prefix matched: dispatch to `runner-helper.sh`. (4) Send response via `POST /api/v1/message/text`. (5) Log interaction.

**Matterbridge**: iMessage not natively supported. Options: BlueBubbles API → custom adapter → Matterbridge, or BlueBubbles → bot → Matrix → Matterbridge. See `matterbridge.md`.

## Limitations

- **Platform lock-in**: macOS only, Apple ID required, no Linux/Windows, no official Apple API
- **Reliability**: Messages.app crashes need monitoring; macOS updates may break BlueBubbles; unusual activity may trigger Apple ID lockouts
- **Feature gaps**: No @mentions, no bot profile distinction, no command menus, limited group management
- **Legal**: BlueBubbles uses AppleScript + direct DB reads — not Apple-sanctioned. Use a dedicated Apple ID; do not use for spam.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Messages.app not running | `pgrep -x Messages \|\| open -a Messages` |
| Can't read messages | Full Disk Access: System Settings > Privacy & Security |
| Send fails | Accessibility permission for BlueBubbles |
| Mac sleeping | `caffeinate -d &` or `sudo pmset -a sleep 0` |
| API 401 | Check `Authorization: Bearer` header |
| Webhook not firing | Verify URL reachable; check BlueBubbles logs |
| SMS instead of iMessage | `imsg check <number>` |
| Apple ID locked | Too many automated messages; wait 24h |
| macOS update broke BB | Check GitHub releases for compatible version |

## Related

`simplex.md` (max privacy), `matrix-bot.md` (runner dispatch), `matterbridge.md` (bridge), `opsec.md`, `headless-dispatch.md`. Docs: [BlueBubbles](https://docs.bluebubbles.app/), [Apple iMessage security](https://support.apple.com/guide/security/imessage-security-overview-secd9764312f/web), [imsg](https://github.com/steipete/imsg).
