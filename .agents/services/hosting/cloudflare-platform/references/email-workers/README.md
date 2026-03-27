# Cloudflare Email Workers

Process incoming emails on the Workers runtime. **ES modules format only** (Service Worker is deprecated).

## ForwardableEmailMessage API

```typescript
interface ForwardableEmailMessage {
  readonly from: string;        // Envelope From
  readonly to: string;          // Envelope To
  readonly headers: Headers;    // Message headers
  readonly raw: ReadableStream; // Raw message stream
  readonly rawSize: number;     // Size in bytes
  setReject(reason: string): void;                           // Permanent SMTP rejection
  forward(rcptTo: string, headers?: Headers): Promise<void>; // Forward (verified dest only, X-* headers)
  reply(message: EmailMessage): Promise<void>;               // Reply to sender
}
// Constructor: import { EmailMessage } from "cloudflare:email";
// new EmailMessage(from, to, rawMimeContent)
```

## Patterns

### Parse Email (postal-mime)

```typescript
import * as PostalMime from 'postal-mime';
export default {
  async email(message, env, ctx) {
    const parser = new PostalMime.default();
    const email = await parser.parse(await new Response(message.raw).arrayBuffer());
    // email: { headers, from, to, subject, html, text, attachments }
    await message.forward("inbox@example.com");
  },
};
```

### Auto-Reply (mimetext)

```typescript
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from 'mimetext';
export default {
  async email(message, env, ctx) {
    const msg = createMimeMessage();
    msg.setSender({ name: 'Support Team', addr: 'support@example.com' });
    msg.setRecipient(message.from);
    msg.setHeader('In-Reply-To', message.headers.get('Message-ID'));
    msg.setSubject('Re: Your inquiry');
    msg.addMessage({ contentType: 'text/plain', data: 'We will respond within 24 hours.' });
    await message.reply(new EmailMessage('support@example.com', message.from, msg.asRaw()));
    await message.forward("team@example.com");
  },
};
```

### Snippets (all inside `async email(message, env, ctx)`)

```typescript
// Allowlist / blocklist
if (!["friend@example.com"].includes(message.from)) message.setReject("Not allowed");
else await message.forward("inbox@corp.example.com");

// Subject-based routing
const subject = (message.headers.get('Subject') || '').toLowerCase();
if (subject.includes('billing')) await message.forward("billing@example.com");
else if (subject.includes('support')) await message.forward("support@example.com");
else await message.forward("general@example.com");

// ctx.waitUntil — non-critical async (analytics, webhooks, heavy processing on large emails)
await message.forward("inbox@example.com");
ctx.waitUntil(Promise.all([logToAnalytics(message), notifySlack(message)]));

// Size filter
if (message.rawSize > 10 * 1024 * 1024) message.setReject("Message too large");
else await message.forward("inbox@example.com");

// Store in KV/R2
await env.EMAIL_ARCHIVE.put(`email:${Date.now()}:${message.from}`,
  JSON.stringify({ from: email.from, subject: email.subject }));

// Multi-tenant routing
const config = await env.TENANT_CONFIG.get(extractTenantId(message.to.split('@')[0]), 'json');
if (config?.forwardTo) await message.forward(config.forwardTo);
else message.setReject("Unknown recipient");
```

## Wrangler Configuration

```toml
name = "email-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"
[[send_email]]
name = "EMAIL"
[[kv_namespaces]]
binding = "EMAIL_ARCHIVE"
id = "your-kv-namespace-id"
```

## Local Development

```bash
npx wrangler dev
# Test receiving email:
curl --request POST 'http://localhost:8787/cdn-cgi/handler/email' \
  --url-query 'from=sender@example.com' \
  --url-query 'to=recipient@example.com' \
  --header 'Content-Type: application/json' \
  --data-raw 'From: sender@example.com
To: recipient@example.com
Subject: Test Email

Hello world'
# Wrangler writes sent emails to local .eml files. Visit http://localhost:8787/ to trigger.
```

## Deployment

1. Enable Email Routing in Cloudflare dashboard
2. Add verified destination address
3. `npx wrangler deploy`
4. Dashboard > Email Routing > Email Workers > create route > bind to Worker

## Limits and Troubleshooting

| Limit | Value | Issue | Fix |
|-------|-------|-------|-----|
| Message size | 25 MiB | Not forwarding | Verify dest in dashboard; check Email Routing enabled; `wrangler tail` |
| Rules | 200 | `EXCEEDED_CPU` | Upgrade to Paid plan; use `ctx.waitUntil()` for heavy ops |
| Dest addresses | 200 | Local dev broken | Ensure `send_email` binding; use correct curl format |

## Best Practices

- `forward()` requires verified destination addresses
- Parse headers safely: `message.headers.get('Subject') || '(no subject)'`
- Type safety: `async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext)`
- **Deps:** `postal-mime` (^2.3.3), `mimetext` (^4.0.0), `@cloudflare/workers-types` (^4.0.0), `wrangler` (^3.0.0)

## References

- [Email Routing Setup](https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/)
- [Workers Platform](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
