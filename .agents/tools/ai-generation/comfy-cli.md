---
description: ComfyUI management via comfy-cli — install, launch, nodes, models, workflows
mode: subagent
model: sonnet
tools:
  read: true
  write: false
  edit: false
  bash: true
  glob: false
  grep: false
  webfetch: true
  task: false
---

# @comfy-cli - ComfyUI Automation

<!-- AI-CONTEXT-START -->

## Quick Reference

- **CLI**: `comfy-cli-helper.sh [command]`
- **Install**: `pip install comfy-cli` or `brew install comfy-org/comfy-cli/comfy-cli`
- **Docs**: <https://docs.comfy.org/comfy-cli/getting-started>
- **Repo**: <https://github.com/Comfy-Org/comfy-cli>
- **Shell completion**: `comfy --install-completion`
- **Prerequisites**: Python >= 3.9, git, CUDA or ROCm (GPU)

**When to use**: Installing/managing ComfyUI instances, custom nodes, models, environment snapshots, workflow dependencies, launching with custom flags.

<!-- AI-CONTEXT-END -->

## Setup

```bash
pip install comfy-cli          # or: brew install comfy-org/comfy-cli/comfy-cli
comfy --install-completion

conda create -n comfy-env python=3.11 && conda activate comfy-env
comfy install                  # install ComfyUI into current env
```

## Commands

### Core

| Command | Description |
|---------|-------------|
| `comfy install` | Install ComfyUI |
| `comfy launch` | Start ComfyUI server |
| `comfy launch -- --listen 0.0.0.0 --port 8188` | Launch with custom flags |

### Custom Nodes

| Command | Description |
|---------|-------------|
| `comfy node install/uninstall/update/reinstall <name>` | Manage a node |
| `comfy node enable/disable <name>` | Toggle node without removing |
| `comfy node show <filter>` | List nodes (`installed`, `enabled`, `disabled`, `not-installed`, `all`, `snapshot`, `snapshot-list`) |
| `comfy node fix <name>` | Fix dependencies for a node |
| `comfy node install-deps` | Install deps from spec file |

### Models

| Command | Description |
|---------|-------------|
| `comfy model download --url <url> [--relative-path models/loras]` | Download model (optionally to specific folder) |
| `comfy model list [--relative-path models/loras]` | List downloaded models |
| `comfy model remove --model-names "model.safetensors"` | Remove a model |

### Snapshots & Workflow Dependencies

| Command | Description |
|---------|-------------|
| `comfy node save-snapshot [--output snap.json]` | Save environment snapshot |
| `comfy node restore-snapshot <path>` | Restore from snapshot |
| `comfy node restore-dependencies` | Restore all node dependencies |
| `comfy node deps-in-workflow --workflow flow.json --output deps.json` | Extract workflow deps |
| `comfy node install-deps --workflow flow.json` | Install deps from workflow |
| `comfy node install-deps --deps deps.json` | Install deps from spec file |

### Tracking & Node Options

`comfy tracking disable/enable` — toggle usage analytics.

All node subcommands accept: `--channel TEXT` (operation mode), `--mode TEXT` (`remote`, `local`, or `cache`).

## Helper Script

`comfy-cli-helper.sh` wraps comfy-cli with aidevops conventions:

```bash
comfy-cli-helper.sh status                              # check if installed
comfy-cli-helper.sh install                             # install comfy-cli
comfy-cli-helper.sh setup [--path /path/to/comfyui]     # install ComfyUI
comfy-cli-helper.sh launch [--port 8188] [--listen 0.0.0.0]
comfy-cli-helper.sh node-install <node-name>
comfy-cli-helper.sh node-list [installed|all|enabled|disabled]
comfy-cli-helper.sh model-download <url> [relative-path]
comfy-cli-helper.sh model-list [relative-path]
comfy-cli-helper.sh snapshot-save [--output file.json]
comfy-cli-helper.sh snapshot-restore <file.json>
comfy-cli-helper.sh workflow-deps <workflow.json>
```

## Common Workflows

```bash
# Fresh setup
comfy-cli-helper.sh install && comfy-cli-helper.sh setup --path ~/comfyui && comfy-cli-helper.sh launch

# Reproduce a workflow (install deps + models, then launch)
comfy-cli-helper.sh workflow-deps workflow.json
comfy-cli-helper.sh model-download "https://civitai.com/api/download/models/12345" models/checkpoints
comfy-cli-helper.sh launch

# Environment backup/restore
comfy-cli-helper.sh snapshot-save --output my-setup.json
comfy-cli-helper.sh snapshot-restore my-setup.json       # on another machine
```

## Integration with aidevops

- **Content pipeline**: Used by `content/production/image.md` and `content/production/video.md` for local ComfyUI-based generation
- **Vision tools**: Complements `tools/vision/image-generation.md` for local model inference
- **Video tools**: Pairs with `tools/video/` for local video generation workflows
- **Model management**: Download and organize models referenced in workflow JSON files

## Related

- `tools/vision/overview.md` — Vision AI decision tree
- `tools/video/higgsfield.md` — Cloud-based AI generation
- `content/production/image.md` — Image production pipeline
- `content/production/video.md` — Video production pipeline
