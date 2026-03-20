/**
 * OAuth Multi-Account Pool (t1543)
 *
 * Enables multiple OAuth accounts per provider with automatic credential
 * rotation on rate limits (429). Stores credentials in a separate pool file
 * (~/.aidevops/oauth-pool.json) to avoid conflicts with OpenCode's auth.json.
 *
 * Architecture:
 *   - auth hook: registers "anthropic-pool" provider with OAuth login flow
 *   - loader: returns a custom fetch wrapper that rotates credentials on 429
 *   - tool: /model-accounts-pool for listing/removing accounts
 *
 * References:
 *   - Built-in auth plugin: opencode-anthropic-auth@0.0.13
 *   - OpenCode PR #11832 (upstream multi-account proposal)
 *   - Plugin API: @opencode-ai/plugin AuthHook type
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { createHash, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOME = homedir();
const POOL_FILE = join(HOME, ".aidevops", "oauth-pool.json");
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const TOKEN_ENDPOINT = "https://platform.claude.com/v1/oauth/token";
const OAUTH_AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";
const OAUTH_SCOPES = "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";

/** Default cooldown when rate limited (ms) */
const RATE_LIMIT_COOLDOWN_MS = 60_000;

/** Default cooldown on auth failure (ms) */
const AUTH_FAILURE_COOLDOWN_MS = 300_000;

/** Cooldown after a 429 on the token endpoint (ms) — 5 minutes */
const TOKEN_ENDPOINT_COOLDOWN_MS = 300_000;

// ---------------------------------------------------------------------------
// Token endpoint helpers
// ---------------------------------------------------------------------------

/**
 * In-memory timestamp of the last 429 from the token endpoint.
 * When set, all token endpoint calls are skipped until the cooldown expires.
 * This prevents hammering the endpoint and extending the rate limit window.
 * @type {number}
 */
let tokenEndpointCooldownUntil = 0;

/**
 * Fetch from the token endpoint. Single attempt with 429 cooldown gate.
 *
 * If a previous call got 429 within the cooldown window, this returns a
 * synthetic 429 response immediately — no network request made. This prevents
 * every session start from hitting the endpoint and extending the rate limit.
 *
 * @param {string} body - JSON string body
 * @param {string} context - description for logging
 * @returns {Promise<Response>}
 */
async function fetchTokenEndpoint(body, context) {
  // Check cooldown gate — skip the request entirely if rate limited recently
  const now = Date.now();
  if (tokenEndpointCooldownUntil > now) {
    const remainingSeconds = Math.ceil((tokenEndpointCooldownUntil - now) / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    console.error(
      `[aidevops] OAuth pool: ${context} skipped — token endpoint rate limited, cooldown ${remainingMinutes}m remaining. ` +
      `Use /model-accounts-pool reset-cooldowns to clear manually.`,
    );
    return new Response(null, { status: 429, statusText: "Rate Limited (cooldown)" });
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "claude-cli/2.1.80 (external, cli)",
    },
    body,
  });

  if (response.status === 429) {
    // Parse Retry-After header if present, otherwise use default cooldown
    const retryAfter = response.headers.get("retry-after");
    const cooldownMs = retryAfter
      ? Math.max(parseInt(retryAfter, 10) * 1000, TOKEN_ENDPOINT_COOLDOWN_MS)
      : TOKEN_ENDPOINT_COOLDOWN_MS;
    tokenEndpointCooldownUntil = Date.now() + cooldownMs;
    const cooldownMinutes = Math.ceil(cooldownMs / 60000);
    console.error(
      `[aidevops] OAuth pool: ${context} failed: rate limited by Anthropic. ` +
      `Cooldown set for ${cooldownMinutes}m — no further token requests until then. ` +
      `Use /model-accounts-pool reset-cooldowns to clear manually.`,
    );
  } else if (!response.ok) {
    console.error(`[aidevops] OAuth pool: ${context} failed: HTTP ${response.status}`);
  }

  return response;
}

// ---------------------------------------------------------------------------
// PKCE helpers (no external dependency — pure crypto)
// ---------------------------------------------------------------------------

/**
 * Generate a PKCE code verifier and challenge.
 * Uses crypto.randomBytes + SHA-256 — no dependency on @openauthjs/openauth.
 * @returns {{ verifier: string, challenge: string }}
 */
function generatePKCE() {
  const verifier = randomBytes(32)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9\-._~]/g, "")
    .slice(0, 128);
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

// ---------------------------------------------------------------------------
// Pool file I/O
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PoolAccount
 * @property {string} email
 * @property {string} refresh
 * @property {string} access
 * @property {number} expires
 * @property {string} added
 * @property {string} lastUsed
 * @property {"active"|"idle"|"rate-limited"|"auth-error"} status
 * @property {number|null} cooldownUntil
 */

/**
 * @typedef {Object} PoolData
 * @property {PoolAccount[]} [anthropic]
 */

/**
 * Load the pool file. Returns empty pool if file doesn't exist.
 * @returns {PoolData}
 */
function loadPool() {
  try {
    if (existsSync(POOL_FILE)) {
      const raw = readFileSync(POOL_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // Corrupted file — start fresh
  }
  return {};
}

/**
 * Save the pool file with 0600 permissions.
 * @param {PoolData} data
 */
function savePool(data) {
  try {
    const dir = dirname(POOL_FILE);
    mkdirSync(dir, { recursive: true });
    writeFileSync(POOL_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error(`[aidevops] OAuth pool: failed to save pool file: ${err.message}`);
  }
}

/**
 * Get accounts for a provider.
 * @param {string} provider
 * @returns {PoolAccount[]}
 */
function getAccounts(provider) {
  const pool = loadPool();
  return pool[provider] || [];
}

/**
 * Add or update an account in the pool.
 * If an account with the same email exists, it is updated (not duplicated).
 * @param {string} provider
 * @param {PoolAccount} account
 */
function upsertAccount(provider, account) {
  const pool = loadPool();
  if (!pool[provider]) pool[provider] = [];

  // Match by email. When email is "unknown" and there's exactly one existing
  // account (also "unknown"), replace it rather than creating duplicates.
  let idx = pool[provider].findIndex((a) => a.email === account.email);
  if (idx < 0 && account.email === "unknown") {
    const unknownIdx = pool[provider].findIndex((a) => a.email === "unknown");
    if (unknownIdx >= 0) idx = unknownIdx;
  }

  if (idx >= 0) {
    pool[provider][idx] = account;
  } else {
    pool[provider].push(account);
  }
  savePool(pool);
}

/**
 * Remove an account from the pool by email.
 * @param {string} provider
 * @param {string} email
 * @returns {boolean} true if removed
 */
function removeAccount(provider, email) {
  const pool = loadPool();
  if (!pool[provider]) return false;
  const before = pool[provider].length;
  pool[provider] = pool[provider].filter((a) => a.email !== email);
  if (pool[provider].length === before) return false;
  savePool(pool);
  return true;
}

/**
 * Update an account's status and cooldown in the pool.
 * @param {string} provider
 * @param {string} email
 * @param {Partial<PoolAccount>} patch
 */
function patchAccount(provider, email, patch) {
  const pool = loadPool();
  if (!pool[provider]) return;
  const account = pool[provider].find((a) => a.email === email);
  if (!account) return;
  Object.assign(account, patch);
  savePool(pool);
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

/**
 * Refresh an expired access token using the refresh token.
 * @param {PoolAccount} account
 * @returns {Promise<{access: string, refresh: string, expires: number} | null>}
 */
async function refreshAccessToken(account) {
  try {
    const response = await fetchTokenEndpoint(
      JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: account.refresh,
        client_id: CLIENT_ID,
      }),
      `refresh for ${account.email}`,
    );
    if (!response.ok) {
      // fetchTokenEndpoint already logged the error
      return null;
    }
    const json = await response.json();
    return {
      access: json.access_token,
      refresh: json.refresh_token,
      expires: Date.now() + json.expires_in * 1000,
    };
  } catch (err) {
    console.error(
      `[aidevops] OAuth pool: token refresh error for ${account.email}: ${err.message}`,
    );
    return null;
  }
}

/**
 * Ensure an account has a valid (non-expired) access token.
 * Refreshes if needed and updates the pool file.
 * @param {string} provider
 * @param {PoolAccount} account
 * @returns {Promise<string|null>} access token or null on failure
 */
async function ensureValidToken(provider, account) {
  if (account.access && account.expires > Date.now()) {
    return account.access;
  }
  const tokens = await refreshAccessToken(account);
  if (!tokens) {
    patchAccount(provider, account.email, {
      status: "auth-error",
      cooldownUntil: Date.now() + AUTH_FAILURE_COOLDOWN_MS,
    });
    return null;
  }
  patchAccount(provider, account.email, {
    access: tokens.access,
    refresh: tokens.refresh,
    expires: tokens.expires,
    status: "active",
    cooldownUntil: null,
  });
  account.access = tokens.access;
  account.refresh = tokens.refresh;
  account.expires = tokens.expires;
  return tokens.access;
}

// ---------------------------------------------------------------------------
// Account selection (rotation)
// ---------------------------------------------------------------------------

/**
 * Pick the best available account from the pool.
 * Skips accounts that are in cooldown. Prefers least-recently-used.
 * @param {string} provider
 * @returns {PoolAccount|null}
 */
function pickAccount(provider) {
  const accounts = getAccounts(provider);
  const now = Date.now();
  const available = accounts.filter(
    (a) => !a.cooldownUntil || a.cooldownUntil <= now,
  );
  if (available.length === 0) return null;
  // Sort by lastUsed ascending (least recently used first)
  available.sort(
    (a, b) => new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime(),
  );
  return available[0];
}

/**
 * Pick the next available account, excluding a specific email.
 * @param {string} provider
 * @param {string} excludeEmail
 * @returns {PoolAccount|null}
 */
function pickNextAccount(provider, excludeEmail) {
  const accounts = getAccounts(provider);
  const now = Date.now();
  const available = accounts.filter(
    (a) =>
      a.email !== excludeEmail &&
      (!a.cooldownUntil || a.cooldownUntil <= now),
  );
  if (available.length === 0) return null;
  available.sort(
    (a, b) => new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime(),
  );
  return available[0];
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Auth hook (registers the pool provider for account management only)
// ---------------------------------------------------------------------------

/**
 * Inject a pool token into the built-in "anthropic" provider's auth.json entry.
 * On session start, picks the least-recently-used account and writes its token
 * so the built-in provider uses it with all its SDK magic (headers, streaming, etc).
 * Also seeds a placeholder for the "anthropic-pool" provider (auth flow only).
 * @param {any} client - OpenCode SDK client
 */
export async function initPoolAuth(client) {
  // Seed the pool provider entry (for "Add Account" OAuth flow)
  try {
    const existing = await client.auth.get({ path: { id: "anthropic-pool" } });
    if (!existing?.data) {
      await client.auth.set({
        path: { id: "anthropic-pool" },
        body: { type: "pending", refresh: "", access: "", expires: 0 },
      });
      console.error("[aidevops] OAuth pool: seeded auth entry for anthropic-pool");
    }
  } catch {
    try {
      await client.auth.set({
        path: { id: "anthropic-pool" },
        body: { type: "pending", refresh: "", access: "", expires: 0 },
      });
      console.error("[aidevops] OAuth pool: seeded auth entry for anthropic-pool");
    } catch (err) {
      console.error(`[aidevops] OAuth pool: failed to seed auth entry: ${err.message}`);
    }
  }

  // Inject pool token into built-in anthropic provider
  await injectPoolToken(client);
}

/**
 * Pick the best pool account and inject its token into the built-in "anthropic"
 * provider's auth.json entry. The built-in provider handles all SDK magic.
 * @param {any} client - OpenCode SDK client
 * @param {string} [skipEmail] - email to skip (for rotation on 429)
 * @returns {boolean} true if a token was injected
 */
export async function injectPoolToken(client, skipEmail) {
  const accounts = getAccounts("anthropic");
  if (accounts.length === 0) return false;

  // Pick least-recently-used account, optionally skipping one
  let account = null;
  const sorted = [...accounts]
    .filter((a) => a.status === "active" && a.email !== skipEmail)
    .sort((a, b) => new Date(a.lastUsed || 0) - new Date(b.lastUsed || 0));

  if (sorted.length === 0) {
    // All accounts skipped or inactive — try any active account
    account = accounts.find((a) => a.status === "active");
  } else {
    account = sorted[0];
  }

  if (!account) return false;

  // Ensure token is valid (refresh if needed)
  const accessToken = await ensureValidToken("anthropic", account);
  if (!accessToken) {
    console.error(`[aidevops] OAuth pool: failed to get valid token for ${account.email}`);
    return false;
  }

  // Write to built-in anthropic provider's auth entry
  try {
    await client.auth.set({
      path: { id: "anthropic" },
      body: {
        type: "oauth",
        refresh: account.refresh,
        access: account.access,
        expires: account.expires,
      },
    });

    // Mark as used
    patchAccount("anthropic", account.email, {
      lastUsed: new Date().toISOString(),
      status: "active",
    });

    console.error(`[aidevops] OAuth pool: injected token for ${account.email} into built-in anthropic provider`);
    return true;
  } catch (err) {
    console.error(`[aidevops] OAuth pool: failed to inject token: ${err.message}`);
    return false;
  }
}

/**
 * Create the auth hook for the anthropic-pool provider.
 * This provider exists solely for the "Add Account to Pool" OAuth flow.
 * It has no models — users select models from the built-in "anthropic" provider,
 * which uses pool tokens injected into auth.json by initPoolAuth/injectPoolToken.
 * @param {any} client - OpenCode SDK client
 * @returns {import('@opencode-ai/plugin').AuthHook}
 */
export function createPoolAuthHook(client) {
  return {
    provider: "anthropic-pool",

    methods: [
      {
        get label() {
          const accounts = getAccounts("anthropic");
          if (accounts.length === 0) {
            return "Add Account to Pool (Claude Pro/Max)";
          }
          return `Add Account to Pool (${accounts.length} account${accounts.length === 1 ? "" : "s"})`;
        },
        type: "oauth",
        prompts: [
          {
            type: "text",
            key: "email",
            get message() {
              const accounts = getAccounts("anthropic");
              if (accounts.length === 0) {
                return "Account email";
              }
              const emails = accounts.map((a) => a.email).join(", ");
              return `Current: ${emails}\nNew account email`;
            },
            placeholder: "you@example.com",
            validate: (value) => {
              if (!value || !value.includes("@")) {
                return "Please enter a valid email address";
              }
              return undefined;
            },
          },
        ],
        authorize: async (inputs) => {
          const email = inputs?.email || "unknown";
          const pkce = generatePKCE();

          const url = new URL(OAUTH_AUTHORIZE_URL);
          url.searchParams.set("code", "true");
          url.searchParams.set("client_id", CLIENT_ID);
          url.searchParams.set("response_type", "code");
          url.searchParams.set("redirect_uri", REDIRECT_URI);
          url.searchParams.set("scope", OAUTH_SCOPES);
          url.searchParams.set("code_challenge", pkce.challenge);
          url.searchParams.set("code_challenge_method", "S256");
          url.searchParams.set("state", pkce.verifier);

          return {
            url: url.toString(),
            instructions: `Adding account: ${email}\nPaste the authorization code here: `,
            method: "code",
            callback: async (code) => {
              const hashIdx = code.indexOf("#");
              const authCode = hashIdx >= 0 ? code.substring(0, hashIdx) : code;
              const state = hashIdx >= 0 ? code.substring(hashIdx + 1) : undefined;

              const result = await fetchTokenEndpoint(
                JSON.stringify({
                  code: authCode,
                  state,
                  grant_type: "authorization_code",
                  client_id: CLIENT_ID,
                  redirect_uri: REDIRECT_URI,
                  code_verifier: pkce.verifier,
                }),
                "token exchange",
              );

              if (!result.ok) {
                return { type: "failed" };
              }

              const json = await result.json();

              // Resolve account email from user profile if prompts were skipped
              let resolvedEmail = email;
              if (resolvedEmail === "unknown" && json.access_token) {
                const profileEndpoints = [
                  "https://console.anthropic.com/api/auth/user",
                  "https://api.anthropic.com/api/auth/user",
                ];
                for (const endpoint of profileEndpoints) {
                  try {
                    const profileResp = await fetch(endpoint, {
                      headers: {
                        "Authorization": `Bearer ${json.access_token}`,
                        "User-Agent": "claude-cli/2.1.80 (external, cli)",
                      },
                      redirect: "follow",
                    });
                    if (profileResp.ok) {
                      const profile = await profileResp.json();
                      const found = profile.email || profile.email_address
                        || profile.user?.email || profile.account?.email;
                      if (found) {
                        resolvedEmail = found;
                        console.error(`[aidevops] OAuth pool: resolved email ${found} from ${endpoint}`);
                        break;
                      }
                    }
                  } catch {
                    // Try next endpoint
                  }
                }
                if (resolvedEmail === "unknown") {
                  console.error("[aidevops] OAuth pool: could not resolve email from profile API — account stored as 'unknown'");
                }
              }

              upsertAccount("anthropic", {
                email: resolvedEmail,
                refresh: json.refresh_token,
                access: json.access_token,
                expires: Date.now() + json.expires_in * 1000,
                added: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                status: "active",
                cooldownUntil: null,
              });

              const totalAccounts = getAccounts("anthropic").length;
              console.error(
                `[aidevops] OAuth pool: added ${resolvedEmail} (${totalAccounts} account${totalAccounts === 1 ? "" : "s"} total)`,
              );

              // Inject the new token into the built-in anthropic provider
              await injectPoolToken(client);

              return {
                type: "success",
                refresh: json.refresh_token,
                access: json.access_token,
                expires: Date.now() + json.expires_in * 1000,
              };
            },
          };
        },
      },
    ],
  };
}

/**
 * Register the anthropic-pool provider (auth-only, no models).
 * This provider exists solely to provide the "Add Account to Pool" OAuth flow.
 * Models are served by the built-in "anthropic" provider, which uses pool tokens
 * injected into auth.json.
 * @param {any} config - OpenCode config object
 * @returns {number} 1 if registered, 0 if already exists
 */
export function registerPoolProvider(config) {
  if (!config.provider) config.provider = {};
  if (config.provider["anthropic-pool"]) return 0;

  config.provider["anthropic-pool"] = {
    name: "Anthropic Pool (Account Management)",
    npm: "@ai-sdk/anthropic",
    api: "https://api.anthropic.com/v1",
    models: {},
  };

  return 1;
}

// ---------------------------------------------------------------------------
// Custom tool: /model-accounts-pool
// ---------------------------------------------------------------------------

/**
 * Create the model-accounts-pool tool definition.
 * @param {any} client - OpenCode SDK client (for token injection)
 * @returns {import('@opencode-ai/plugin').ToolDefinition}
 */
export function createPoolTool(client) {
  return {
    description:
      "Manage OAuth account pool for provider credential rotation. " +
      "Use 'list' to see all accounts and their status, " +
      "'rotate' to switch to the next pool account, " +
      "'remove <email>' to remove an account, " +
      "'status' for rotation statistics. " +
      "The agent should route natural language requests about managing " +
      "provider accounts, OAuth pools, or credential rotation to this tool.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "remove", "status", "reset-cooldowns"],
          description:
            "Action to perform: list accounts, remove an account, show status, or reset cooldowns",
        },
        email: {
          type: "string",
          description: "Account email (required for 'remove' action)",
        },
        provider: {
          type: "string",
          description: "Provider name (default: anthropic)",
        },
      },
      required: ["action"],
    },
    async execute(args) {
      const provider = args.provider || "anthropic";
      const accounts = getAccounts(provider);

      switch (args.action) {
        case "list": {
          if (accounts.length === 0) {
            return `No accounts in the ${provider} pool.\n\nTo add an account: run \`opencode auth login\` and select "Anthropic Pool".`;
          }
          const now = Date.now();
          const lines = accounts.map((a, i) => {
            const cooldown =
              a.cooldownUntil && a.cooldownUntil > now
                ? ` (cooldown: ${Math.ceil((a.cooldownUntil - now) / 60000)}m remaining)`
                : "";
            const lastUsed = a.lastUsed
              ? ` | last used: ${new Date(a.lastUsed).toLocaleString()}`
              : "";
            return `${i + 1}. ${a.email} [${a.status}]${cooldown}${lastUsed}`;
          });
          return `${provider} pool (${accounts.length} account${accounts.length === 1 ? "" : "s"}):\n\n${lines.join("\n")}`;
        }

        case "remove": {
          if (!args.email) {
            return "Error: email is required for remove action. Usage: remove <email>";
          }
          const removed = removeAccount(provider, args.email);
          if (removed) {
            const remaining = getAccounts(provider).length;
            return `Removed ${args.email} from ${provider} pool (${remaining} account${remaining === 1 ? "" : "s"} remaining).`;
          }
          return `Account ${args.email} not found in ${provider} pool.`;
        }

        case "status": {
          if (accounts.length === 0) {
            return `No accounts in the ${provider} pool.`;
          }
          const now = Date.now();
          const active = accounts.filter(
            (a) => a.status === "active" || a.status === "idle",
          ).length;
          const rateLimited = accounts.filter(
            (a) =>
              a.status === "rate-limited" &&
              a.cooldownUntil &&
              a.cooldownUntil > now,
          ).length;
          const authError = accounts.filter(
            (a) => a.status === "auth-error",
          ).length;
          const available = accounts.filter(
            (a) => !a.cooldownUntil || a.cooldownUntil <= now,
          ).length;

          const tokenGated = tokenEndpointCooldownUntil > now;
          const tokenGateInfo = tokenGated
            ? `  TOKEN ENDPOINT: RATE LIMITED (${Math.ceil((tokenEndpointCooldownUntil - now) / 60000)}m remaining)`
            : `  Token endpoint: OK`;

          return [
            `${provider} pool status:`,
            `  Total accounts: ${accounts.length}`,
            `  Available now:  ${available}`,
            `  Active/idle:    ${active}`,
            `  Rate limited:   ${rateLimited}`,
            `  Auth errors:    ${authError}`,
            "",
            tokenGateInfo,
            `Pool file: ${POOL_FILE}`,
          ].join("\n");
        }

        case "reset-cooldowns": {
          // Reset token endpoint cooldown (in-memory)
          const wasGated = tokenEndpointCooldownUntil > Date.now();
          tokenEndpointCooldownUntil = 0;

          // Reset per-account cooldowns (pool file)
          const pool = loadPool();
          let resetCount = 0;
          if (pool[provider]) {
            for (const account of pool[provider]) {
              if (account.cooldownUntil) {
                account.cooldownUntil = null;
                account.status = "idle";
                resetCount++;
              }
            }
            savePool(pool);
          }

          const parts = [];
          if (wasGated) parts.push("token endpoint cooldown cleared");
          if (resetCount > 0) parts.push(`${resetCount} account cooldown${resetCount === 1 ? "" : "s"} cleared`);
          if (parts.length === 0) parts.push("no active cooldowns");
          return `Reset: ${parts.join(", ")}. Token endpoint requests will proceed on next attempt.`;
        }

        case "rotate": {
          if (accounts.length < 2) {
            return `Cannot rotate: only ${accounts.length} account(s) in pool. Add more accounts via Ctrl+A → Anthropic Pool.`;
          }

          // Find which account is currently injected (most recently used)
          const current = [...accounts].sort(
            (a, b) => new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0),
          )[0];

          const injected = await injectPoolToken(client, current?.email);
          if (injected) {
            // Find which account was injected
            const nowAccounts = getAccounts(provider);
            const newest = [...nowAccounts].sort(
              (a, b) => new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0),
            )[0];
            return `Rotated: now using ${newest?.email || "unknown"}. Previous: ${current?.email || "unknown"}.`;
          }
          return "Rotation failed — no other active accounts available.";
        }

        default:
          return `Unknown action: ${args.action}. Available: list, rotate, remove, status, reset-cooldowns`;
      }
    },
  };
}
