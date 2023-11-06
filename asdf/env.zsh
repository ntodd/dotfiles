# Run only if on MacOS and if asdf is installed
if [[ "$OSTYPE" == "darwin"* ]] && [[ -f "/opt/homebrew/opt/asdf/libexec/asdf.sh" ]]; then
  source /opt/homebrew/opt/asdf/libexec/asdf.sh
fi
