EDITOR_CHOICE='vim'

# Check if the Helix editor (hx) exists in PATH
# If so, use it instead
if which hx >/dev/null 2>&1; then
  EDITOR_CHOICE='hx'
fi

# Export the EDITOR variable
export EDITOR=$EDITOR_CHOICE

unset EDITOR_CHOICE
