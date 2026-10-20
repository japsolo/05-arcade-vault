#!/usr/bin/env bash
# PostToolUse (Write|Edit|MultiEdit): formatea con Prettier y pasa ESLint al fichero escrito.
# Si quedan errores de lint, sale con 2 para devolvérselos a Claude.

f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

[ -n "$f" ] && [ -f "$f" ] || exit 0
case "$f" in
	"$root"/node_modules/* | "$root"/.next/* | "$root"/references/*) exit 0 ;;
	"$root"/*) ;;
	*) exit 0 ;;
esac

cd "$root" || exit 0

node_modules/.bin/prettier --write --ignore-unknown --log-level warn "$f" >&2

case "$f" in
	*.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs)
		if ! out=$(node_modules/.bin/eslint --fix "$f" 2>&1); then
			echo "ESLint encontró problemas en $f:" >&2
			echo "$out" >&2
			exit 2
		fi
		;;
esac

exit 0
