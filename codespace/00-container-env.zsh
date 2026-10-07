# Import the container's env into shells that skipped PAM.
#
# Codespaces writes containerEnv (CODESPACES, DATABASE_URL, AWS_PROFILE,
# PLAYWRIGHT_BROWSERS_PATH, ...) to /etc/environment, and GitHub's sshd applies
# it through pam_env. Tailscale SSH, which Orca uses, has no PAM step, so an Orca
# pane starts with none of it: agents then think Chromium is missing and mix
# cannot find the database. Fill in whatever is still unset. Values that are
# already set win, so a VS Code terminal or a plain Codespaces ssh is untouched.
# (/etc/zsh/zprofile exports CODESPACES from .env-secrets first, so that
# variable cannot serve as the "PAM was skipped" signal.)
if [[ -r /etc/environment && -n "$SSH_CONNECTION" ]]; then
  while IFS= read -r line; do
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"
    [[ "$key" == [A-Za-z_]*([A-Za-z0-9_]) ]] || continue
    value="${line#*=}"
    value="${value#\"}"; value="${value%\"}"
    if [[ "$key" == PATH ]]; then
      for dir in ${(s.:.)value}; do
        [[ ":$PATH:" == *":$dir:"* ]] || PATH="$PATH:$dir"
      done
      export PATH
    elif [[ -z "${(P)key}" ]]; then
      export "$key=$value"
    fi
  done < /etc/environment
  unset line key value dir
fi
