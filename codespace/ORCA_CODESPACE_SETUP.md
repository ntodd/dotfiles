# Orca on a GitHub Codespace — setup runbook

Paste this into a Claude Code session running **inside the new codespace**. It
sets up everything the codespace side needs for the Orca desktop app (running on
a Mac) to drive agents in git worktrees over Tailscale SSH.

Reference implementation: the `weigandconstruction/foundation` codespace, where
this is working today.

---

## 0. Read before doing anything

**What you get when this is done:** the Orca app on the Mac lists this codespace
as a host, creates git worktrees in it, opens a terminal pane per worktree, and
launches Claude/Codex in each pane with hooks reporting status back to the app.

**Two steps an agent cannot do.** Plan around them:

1. **Tailscale login.** Without a `TS_AUTHKEY`, `tailscale up` prints a browser
   URL and blocks. Ask the human to open it.
2. **Adding the host in the Orca app.** That is a click in the desktop UI on the
   Mac. Everything on the codespace side has to be finished first.

**Why none of this belongs in the devcontainer.** Tailscale joins a *personal*
tailnet under a personal identity, and the daemon needs `sudo` plus a persistent
state directory. Putting it in `.devcontainer/` would make every teammate's
codespace try to join, and would leak a personal auth key into a shared config.
It lives in `$HOME`, `/workspaces/.tailscale`, and the personal dotfiles repo.

The one exception is the **worktree cwd guard** in section 4. That one is a
Codespaces workaround with no personal identity attached, and it helps any
teammate who uses git worktrees whether or not they run Orca. It belongs in the
devcontainer. Add it to every repo you point Orca at — section 4 has a drop-in
lifecycle script and the `devcontainer.json` wiring.

**Decide the hostname now.** `setup-orca` defaults to `cs-<repo-name>`. If a
codespace for the same repo is already on the tailnet, Tailscale will silently
append a suffix (`cs-foundation-1`) and you will not be able to tell the two
hosts apart in the Orca app. Set `ORCA_TS_HOSTNAME` explicitly:

```bash
export ORCA_TS_HOSTNAME=cs-foundation-2   # or cs-<other-repo>
```

---

## 1. Inventory what is already here

```bash
echo "repo:      $GITHUB_REPOSITORY"
echo "codespace: $CODESPACE_NAME"
ls -d /workspaces/.codespaces/.persistedshare/dotfiles 2>/dev/null \
  && echo "dotfiles:  cloned" || echo "dotfiles:  MISSING"
command -v setup-orca tailscale node git
ls -la /dev/net/tun
sudo -n true && echo "sudo: passwordless"
```

What matters:

| Thing | Why | If missing |
|---|---|---|
| dotfiles clone | ships `bin/setup-orca` and `codespace/autostart.zsh` | enable dotfiles in GitHub → Settings → Codespaces, then rebuild; or run the commands in section 2 by hand |
| `node` | the Orca relay is a Node program; it looks for `/usr/local/bin/node` | add the `ghcr.io/devcontainers/features/node:2` feature, or `sudo apt-get install -y nodejs` |
| `/dev/net/tun` | kernel-mode Tailscale | not fatal, `setup-orca` falls back to userspace networking; inbound SSH still works |
| passwordless sudo | `tailscaled` runs as root | standard in Codespaces |

---

## 2. Tailscale

If the dotfiles clone is present, one command does the whole section:

```bash
ORCA_TS_HOSTNAME=cs-<pick-a-name> setup-orca
```

It is idempotent, so re-run it any time, and after every container rebuild. It
installs Tailscale, starts `tailscaled`, and joins the tailnet. That is all Orca
needs on the container side.

Non-interactive variant — set `TS_AUTHKEY` as a **personal** Codespaces secret
(Settings → Codespaces → Secrets, scoped to this repo) with a *reusable,
non-ephemeral* key from the Tailscale admin console. `setup-orca` picks it up
and skips the browser prompt. Ephemeral keys are wrong here: the node would be
removed from the tailnet when the daemon stops, and it needs to survive a
codespace stop/start.

### Doing it by hand

```bash
# install
curl -fsSL https://tailscale.com/install.sh | sh

# state in /workspaces, NOT /var/lib — /workspaces survives both a
# codespace stop/start and a full container rebuild, so the node keeps
# its identity and tailnet IP for the life of the codespace
sudo mkdir -p /workspaces/.tailscale && sudo chmod 700 /workspaces/.tailscale
sudo sh -c 'nohup tailscaled --statedir=/workspaces/.tailscale \
  >>/workspaces/.tailscale/tailscaled.log 2>&1 &'
sleep 3

# if the daemon died, the container has no usable TUN — retry with:
#   sudo sh -c 'nohup tailscaled --statedir=/workspaces/.tailscale \
#     --tun=userspace-networking >>/workspaces/.tailscale/tailscaled.log 2>&1 &'

sudo tailscale up --ssh --hostname="$ORCA_TS_HOSTNAME" \
  --operator="$USER" --accept-dns=false --accept-routes=false
```

Flag by flag:

- `--ssh` — this is what Orca connects over. Without it there is no sshd
  reachable on the tailnet and the Orca host will never come up.
- `--operator=$USER` — lets `vscode` run `tailscale status` without sudo, which
  the verification steps and Orca's own probes rely on.
- `--accept-dns=false` — MagicDNS rewrites `/etc/resolv.conf`. Inside a compose
  devcontainer that breaks resolution of sibling services (`db`, `neon-local`).
  Leave it off. The Mac resolves this host's MagicDNS name from its own side.
- `--accept-routes=false` — no reason to pull subnet routes into a container.

Verify:

```bash
tailscale status
tailscale ip -4
tailscale status --json --peers=false | grep -m1 DNSName
```

You want `BackendState: Running` and a `100.x.y.z` address. Note the DNSName —
that is what goes into the Orca app.

---

## 3. Restart the daemon after a stop/start

Processes die when a codespace stops; the disk survives. There is no systemd in
the container, so nothing brings `tailscaled` back. The dotfiles handle this in
`codespace/autostart.zsh`, which the dotfiles `zshrc` sources automatically
(it globs `$DOTFILES/**/*.zsh`, excluding `claude`, `script`, `bin`, `ghostty`).

Confirm it will fire:

```bash
grep -c tailscaled "$DOTFILES/codespace/autostart.zsh"
```

Without dotfiles, add the equivalent to `~/.zshrc`:

```bash
if [[ "$CODESPACES" == "true" ]] \
  && command -v tailscaled >/dev/null 2>&1 \
  && [[ -d /workspaces/.tailscale ]] \
  && ! pgrep -x tailscaled >/dev/null 2>&1; then
  echo "[codespace] restarting tailscaled"
  sudo sh -c 'nohup tailscaled --statedir=/workspaces/.tailscale \
    >>/workspaces/.tailscale/tailscaled.log 2>&1 &'
fi
```

The trigger is opening a shell after a resume. Open one VS Code terminal after
every start before expecting Orca to connect. There is no way around this
without a supervisor in the container.

---

## 4. The worktree cwd guard — do not skip this

**This is the step that makes worktrees actually work.** Skip it and Orca will
look completely healthy while quietly corrupting your work.

`/etc/zsh/zprofile` is Codespaces-managed and root-owned. It contains:

```sh
WORKING_DIRECTORY="/workspaces/<default-repo>"

if [ -z "$SHELL_LOGGED_IN" ] && [ ! "$TERM_PROGRAM" = "vscode" ]; then
  cd "$WORKING_DIRECTORY"
  export SHELL_LOGGED_IN=true
fi
```

Orca sets a pane's cwd to the worktree and then execs `zsh -l`. That `cd` throws
the worktree away and drops the pane — and the agent in it — into the primary
checkout. Every pane lands in the same directory. Several agents then share one
working tree and one index, edit each other's files, and commit to whichever
branch happens to be checked out there.

The symptom is silent. `git worktree list` still shows every worktree, the agent
starts, the prompt looks right. You find out later from a tangled history.

`~/.zshenv` is sourced *before* `/etc/zsh/zprofile`, so claiming the flag there
pre-empts the jump.

### If this is the `foundation` repo

Already handled. `.devcontainer/lifecycle/post-start.sh` rewrites the guard on
every container start. Just verify:

```bash
bash .devcontainer/lifecycle/test-worktree-cwd-guard.sh
```

### Every other repo — add it to the devcontainer

Do this rather than patching `$HOME` by hand. It survives rebuilds, it reinstalls
itself on every start, and teammates who use worktrees get the fix too.

Write `.devcontainer/lifecycle/install-worktree-cwd-guard.sh`:

```bash
#!/usr/bin/env bash
# Installs the worktree-cwd guard into $HOME. Wired to postStartCommand.
#
# /etc/zsh/zprofile is Codespaces-managed and root-owned. It force-cds every
# login shell to the default checkout unless SHELL_LOGGED_IN is set or
# TERM_PROGRAM=vscode. Terminals that open one pane per git worktree (Orca) set
# the pane cwd and then exec `zsh -l`, so that cd discards the worktree and
# drops the pane — and any agent in it — into the primary checkout. Several
# agents then share one working tree and one index.
#
# ~/.zshenv is sourced before /etc/zsh/zprofile, so claiming the flag there
# pre-empts the jump. A bare ssh login from $HOME still lands in the default
# checkout, which is the behaviour that made the jump useful.
#
# postStart, not onCreate: $HOME is not part of the image and is not carried
# into a prebuild, and postStart is the only phase that runs on both create and
# resume. Splitting the body into its own file and leaving only a stub in
# ~/.zshenv means a corrected body always wins on the next start.

set -euo pipefail

guard_dir="$HOME/.zshenv.d"
guard_file="$guard_dir/preserve-worktree-cwd.zsh"
stub_target="$HOME/.zshenv"

mkdir -p "$guard_dir"

cat >"$guard_file" <<'GUARD'
# Managed by .devcontainer/lifecycle/install-worktree-cwd-guard.sh — rewritten
# on every container start. Sourced from ~/.zshenv, so it runs before
# /etc/zsh/zprofile.
#
# Detection is a filesystem marker, not $CODESPACES, on purpose. A pane spawned
# by a remote terminal gets a sanitized environment without CODESPACES; that
# variable only appears once zprofile sources .env-secrets, which happens AFTER
# the cd this has to pre-empt. Gating on the variable leaves the guard inert in
# exactly the shells it exists for. The marker also keeps the file inert on a
# laptop that shares these dotfiles.
if [ -d /workspaces/.codespaces ] || [ "${CODESPACES:-}" = "true" ]; then
  case "$PWD" in
    /workspaces/*) export SHELL_LOGGED_IN=true ;;
  esac
fi
GUARD

# Idempotent: the body above is rewritten every start, the stub is appended once.
if ! grep -q 'zshenv\.d/preserve-worktree-cwd\.zsh' "$stub_target" 2>/dev/null; then
  cat >>"$stub_target" <<'STUB'

# codespaces: preserve-worktree-cwd — body in ~/.zshenv.d/preserve-worktree-cwd.zsh
# Managed by .devcontainer/lifecycle/install-worktree-cwd-guard.sh. Written as an
# `if` rather than `[ -r … ] && …` so a missing guard file does not leave a
# non-zero status behind for `zsh -e`.
if [ -r "$HOME/.zshenv.d/preserve-worktree-cwd.zsh" ]; then
  . "$HOME/.zshenv.d/preserve-worktree-cwd.zsh"
fi
STUB
fi

echo "✓ worktree cwd guard installed"
```

Foundation's copy of this also prunes inline guards left by an earlier revision
of the script. A repo adopting the split stub/body layout from the start never
has one, so that half is deliberately left out here.

Wire it into `devcontainer.json`:

```jsonc
"postStartCommand": {
  "worktree-guard": "bash .devcontainer/lifecycle/install-worktree-cwd-guard.sh"
}
```

If `postStartCommand` is already a plain string, convert it to the object form
and keep the existing command as a second key — object form runs the entries in
parallel and labels them in the creation log.

Then `chmod +x` the script and either rebuild the container or run it once by
hand for the current session.

Verify it the way the terminal actually starts a shell — `env -i`, not by
inheriting your interactive environment, where `CODESPACES` is already set and
the check passes for the wrong reason:

```bash
mkdir -p /workspaces/guard-probe
env -i HOME="$HOME" PATH=/usr/local/bin:/usr/bin:/bin TERM=xterm \
  sh -c 'cd /workspaces/guard-probe && exec zsh -l -c pwd'
# must print /workspaces/guard-probe
rmdir /workspaces/guard-probe
```

If it prints the default checkout path instead, the guard is not working. Stop
and fix it before connecting Orca.

### Fallback: a repo you cannot commit to

Run the same two heredocs directly in the codespace (`$stub_target` is
`~/.zshenv`, `$guard_dir` is `~/.zshenv.d`). It works, but `$HOME` does not
survive a container rebuild, so you have to remember to redo it. Use this only
while a PR against the repo's `.devcontainer/` is in flight.

The `$HOME` copy and the devcontainer copy are byte-compatible and both key off
the same stub line, so running one after the other is a no-op rather than a
conflict.

---

## 5. Connect from the Orca app (human does this)

Report the tailnet hostname and IP to the human, then hand off:

1. Orca → add a remote environment / SSH host.
2. Host: the MagicDNS name from section 2 (`cs-foundation-2.<tailnet>.ts.net`).
   User: `vscode`. No key or password — Tailscale SSH authenticates on tailnet
   identity.
3. Orca installs its relay into `~/.orca-remote/relay-<version>/` on first
   connect and drops a CLI shim at `~/.orca-relay/bin/orca`. Nothing to install
   by hand.
4. Register the repo — in the Orca UI, or from a pane in the codespace:

   ```bash
   orca repo add --path /workspaces/<repo>
   orca repo list --json
   ```

Worktrees land as siblings of the main checkout: `/workspaces/<repo>-<slug>`.
That is Orca's default and it is the right place — `/workspaces` is the mount
that survives stop/start.

Orca also injects its status hooks into `~/.claude/settings.json` on first
launch of a Claude pane. Expect that file to grow a large `hooks` block. If
`~/.claude/settings.json` is a symlink into the dotfiles repo, that shows up as
a diff to review and commit.

---

## 6. Worktrees do not share build artifacts

Each worktree is a full checkout with its own `deps/`, `_build/`, and
`assets/node_modules/`. Nothing is shared with the primary checkout. For an
Elixir app that means the first `mix test` in a new worktree pays a full
`deps.get` plus cold compile — several minutes.

Three options:

- **Do nothing.** Agents run `mix deps.get` themselves when a build fails. This
  is how the foundation codespace runs today.
- **Orca setup hook.** Orca app → repo settings → setup script. Runs on worktree
  creation. `mix deps.get && mix compile` is a reasonable body. Costs the same
  time, just moves it off the agent's critical path.
- **Copy from the primary checkout** in the setup hook. Fastest, but
  `_build` carries absolute paths and stale artifacts cause
  `dependency does not match the requirement` errors that look like a bad
  `mix.lock`. Only worth it if the cold-compile time is genuinely painful.

Also budget disk. Six worktrees of a mid-size Elixir app plus `_build` will run
past 20 GB. `hostRequirements.storage` in `devcontainer.json` should be 32 GB or
more.

---

## 7. Keep the codespace alive

GitHub's idle timer only counts activity on its own connections. Tailscale SSH
sessions are invisible to it, so the codespace stops out from under a
running agent even with a live session attached.

```bash
cs-keepalive 3h &
```

It loops a no-op `gh codespace ssh` against itself every five minutes. A
duration is required because the codespace bills the whole window.

---

## 8. Verification checklist

Run all of these before declaring it done:

```bash
# 1. daemon up, logged in
tailscale status | head -3

# 2. Tailscale SSH is on
tailscale debug prefs | grep -E '"RunSSH"|"Hostname"|"OperatorUser"'
#    RunSSH: true, Hostname: your chosen name, OperatorUser: vscode

# 3. state is in the durable location
sudo ls /workspaces/.tailscale/tailscaled.state

# 4. autostart will fire on resume
grep -c tailscaled "$DOTFILES/codespace/autostart.zsh"

# 5. worktree guard — present, and durable (see section 4 for the env -i probe)
[ -r ~/.zshenv.d/preserve-worktree-cwd.zsh ] && echo "guard installed"
ls .devcontainer/lifecycle/install-worktree-cwd-guard.sh 2>/dev/null \
  || echo "guard is NOT in the devcontainer — it will vanish on rebuild"

# 6. node is where the relay expects it
ls -l /usr/local/bin/node

# 7. after the Mac connects — relay is live
ls ~/.orca-remote/*/relay.js && orca status --json | head -20
```

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every Orca pane opens in the primary checkout | worktree cwd guard missing or inert | Section 4. Re-probe with `env -i`, not your interactive shell |
| Orca host shows offline after a resume | `tailscaled` did not restart | Open one VS Code terminal to trigger `autostart.zsh`; check `pgrep -x tailscaled` |
| `orca: command not found` | `~/.orca-relay/bin` is only on `PATH` inside Orca-spawned panes | Call `~/.orca-relay/bin/orca` directly, or add the dir to `PATH` |
| Relay shim exits with "cannot find the relay socket" | the Orca app is not connected | Reconnect from the Mac; the socket only exists while the app holds the SSH session |
| Tailscale asks for re-auth on connect | tailnet ACL uses `"action": "check"` for SSH | Change the SSH rule to `"action": "accept"` for `autogroup:self`, or raise `checkPeriod` |
| Two hosts named `cs-<repo>` and `cs-<repo>-1` | hostname collision with an existing codespace | `sudo tailscale up --hostname=<distinct>` and delete the stale node in the admin console |
| `gpg failed to sign the data`, or `gh` unauthenticated, in a relay shell | Codespaces injects `GITHUB_TOKEN` only via `/etc/zsh/zprofile` sourcing `.env-secrets`, and only for login shells with `SSH_CONNECTION` set | Make sure panes run `zsh -l`. Reproduce a suspected token problem with `env -u GITHUB_TOKEN <cmd>` before debugging the tool itself |
| `dependency does not match the requirement` in a fresh worktree | `_build` copied or stale relative to `deps/` | `rm -rf _build && mix deps.get` in that worktree |
| `tailscaled` will not start, log mentions TUN | no usable `/dev/net/tun` | Restart with `--tun=userspace-networking`; inbound SSH still works |
| A `mix` command sits at 0% CPU for minutes | another `mix` in a sibling worktree holds the `_build` lock | Wait, or find it with `pgrep -af mix` |

Daemon log: `/workspaces/.tailscale/tailscaled.log`.
Relay log: `~/.orca-remote/relay-*/relay.log`.

---

## Reference: what the working codespace looks like

```
tailscaled --statedir=/workspaces/.tailscale        # root, kernel TUN
  hostname cs-foundation, RunSSH true, OperatorUser vscode

/workspaces/foundation                              # primary checkout
/workspaces/foundation-<slug>                       # one per Orca worktree

~/.orca-remote/relay-<version>/                     # relay, auto-installed
~/.orca-relay/bin/orca                              # CLI shim
~/.orca/agent-hooks/{claude,codex}-hook.sh          # status reporting
~/.zshenv.d/preserve-worktree-cwd.zsh               # the guard
~/.claude/settings.json                             # Orca hook block injected here
```
