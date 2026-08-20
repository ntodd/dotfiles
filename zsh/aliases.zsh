alias reload='source ~/.zshrc'

# Reset the mouse after a remote tmux disconnect
alias resetmouse='printf '"'"'\e[?1000l'"'"

# Run omp inside the Agent Safehouse sandbox (Seatbelt is macOS-only)
if [[ "$OSTYPE" == darwin* ]]; then
  alias omp='safehouse --add-dirs="$HOME/.omp" --enable=chromium-headless,keychain omp'
fi
