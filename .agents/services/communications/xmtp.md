---
description: XMTP — decentralized messaging protocol with quantum-resistant E2E encryption, MLS-based group chats, wallet/DID identity, agent SDK (TypeScript), native payments, spam consent
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

# XMTP

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Type**: Decentralized messaging — wallet/DID identity, MLS + post-quantum E2E encryption, native payments
- **License**: MIT (SDKs), open-source protocol
- **SDKs**: `@xmtp/agent-sdk` (Node.js bots), `@xmtp/browser-sdk`, `@xmtp/node-sdk`, React Native, Android (Kotlin), iOS (Swift)
- **Protocol**: [IETF RFC 9420 MLS](https://www.rfc-editor.org/rfc/rfc9420) with post-quantum hybrid encryption (NCC Group audited)
- **Network**: Decentralized node operators — ~$5/100K messages on production; free on `dev`
- **Environments**: `local` (Docker), `dev` (test), `production`
- **Repo/Docs**: [github.com/xmtp](https://github.com/xmtp) | [docs.xmtp.org](https://docs.xmtp.org/) | [xmtp.chat](https://xmtp.chat/) (playground)
- **MCP server**: [github.com/xmtp/xmtp-docs-mcp](https://github.com/xmtp/xmtp-docs-mcp)
- **Scale**: 55M+ connected users, 4,500+ developers, 1,700+ production mini-apps

**Key differentiator**: Identity-agnostic (wallets, passkeys, DIDs, social accounts). Messages and payments flow in the same conversation. MLS provides O(log n) group key management — same standard as Signal/WhatsApp group encryption, with post-quantum extensions.

## Protocol Comparison

| Criterion | XMTP | SimpleX | Matrix | Bitchat |
|-----------|------|---------|--------|---------|
| Identity | Wallet/DID/passkey | None | `@user:server` | Pubkey fingerprint |
| Encryption | MLS + post-quantum hybrid | Double ratchet (X3DH) | Megolm (optional) | Noise XX |
| Group encryption | MLS tree O(log n) | Sender keys | Megolm | — |
| Post-quantum | Yes | No | No | No |
| Native payments | Yes | No | No | No |
| Spam protection | Protocol-level consent | Per-connection | Server-side | Physical proximity |
| Agent/bot SDK | First-class (`@xmtp/agent-sdk`) | WebSocket JSON API | `matrix-bot-sdk` | None |
| Decentralization | Node operators (paid) | Stateless relays | Federated servers | BLE mesh |
| Audit | NCC Group (MLS) | Multiple | Multiple | — |
| Best for | Web3 apps, AI agents, payments | Maximum privacy | Team collaboration | Offline/local comms |

<!-- AI-CONTEXT-END -->

## Architecture

```text
Client (Browser/Node/RN/Android/iOS)
  └─ XMTP SDK: MLS encryption · content types · consent · local SQLite DB
       │  E2E encrypted (MLS)
       ▼
XMTP Network — independent node operators, globally distributed (~$5/100K msgs)
```

**Message flow**: Client encrypts → sends to nodes → nodes relay/store → recipient retrieves and decrypts locally → content types decoded → consent filters spam.

## Protocol Details

**MLS properties**: perfect forward secrecy, post-compromise security, O(log n) group key ops, post-quantum hybrid (harvest-now-decrypt-later resistant).

**Identity** — any DID: EOA wallet, smart contract wallet, ENS, passkey, social account (via DID resolver), custom DID method. No platform lock-in.

**Content types**: `text`, `reaction`, `reply`, `read-receipt`, `remote-attachment`, `transaction-reference`, `group-updated`. Custom types via `content-type-primitives`. Package names follow `content-type-<type>`.

**Consent**: Users allow/block senders network-wide. State is encrypted and user-controlled. Enforced client-side — no server-side filtering.

## Installation

```bash
# Agent SDK (bots/AI agents — recommended)
npm i @xmtp/agent-sdk && npm i -D typescript tsx @types/node

# Browser
npm i @xmtp/browser-sdk

# Node
npm i @xmtp/node-sdk

# React Native
npm i @xmtp/react-native-sdk
```

Mobile: [Android](https://docs.xmtp.org/chat-apps/sdks/android) | [iOS](https://docs.xmtp.org/chat-apps/sdks/ios)

## Agent SDK Usage

```bash
# .env
XMTP_ENV=dev                    # local | dev | production
XMTP_WALLET_KEY=0x...           # EOA wallet private key
XMTP_DB_ENCRYPTION_KEY=0x...    # 64 hex chars (32 bytes)
```

```typescript
import { Agent, getTestUrl } from "@xmtp/agent-sdk";

const agent = await Agent.createFromEnv();

agent.on("text", async (ctx) => {
  await ctx.conversation.sendText("Hello from XMTP agent!");
});

agent.on("reaction", async (ctx) => { /* handle reaction */ });
agent.on("reply", async (ctx) => { /* handle threaded reply */ });
agent.on("group_updated", async (ctx) => { /* handle member changes */ });

agent.on("start", () => {
  console.log(`Address: ${agent.address}`);
  console.log(`Test: ${getTestUrl(agent.client)}`);
});

await agent.start();
```

**Sending messages**:

```typescript
await ctx.conversation.sendText("Hello!");

const dm = await agent.client.conversations.newDm("0xRecipientAddress");
await dm.sendText("Direct message");

const group = await agent.client.conversations.newGroup(["0xMember1", "0xMember2"]);
await group.sendText("Group message");
```

**Local DB constraints**:

- SQLite persists device identity and message history — **must survive restarts/deploys**
- 10 installations per inbox — losing the DB creates a new installation (hard limit)
- Encrypted with `XMTP_DB_ENCRYPTION_KEY`

## Deployment

```bash
# PM2
npm i -g pm2
pm2 start src/agent.ts --interpreter tsx --name xmtp-agent
pm2 save && pm2 startup
```

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
VOLUME /app/data
ENV XMTP_DB_PATH=/app/data
CMD ["npx", "tsx", "src/agent.ts"]
```

**Security**: Store wallet key and DB encryption key in gopass/env vars. Never log private keys. Use `dev` for testing. Rate limits: [docs.xmtp.org/agents/deploy/rate-limits](https://docs.xmtp.org/agents/deploy/rate-limits).

## Limitations

- **Wallet/DID required**: barrier for non-crypto users (passkey support reduces friction)
- **Network cost**: ~$5/100K messages on production (free on `dev`)
- **10-installation inbox limit**: losing local DB counts as a new install — hard limit
- **Internet required**: no offline/mesh support (unlike Bitchat)
- **Web3-centric**: passkey identity reduces but doesn't eliminate blockchain dependency

## Production Apps

| App | Description |
|-----|-------------|
| [Base App](https://base.app/) | Coinbase L2 messaging |
| [World App](https://world.org/) | Worldcoin verified human messaging |
| [Convos](https://convos.org/) | XMTP-native encrypted messenger |
| [Zora](https://zora.co/) | NFT marketplace messaging |
| [xmtp.chat](https://xmtp.chat/) | Developer playground |

## Integration with aidevops

```typescript
import { Agent } from "@xmtp/agent-sdk";

const agent = await Agent.createFromEnv();

agent.on("text", async (ctx) => {
  const result = await dispatchToRunner(ctx.content);
  await ctx.conversation.sendText(result);
});

await agent.start();
```

**Architecture**: XMTP Chat → XMTP Agent (receive, check consent, dispatch) → aidevops Runner → reply.

**Matterbridge**: No native adapter. Build using Node SDK + Matterbridge REST API (same pattern as SimpleX adapter).

**Use cases**:

| Scenario | Value |
|----------|-------|
| Web3 project support | AI agents in Base/World/Convos |
| Payment-integrated bots | Accept payments for premium AI in-conversation |
| Multi-agent coordination | XMTP group chats for agent-to-agent comms |
| Cross-platform dispatch | Bridge XMTP → aidevops runners via agent SDK |
| Spam-resistant public bots | Protocol-level consent prevents abuse |

## AI-Ready Resources

- **MCP server**: [github.com/xmtp/xmtp-docs-mcp](https://github.com/xmtp/xmtp-docs-mcp)
- **Agent examples**: [github.com/xmtplabs/xmtp-agent-examples](https://github.com/xmtplabs/xmtp-agent-examples)
- **Starter template**: [github.com/xmtp/agent-sdk-starter](https://github.com/xmtp/agent-sdk-starter)
- **llms.txt**: use-case-based docs for LLM context

## Related

- `services/communications/convos.md` — Convos (XMTP-native, CLI agent mode)
- `services/communications/simplex.md` — SimpleX (zero-knowledge, no identifiers)
- `services/communications/matrix-bot.md` — Matrix bot integration
- `services/communications/bitchat.md` — Bitchat (Bluetooth mesh, offline)
- `services/communications/matterbridge.md` — Multi-platform chat bridge
- `tools/security/opsec.md` — Operational security
- XMTP MLS Audit: https://www.nccgroup.com/research-blog/public-report-xmtp-mls-implementation-review/
