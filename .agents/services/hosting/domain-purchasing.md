---
description: Domain purchasing and management guide
mode: subagent
tools:
  read: true
  write: false
  edit: false
  bash: false
  glob: true
  grep: true
  webfetch: true
---

# Domain Purchasing & Management Guide

<!-- AI-CONTEXT-START -->

## Quick Reference

**Supported Registrars**:
- **Spaceship**: 500+ TLDs, bulk ops, auto-renewal
- **101domains**: 1000+ TLDs, premium domains, reseller support

**Commands** (`spaceship-helper.sh`):
- `check-availability <account> <domain>` — check single domain
- `bulk-check <account> <domains...>` — check multiple domains
- `purchase <account> <domain> <years> <auto_renew>` — buy domain (requires confirmation)
- `domains <account>` — list registered domains
- `domain-details <account> <domain>` — expiration and config
- `monitor-expiration <account> <days>` — check expiring domains
- `audit <account> <domain>` — audit domain configuration

**Security**: confirmation required, spending limits configurable, audit trails

**TLD Recommendations**:
- Web apps: `.com`, `.app`, `.io`
- Tech: `.dev`, `.tech`, `.ai`
- E-commerce: `.shop`, `.store`
- Orgs: `.org`, `.foundation`
- Local: country-specific TLDs

<!-- AI-CONTEXT-END -->

## Registrars

### Spaceship

- Full API purchasing, real-time availability, 500+ TLDs
- Instant registration, bulk operations, auto-renewal

### 101domains

- Comprehensive purchasing API, bulk availability checking
- 1000+ TLDs including new gTLDs, premium domains, reseller support

**Future**: Namecheap API support in development.

## Configuration

```json
{
  "accounts": {
    "personal": {
      "api_token": "YOUR_SPACESHIP_API_TOKEN_HERE",
      "email": "your-email@domain.com",
      "auto_renew_default": true,
      "default_years": 1,
      "purchasing_enabled": true
    }
  },
  "purchasing_settings": {
    "confirmation_required": true,
    "max_purchase_amount": 500,
    "daily_purchase_limit": 10,
    "require_approval_over": 100,
    "auto_configure_dns": true,
    "default_nameservers": ["ns1.spaceship.com", "ns2.spaceship.com"]
  }
}
```

## Availability Checking

```bash
# Single domain
./.agents/scripts/spaceship-helper.sh check-availability personal example.com

# Bulk check
./.agents/scripts/spaceship-helper.sh bulk-check personal \
  myproject.com myproject.net myproject.org myproject.io myproject.app myproject.dev
```

## Purchasing

```bash
# Purchase with confirmation (1 year, auto-renew)
./.agents/scripts/spaceship-helper.sh purchase personal mynewdomain.com 1 true

# Multi-year
./.agents/scripts/spaceship-helper.sh purchase personal longterm-project.com 3 true

# No auto-renewal
./.agents/scripts/spaceship-helper.sh purchase personal temporary-project.com 1 false
```

**Purchase flow:**

```text
[INFO] Checking availability before purchase...
[SUCCESS] Domain newproject.com is available — $12.99
[WARNING] This action will charge your account. Continue? (y/N)
y
[SUCCESS] Domain purchased successfully
```

## Portfolio Management

```bash
# List all domains
./.agents/scripts/spaceship-helper.sh domains personal

# Domain details and expiration
./.agents/scripts/spaceship-helper.sh domain-details personal mydomain.com

# Expiring within 30 days
./.agents/scripts/spaceship-helper.sh monitor-expiration personal 30

# Audit configuration
./.agents/scripts/spaceship-helper.sh audit personal mydomain.com

# Cost analysis
for domain in $(./.agents/scripts/spaceship-helper.sh domains personal | awk '{print $1}'); do
    ./.agents/scripts/spaceship-helper.sh domain-details personal "$domain" | grep -E "(price|renewal|expiration)"
done
```

## Integration with Development Workflow

```bash
# 1. Research and purchase
./.agents/scripts/spaceship-helper.sh bulk-check personal myproject.com myproject.dev
./.agents/scripts/spaceship-helper.sh purchase personal myproject.com 1 true

# 2. DNS configuration
./.agents/scripts/dns-helper.sh add cloudflare personal myproject.com @ A 192.168.1.100
./.agents/scripts/dns-helper.sh add cloudflare personal myproject.com www CNAME myproject.com

# 3. SSL — automatic with Cloudflare or manual certificate installation

# 4. Deploy
./.agents/scripts/coolify-helper.sh deploy production myproject myproject.com
```

**Multi-environment:**

```bash
./.agents/scripts/spaceship-helper.sh purchase personal myproject.com 1 true   # Production
./.agents/scripts/spaceship-helper.sh purchase personal myproject.dev 1 true   # Development
./.agents/scripts/spaceship-helper.sh purchase personal myproject.app 1 true   # Mobile app
```

## Best Practices

**Domain selection**: brand consistency, appropriate TLD, SEO-friendly names, trademark check.

**Portfolio management**:
- Enable auto-renewal; monitor expiration dates
- Lock domains and enable 2FA
- Keep DNS records documented with backup configs

**Cost optimization**:
- Bulk and multi-year registrations for discounts
- Regular portfolio review to drop unused domains
- Compare transfer pricing vs renewal pricing
