#!/usr/bin/env bash
# Configuration functions: setup_configs, set_permissions, ssh, aidevops-cli, opencode-config, claude-config, validate, extract-prompts, drift-check
# Part of aidevops setup.sh modularization (t316.3)

# Shell safety baseline
set -Eeuo pipefail
IFS=$'\n\t'
# shellcheck disable=SC2154  # rc is assigned by $? in the trap string
trap 'rc=$?; echo "[ERROR] ${BASH_SOURCE[0]}:${LINENO} exit $rc" >&2' ERR
shopt -s inherit_errexit 2>/dev/null || true

setup_configs() {
	print_info "Setting up configuration files..."

	# Create configs directory if it doesn't exist
	mkdir -p configs

	# Copy template configs if they don't exist
	for template in configs/*.txt; do
		if [[ -f "$template" ]]; then
			config_file="${template%.txt}"
			if [[ ! -f "$config_file" ]]; then
				cp "$template" "$config_file"
				print_success "Created $(basename "$config_file")"
				print_warning "Please edit $(basename "$config_file") with your actual credentials"
			else
				print_info "Found existing config: $(basename "$config_file") - Skipping"
			fi
		fi
	done

	return 0
}

install_aidevops_cli() {
	print_info "Installing aidevops CLI command..."

	local script_dir
	script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	local cli_source="$script_dir/aidevops.sh"
	local cli_target="/usr/local/bin/aidevops"

	if [[ ! -f "$cli_source" ]]; then
		print_warning "aidevops.sh not found - skipping CLI installation"
		return 0
	fi

	# Check if we can write to /usr/local/bin
	if [[ -w "/usr/local/bin" ]]; then
		# Direct symlink
		ln -sf "$cli_source" "$cli_target"
		print_success "Installed aidevops command to $cli_target"
	elif [[ -w "$HOME/.local/bin" ]] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
		# Use ~/.local/bin instead
		cli_target="$HOME/.local/bin/aidevops"
		ln -sf "$cli_source" "$cli_target"
		print_success "Installed aidevops command to $cli_target"

		# Check if ~/.local/bin is in PATH and add it if not
		if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
			add_local_bin_to_path
		fi
	else
		# Need sudo
		print_info "Installing aidevops command requires sudo..."
		if sudo ln -sf "$cli_source" "$cli_target"; then
			print_success "Installed aidevops command to $cli_target"
		else
			print_warning "Could not install aidevops command globally"
			print_info "You can run it directly: $cli_source"
		fi
	fi

	return 0
}

# Helper: check for a generator script, run it, report result consistently
_run_generator() {
	local script_path="$1"
	local info_msg="$2"
	local success_msg="$3"
	local failure_msg="$4"
	shift 4
	local script_args=("$@")

	if [[ ! -f "$script_path" ]]; then
		print_warning "Generator script not found: $script_path"
		return 0
	fi

	print_info "$info_msg"
	# Use ${arr[@]+"${arr[@]}"} pattern for safe expansion under set -u when array may be empty
	if bash "$script_path" ${script_args[@]+"${script_args[@]}"}; then
		print_success "$success_msg"
	else
		print_warning "$failure_msg"
	fi

	return 0
}

update_opencode_config() {
	# Respect config (env var or config file)
	if ! is_feature_enabled manage_opencode_config 2>/dev/null; then
		print_info "OpenCode config management disabled via config (integrations.manage_opencode_config)"
		return 0
	fi

	print_info "Updating OpenCode configuration..."

	# Use unified generator (t1665.4) if available, fall back to legacy scripts
	if [[ -f ".agents/scripts/generate-runtime-config.sh" ]]; then
		_run_generator ".agents/scripts/generate-runtime-config.sh" \
			"Generating OpenCode configuration (unified)..." \
			"OpenCode configuration complete (agents, commands, MCPs, prompts)" \
			"OpenCode configuration encountered issues" \
			all --runtime opencode
	else
		# Legacy fallback — remove after one release cycle
		_run_generator ".agents/scripts/generate-opencode-commands.sh" \
			"Generating OpenCode commands..." \
			"OpenCode commands configured" \
			"OpenCode command generation encountered issues"

		_run_generator ".agents/scripts/generate-opencode-agents.sh" \
			"Generating OpenCode agent configuration..." \
			"OpenCode agents configured (11 primary in JSON, subagents as markdown)" \
			"OpenCode agent generation encountered issues"

		_run_generator ".agents/scripts/subagent-index-helper.sh" \
			"Regenerating subagent index..." \
			"Subagent index regenerated" \
			"Subagent index generation encountered issues" \
			generate
	fi

	return 0
}

update_claude_config() {
	# Respect config (env var or config file)
	if ! is_feature_enabled manage_claude_config 2>/dev/null; then
		print_info "Claude config management disabled via config (integrations.manage_claude_config)"
		return 0
	fi

	print_info "Updating Claude Code configuration..."

	# Use unified generator (t1665.4) if available, fall back to legacy scripts
	if [[ -f ".agents/scripts/generate-runtime-config.sh" ]]; then
		_run_generator ".agents/scripts/generate-runtime-config.sh" \
			"Generating Claude Code configuration (unified)..." \
			"Claude Code configuration complete (agents, commands, MCPs, prompts)" \
			"Claude Code configuration encountered issues" \
			all --runtime claude-code
	else
		# Legacy fallback — remove after one release cycle
		_run_generator ".agents/scripts/generate-claude-commands.sh" \
			"Generating Claude Code commands..." \
			"Claude Code commands configured" \
			"Claude Code command generation encountered issues"

		_run_generator ".agents/scripts/generate-claude-agents.sh" \
			"Generating Claude Code agent configuration..." \
			"Claude Code agents configured (MCPs, settings, commands)" \
			"Claude Code agent generation encountered issues"

		_run_generator ".agents/scripts/subagent-index-helper.sh" \
			"Regenerating subagent index..." \
			"Subagent index regenerated" \
			"Subagent index generation encountered issues" \
			generate
	fi

	return 0
}

# Unified runtime config update (t1665.4)
# Generates config for all installed runtimes in a single pass.
# Respects per-runtime manage_* feature flags (manage_opencode_config,
# manage_claude_config) and falls back to legacy scripts when the unified
# generator is not present (one-release-cycle migration window).
update_runtime_configs() {
	print_info "Updating runtime configurations..."

	if [[ ! -f ".agents/scripts/generate-runtime-config.sh" ]]; then
		# Legacy fallback — unified generator not yet present
		update_opencode_config
		update_claude_config
		return 0
	fi

	# Respect per-runtime opt-outs before invoking the unified generator
	local opencode_enabled=1
	local claude_enabled=1

	if ! is_feature_enabled manage_opencode_config 2>/dev/null; then
		print_info "OpenCode config management disabled via config (integrations.manage_opencode_config)"
		opencode_enabled=0
	fi

	if ! is_feature_enabled manage_claude_config 2>/dev/null; then
		print_info "Claude config management disabled via config (integrations.manage_claude_config)"
		claude_enabled=0
	fi

	if [[ "$opencode_enabled" -eq 0 && "$claude_enabled" -eq 0 ]]; then
		print_info "All runtime config management disabled — skipping"
		return 0
	fi

	# Build --runtime flags for enabled runtimes only
	local runtime_args=()
	if [[ "$opencode_enabled" -eq 1 && "$claude_enabled" -eq 1 ]]; then
		# Both enabled — generate for all runtimes
		runtime_args=("all")
	elif [[ "$opencode_enabled" -eq 1 ]]; then
		runtime_args=("all" "--runtime" "opencode")
	elif [[ "$claude_enabled" -eq 1 ]]; then
		runtime_args=("all" "--runtime" "claude-code")
	fi

	_run_generator ".agents/scripts/generate-runtime-config.sh" \
		"Generating configuration for all installed runtimes..." \
		"All runtime configurations updated" \
		"Runtime configuration encountered issues" \
		"${runtime_args[@]}"

	return 0
}
