---
description: Rotate to the next OAuth pool account for the Anthropic provider
agent: Build+
mode: subagent
---

Rotate the OAuth pool to use the next available account token.

## Workflow

1. Call the `model-accounts-pool` tool with `{"action": "rotate"}`
2. Report which account is now active
3. If rotation fails, report why (e.g., only one account, no active accounts)

## Notes

- The pool stores multiple Claude Max OAuth tokens in `~/.aidevops/oauth-pool.json`
- On rotation, the next account's token is injected into the built-in Anthropic provider
- Use `/model-accounts-pool list` to see all accounts
- Add accounts via Ctrl+A → Anthropic Pool in OpenCode
