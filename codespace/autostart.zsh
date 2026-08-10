# Restart the personal agent-env daemons after a codespace stop/start.
# Processes die when a codespace stops; disk survives. Everything here is a
# cheap no-op unless bin/setup-herdr has been run in this codespace, so it
# costs nothing in codespaces (or machines) where it hasn't.
if [[ "$CODESPACES" == "true" ]]; then
  if command -v tailscaled >/dev/null 2>&1 \
    && [[ -d /workspaces/.tailscale ]] \
    && ! pgrep -x tailscaled >/dev/null 2>&1; then
    echo "[codespace] restarting tailscaled"
    sudo sh -c 'nohup tailscaled --statedir=/workspaces/.tailscale >>/workspaces/.tailscale/tailscaled.log 2>&1 &'
  fi

  # probe reports real daemon state; pgrep -f would false-positive on any
  # process whose command line merely contains "moshi-hook serve"
  if command -v moshi-hook >/dev/null 2>&1 \
    && ! moshi-hook probe 2>/dev/null | grep -q '^running:.*true'; then
    (nohup moshi-hook serve >>"$HOME/.moshi-hook.log" 2>&1 &) >/dev/null 2>&1
  fi
fi
