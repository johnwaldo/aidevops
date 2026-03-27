---
description: Web hosting provider comparison and setup
mode: subagent
tools:
  read: true
  write: false
  edit: false
  bash: true
  glob: true
  grep: true
  webfetch: true
---

# Web Hosting Helper

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Purpose**: Local domain management for ~/Git projects with SSL
- **Script**: `.agents/scripts/webhosting-helper.sh`
- **Config**: `configs/webhosting-config.json`
- **Requires**: LocalWP or nginx, OpenSSL, sudo access

**Commands**: `setup|list|remove`
**Usage**: `./.agents/scripts/webhosting-helper.sh setup PROJECT_NAME [PORT]`

**Frameworks** (auto-detected):

- Next.js/React/Vue/Nuxt/Rails: port 3000
- Vite/Svelte: port 5173
- Python/PHP: port 8000
- Go: port 8080

**SSL Certs**: `~/.localhost-setup/certs/` (self-signed, 365 days, 2048-bit RSA, TLSv1.2+1.3)

**CRITICAL**: After setup, manually add to hosts:

```bash
echo "127.0.0.1 PROJECT.local" | sudo tee -a /etc/hosts
```

<!-- AI-CONTEXT-END -->

## Initial Setup

```bash
cp configs/webhosting-config.json.txt configs/webhosting-config.json
chmod +x .agents/scripts/webhosting-helper.sh
```

## Usage

```bash
# Auto-detect framework and port
./.agents/scripts/webhosting-helper.sh setup myapp

# Specify custom port
./.agents/scripts/webhosting-helper.sh setup myapp 3001

# List configured domains
./.agents/scripts/webhosting-helper.sh list

# Remove a domain
./.agents/scripts/webhosting-helper.sh remove myapp
```

## Complete Setup Workflow

Follow these exact steps when setting up a local domain:

1. **Run setup** (creates nginx config + SSL certs):

   ```bash
   ./.agents/scripts/webhosting-helper.sh setup PROJECT_NAME PORT
   ```

2. **Add domain to hosts file** (setup cannot do this automatically due to sudo):

   ```bash
   echo "127.0.0.1 PROJECT_NAME.local" | sudo tee -a /etc/hosts
   ```

3. **Start the development server**:

   ```bash
   cd ~/Git/PROJECT_NAME
   PORT=PORT_NUMBER npm run dev    # or pnpm dev, yarn dev
   ```

4. **Access and accept SSL warning**: Visit `https://PROJECT_NAME.local`. Browser shows `ERR_CERT_AUTHORITY_INVALID` for self-signed certs -- click "Advanced" then "Proceed" (Chrome/Safari) or "Accept the Risk" (Firefox).

5. **Verify**: `http://PROJECT_NAME.local` redirects to HTTPS, hot reload works.

### Example

```bash
./.agents/scripts/webhosting-helper.sh setup myapp 3000
echo "127.0.0.1 myapp.local" | sudo tee -a /etc/hosts
cd ~/Git/myapp && PORT=3000 npm run dev
# Visit https://myapp.local
```

## Directory Structure

```text
~/.localhost-setup/certs/
  PROJECT.local.crt, PROJECT.local.key

~/Library/Application Support/Local/run/router/nginx/conf/
  route.PROJECT.local.conf

/etc/hosts
  127.0.0.1 PROJECT.local
```

## LocalWP Integration

The helper auto-detects LocalWP and uses its nginx router. Works alongside WordPress sites without conflicts. All framework HMR/WebSocket configs are preserved.

## Troubleshooting

### Domain Not Resolving ("This site can't be reached")

Missing hosts entry:

```bash
echo "127.0.0.1 PROJECT_NAME.local" | sudo tee -a /etc/hosts
```

### LocalWP Not Found

Install from <https://localwp.com/> or use standalone nginx (manual config required).

### Port Already in Use

```bash
lsof -i :3000                                          # Check what's using it
./.agents/scripts/webhosting-helper.sh setup myapp 3001 # Use different port
```

### SSL Certificate Issues

```bash
rm ~/.localhost-setup/certs/myapp.local.*
./.agents/scripts/webhosting-helper.sh setup myapp      # Regenerates certs
```

### Build Errors (Framework-Specific)

Some frameworks need a build step before dev server starts:

```bash
cd ~/Git/PROJECT_NAME
pnpm build          # Generate required files
PORT=PORT_NUMBER pnpm dev
```

## Related

- [LocalWP Integration](LOCALHOST.md)
- [SSL Certificate Management](SECURITY.md)
- [Nginx Configuration](../configs/webhosting-config.json.txt)
