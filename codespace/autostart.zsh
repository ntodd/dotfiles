# Restart tailscaled after a codespace stop/start so Orca can reach the box.
# Processes die when a codespace stops; disk survives. This is a cheap no-op
# unless bin/setup-orca has been run in this codespace, so it costs nothing in
# codespaces (or machines) where it hasn't. After a container REBUILD the binary
# is gone too, so run setup-orca again instead.
if [[ "$CODESPACES" == "true" ]]; then
  if command -v tailscaled >/dev/null 2>&1 \
    && [[ -d /workspaces/.tailscale ]] \
    && ! pgrep -x tailscaled >/dev/null 2>&1; then
    echo "[codespace] restarting tailscaled"
    sudo sh -c 'nohup tailscaled --statedir=/workspaces/.tailscale >>/workspaces/.tailscale/tailscaled.log 2>&1 &'
  fi
fi
