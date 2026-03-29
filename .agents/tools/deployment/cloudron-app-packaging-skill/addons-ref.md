# Addons Reference

Full environment variable and option reference for Cloudron addons. Declare addons in `CloudronManifest.json` under the `addons` key. Read env vars at runtime on every start — values can change across restarts.

## localstorage

Provides writable `/app/data` directory. Contents are backed up. Directory is empty on first install; files from the Docker image are not present. Restore permissions in `start.sh`.

| Option | Description |
|--------|-------------|
| `ftp` | Enable FTP access: `{ "ftp": { "uid": 33, "uname": "www-data" } }` |
| `sqlite` | Declare SQLite files for consistent backup: `{ "sqlite": { "paths": ["/app/data/db.sqlite"] } }` |

## mysql

MySQL 8.0. Database is pre-created. Default charset: `utf8mb4` / `utf8mb4_unicode_ci`.

| Env var | Description |
|---------|-------------|
| `CLOUDRON_MYSQL_URL` | Full connection URL |
| `CLOUDRON_MYSQL_USERNAME` | Database username |
| `CLOUDRON_MYSQL_PASSWORD` | Database password |
| `CLOUDRON_MYSQL_HOST` | Database host |
| `CLOUDRON_MYSQL_PORT` | Database port |
| `CLOUDRON_MYSQL_DATABASE` | Database name |

| Option | Description |
|--------|-------------|
| `multipleDatabases: true` | Provides `CLOUDRON_MYSQL_DATABASE_PREFIX` instead of `CLOUDRON_MYSQL_DATABASE`. Create databases with that prefix. |

Debug: `cloudron exec` then `MYSQL_PWD=$CLOUDRON_MYSQL_PASSWORD mysql --user=$CLOUDRON_MYSQL_USERNAME --host=$CLOUDRON_MYSQL_HOST $CLOUDRON_MYSQL_DATABASE`

## postgresql

PostgreSQL 14.9. Supported extensions: `btree_gist`, `btree_gin`, `citext`, `hstore`, `pgcrypto`, `pg_trgm`, `postgis`, `uuid-ossp`, `unaccent`, `vector`, `vectors`, and more.

| Env var | Description |
|---------|-------------|
| `CLOUDRON_POSTGRESQL_URL` | Full connection URL |
| `CLOUDRON_POSTGRESQL_USERNAME` | Database username |
| `CLOUDRON_POSTGRESQL_PASSWORD` | Database password |
| `CLOUDRON_POSTGRESQL_HOST` | Database host |
| `CLOUDRON_POSTGRESQL_PORT` | Database port |
| `CLOUDRON_POSTGRESQL_DATABASE` | Database name |

| Option | Description |
|--------|-------------|
| `locale` | Set `LC_LOCALE` and `LC_CTYPE` at database creation |

Debug: `PGPASSWORD=$CLOUDRON_POSTGRESQL_PASSWORD psql -h $CLOUDRON_POSTGRESQL_HOST -p $CLOUDRON_POSTGRESQL_PORT -U $CLOUDRON_POSTGRESQL_USERNAME -d $CLOUDRON_POSTGRESQL_DATABASE`

## mongodb

MongoDB 8.0.

| Env var | Description |
|---------|-------------|
| `CLOUDRON_MONGODB_URL` | Full connection URL |
| `CLOUDRON_MONGODB_USERNAME` | Database username |
| `CLOUDRON_MONGODB_PASSWORD` | Database password |
| `CLOUDRON_MONGODB_HOST` | Database host |
| `CLOUDRON_MONGODB_PORT` | Database port |
| `CLOUDRON_MONGODB_DATABASE` | Database name |
| `CLOUDRON_MONGODB_OPLOG_URL` | Oplog URL (only when oplog enabled) |

| Option | Description |
|--------|-------------|
| `oplog: true` | Enable oplog access |

## redis

Redis 8.4. Data is persistent.

| Env var | Description |
|---------|-------------|
| `CLOUDRON_REDIS_URL` | Full connection URL |
| `CLOUDRON_REDIS_HOST` | Redis host |
| `CLOUDRON_REDIS_PORT` | Redis port |
| `CLOUDRON_REDIS_PASSWORD` | Redis password |

| Option | Description |
|--------|-------------|
| `noPassword: true` | Skip password auth (safe: Redis is only reachable on internal Docker network) |

## ldap

LDAP v3 authentication. Cannot be added to an existing app — reinstall required.

| Env var | Description |
|---------|-------------|
| `CLOUDRON_LDAP_SERVER` | LDAP server |
| `CLOUDRON_LDAP_HOST` | LDAP host |
| `CLOUDRON_LDAP_PORT` | LDAP port |
| `CLOUDRON_LDAP_URL` | Full LDAP URL |
| `CLOUDRON_LDAP_USERS_BASE_DN` | Users base DN |
| `CLOUDRON_LDAP_GROUPS_BASE_DN` | Groups base DN |
| `CLOUDRON_LDAP_BIND_DN` | Bind DN |
| `CLOUDRON_LDAP_BIND_PASSWORD` | Bind password |

Suggested filter: `(&(objectclass=user)(|(username=%uid)(mail=%uid)))`

User attributes: `uid`, `cn`, `mail`, `displayName`, `givenName`, `sn`, `username`, `samaccountname`, `memberof`

Group attributes: `cn`, `gidnumber`, `memberuid`

## oidc

OpenID Connect authentication.

| Env var | Description |
|---------|-------------|
| `CLOUDRON_OIDC_PROVIDER_NAME` | Provider name |
| `CLOUDRON_OIDC_DISCOVERY_URL` | Discovery URL |
| `CLOUDRON_OIDC_ISSUER` | Issuer |
| `CLOUDRON_OIDC_AUTH_ENDPOINT` | Authorization endpoint |
| `CLOUDRON_OIDC_TOKEN_ENDPOINT` | Token endpoint |
| `CLOUDRON_OIDC_KEYS_ENDPOINT` | Keys endpoint |
| `CLOUDRON_OIDC_PROFILE_ENDPOINT` | Profile endpoint |
| `CLOUDRON_OIDC_CLIENT_ID` | Client ID |
| `CLOUDRON_OIDC_CLIENT_SECRET` | Client secret |

| Option | Description |
|--------|-------------|
| `loginRedirectUri` | Callback path (e.g. `/auth/openid/callback`). Multiple paths: comma-separated |
| `logoutRedirectUri` | Post-logout path |
| `tokenSignatureAlgorithm` | `RS256` (default) or `EdDSA` |

## sendmail

Outgoing email (SMTP relay).

| Env var | Description |
|---------|-------------|
| `CLOUDRON_MAIL_SMTP_SERVER` | SMTP server |
| `CLOUDRON_MAIL_SMTP_PORT` | SMTP port (STARTTLS disabled on this port) |
| `CLOUDRON_MAIL_SMTPS_PORT` | SMTPS port |
| `CLOUDRON_MAIL_SMTP_USERNAME` | SMTP username |
| `CLOUDRON_MAIL_SMTP_PASSWORD` | SMTP password |
| `CLOUDRON_MAIL_FROM` | From address |
| `CLOUDRON_MAIL_FROM_DISPLAY_NAME` | From display name (only when supportsDisplayName is set) |
| `CLOUDRON_MAIL_DOMAIN` | Mail domain |

| Option | Description |
|--------|-------------|
| `optional: true` | All env vars absent; app uses user-provided email config |
| `supportsDisplayName: true` | Enables `CLOUDRON_MAIL_FROM_DISPLAY_NAME` |
| `requiresValidCertificate: true` | Sets `CLOUDRON_MAIL_SMTP_SERVER` to FQDN |

## recvmail

Incoming email (IMAP/POP3). May be disabled if the server is not receiving email for the domain. Handle absent env vars.

| Env var | Description |
|---------|-------------|
| `CLOUDRON_MAIL_IMAP_SERVER` | IMAP server |
| `CLOUDRON_MAIL_IMAP_PORT` | IMAP port |
| `CLOUDRON_MAIL_IMAPS_PORT` | IMAPS port |
| `CLOUDRON_MAIL_POP3_PORT` | POP3 port |
| `CLOUDRON_MAIL_POP3S_PORT` | POP3S port |
| `CLOUDRON_MAIL_IMAP_USERNAME` | IMAP username |
| `CLOUDRON_MAIL_IMAP_PASSWORD` | IMAP password |
| `CLOUDRON_MAIL_TO` | To address |
| `CLOUDRON_MAIL_TO_DOMAIN` | To domain |

## email

Full email capabilities (SMTP + IMAP + ManageSieve). For webmail applications. Accept self-signed certificates for internal IMAP/Sieve connections.

| Env var | Description |
|---------|-------------|
| `CLOUDRON_EMAIL_SMTP_SERVER` | SMTP server |
| `CLOUDRON_EMAIL_SMTP_PORT` | SMTP port |
| `CLOUDRON_EMAIL_SMTPS_PORT` | SMTPS port |
| `CLOUDRON_EMAIL_STARTTLS_PORT` | STARTTLS port |
| `CLOUDRON_EMAIL_IMAP_SERVER` | IMAP server |
| `CLOUDRON_EMAIL_IMAP_PORT` | IMAP port |
| `CLOUDRON_EMAIL_IMAPS_PORT` | IMAPS port |
| `CLOUDRON_EMAIL_SIEVE_SERVER` | Sieve server |
| `CLOUDRON_EMAIL_SIEVE_PORT` | Sieve port |
| `CLOUDRON_EMAIL_DOMAIN` | Email domain |
| `CLOUDRON_EMAIL_DOMAINS` | Email domains (multiple) |
| `CLOUDRON_EMAIL_SERVER_HOST` | Server host |

## proxyauth

Authentication wall in front of the app. Reserves `/login` and `/logout` routes. Cannot be added to an existing app — reinstall required.

| Option | Description |
|--------|-------------|
| `path` | Restrict to a path (e.g. `/admin`). Prefix with `!` to exclude (e.g. `!/webhooks`) |
| `basicAuth` | Enable HTTP Basic auth (bypasses 2FA) |
| `supportsBearerAuth` | Forward `Bearer` tokens to the app |

## scheduler

Cron-like periodic tasks. Commands run in the app's environment (same env vars, access to `/tmp` and `/run`). 30-minute grace period per task.

```json
"scheduler": {
  "task_name": {
    "schedule": "*/5 * * * *",
    "command": "/app/code/task.sh"
  }
}
```

## tls

Certificate access for non-HTTP protocols. App restarts on certificate renewal.

| File | Description |
|------|-------------|
| `/etc/certs/tls_cert.pem` | TLS certificate (read-only) |
| `/etc/certs/tls_key.pem` | TLS private key (read-only) |

## turn

STUN/TURN service.

| Env var | Description |
|---------|-------------|
| `CLOUDRON_TURN_SERVER` | TURN server |
| `CLOUDRON_TURN_PORT` | TURN port |
| `CLOUDRON_TURN_TLS_PORT` | TURN TLS port |
| `CLOUDRON_TURN_SECRET` | TURN secret |

## docker

Create Docker containers (restricted). Only superadmins can install/exec apps with this addon. Restrictions: bind mounts under `/app/data` only, created containers join `cloudron` network, containers removed on app uninstall.

| Env var | Description |
|---------|-------------|
| `CLOUDRON_DOCKER_HOST` | Docker host (`tcp://<IP>:<port>`) |
