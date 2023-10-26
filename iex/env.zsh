# Scrollback in iex
export ERL_AFLAGS="-kernel shell_history enabled"

# Fix "OTP compiled without EEP48 documentation chunks" issue
export KERL_BUILD_DOCS=yes

# Default Erlang install without Java
export KERL_CONFIGURE_OPTIONS="--disable-debug --without-javac"
