# Bash 3.2 Compatibility — Detail Reference

Loaded on-demand when writing or reviewing shell scripts.
Core pointer is in `prompts/build.txt` "Bash 3.2 Compatibility".

macOS ships bash 3.2.57. All shell scripts MUST work on this version.
Bash 4.0+ features silently crash or produce wrong results on 3.2 — no
error message, just broken behaviour. This has caused repeated production
failures (pulse dispatch, worktree cleanup, dataset helpers, routine scheduler).

## Forbidden Features (bash 4.0+)

| Feature | Replacement |
|---------|-------------|
| `declare -A` / `local -A` (associative arrays) | Parallel indexed arrays or grep-based lookup |
| `mapfile` / `readarray` | `while IFS= read -r line; do arr+=("$line"); done < <(cmd)` |
| `${var,,}` / `${var^^}` (case conversion) | `tr '[:upper:]' '[:lower:]'` or `tr '[:lower:]' '[:upper:]'` |
| `${var:offset:length}` negative offsets | `${var: -N}` (space before minus) or string manipulation |
| `\|&` (pipe stderr) | `2>&1 \|` |
| `&>>` (append both) | `>> file 2>&1` |
| `declare -n` / `local -n` (namerefs) | eval or indirect expansion `${!var}` |
| `[[ $var =~ regex ]]` with stored regex in variables | Test directly on 3.2 — behaviour differs |

## Subshell and Command Substitution Traps

- `$()` captures ALL stdout — never mix `tee` or command output with exit code capture in `$()`. Write exit codes to a temp file instead:

  ```bash
  printf '%s' "$?" > "$exit_code_file"
  ```

- `local -a arr=()` inside `$()` subshells — `local` in a subshell not inside a function is undefined in 3.2.
- `PIPESTATUS` — available in 3.2 but only for the immediately preceding pipeline in the current shell. Inside `$()` it reflects the subshell's pipeline, not the parent's. Capture it immediately:

  ```bash
  cmd1 | cmd2; local ps=("${PIPESTATUS[@]}")
  ```

## Array Passing Across Process Boundaries

Arrays cannot cross subshell, `$()`, or pipe boundaries as arrays. They flatten to strings.

- **To pass an array to a subprocess**: pass elements as separate positional arguments (`"${arr[@]}"`), never as a single escaped string (`printf -v str '%q ' "${arr[@]}"` then `"$str"` — the subprocess receives one argument, not many).
- **To receive array results from a subprocess**: write to a temp file (one element per line), then read back with `while read` loop.

## Escape Sequence Quoting (recurring production-breaking bug)

Bash double quotes do NOT interpret `\t` `\n` `\r` as whitespace. They are literal
two-character sequences (backslash + letter). This is unlike C, Python, JS,
and most other languages. Agents repeatedly write `"\t"` expecting a tab —
this produces broken XML/plist/JSON/YAML and is invisible until runtime.

| Expression | Result | Use for |
|------------|--------|---------|
| `"\t"` | Literal backslash-t (TWO characters) | Nothing — avoid |
| `$'\t'` | Actual tab character | Tab in strings |
| `"\n"` | Literal backslash-n (TWO characters) | Nothing — avoid |
| `$'\n'` | Actual newline character | Newline in strings |

- For string concatenation with variables: `var+=$'\t'"${value}"` (ANSI-C quote for the tab, then double-quote for the variable expansion).
- Inside heredocs (`<<EOF`), tabs are literal tab characters (typed or pasted) — `\t` is NOT interpreted. This is correct and safe.
- `echo -e "\t"` interprets escapes but is non-portable. Prefer `printf '\t'`.
- `printf '%s\t%s' "$a" "$b"` is the safest portable way to embed tabs.
- When building XML/plist/JSON via string concatenation, ALWAYS use `$'\t'` for indentation — never `"\t"`. A single `"\t"` in a plist makes it unparseable and silently kills launchd jobs.

## Safe Patterns

- Test scripts with `/bin/bash` (not `/opt/homebrew/bin/bash`) to catch 4.0+ usage.
- When in doubt, check: `bash --version` on macOS gives 3.2.57.
- ShellCheck does NOT catch most bash version incompatibilities — manual review required.
- ShellCheck does NOT catch `"\t"` vs `$'\t'` — both are valid bash, just different semantics.
