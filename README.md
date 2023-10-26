# Dotfiles

## Functionality

### Oh My ZSH

Oh My ZSH is installed on first run. Installation uses the curl method, so
if you are concerned about that, don't use this tool without modification.

### Tmux

Script does not install Tmux, but configures a Tmux environment and the Tmux
Plugin Manager and several plugins. Review `tmux/tmux.conf.symlink` for more info.

### Aliases

There are a number of very opinionated aliases throughout. See `*/aliases.zsh`
to review.

### Local Configuration

If `~/.localrc` exists, it will be sourced. You can put custom configuration and
environment variables there to keep them out of the dotfiles repo.

## Layout & Topics

The dotfiles are built around topic areas. If you're adding a new area to your
forked dotfiles — say, "NPM" — you can simply add an `npm` directory and put
files in there. Anything with an extension of `.zsh` will get automatically
included into your shell. Anything with an extension of `.symlink` will get
symlinked without extension into `$HOME` when you run `script/setup`.

- **bin/**: Anything in `bin/` will get added to your `$PATH` and be made
  available everywhere.
- **topic/\*.zsh**: Any files ending in `.zsh` get loaded into your
  environment.
- **topic/path.zsh**: Any file named `path.zsh` is loaded first and is
  expected to setup `$PATH` or similar.
- **topic/completion.zsh**: Any file named `completion.zsh` is loaded
  last and is expected to setup autocomplete.
- **topic/install.sh**: Any file named `install.sh` is executed when you run `script/install`. To avoid being loaded automatically, its extension is `.sh`, not `.zsh`.
- **topic/\*.symlink**: Any file ending in `*.symlink` gets symlinked into
  your `$HOME`. This is so you can keep all of those versioned in your dotfiles
  but still keep those autoloaded files in your home directory. These get
  symlinked in when you run `script/setup`.

## Installation

Run:

```sh
git clone https://github.com/ntodd/dotfiles.git ~/.dotfiles
cd ~/.dotfiles
script/setup
```

This will symlink the appropriate files in `.dotfiles` to your home directory.
Everything is configured and tweaked within `~/.dotfiles`.

## Codespaces

If you are using GitHub Codespaces dotfile integration, this repository should work as-is.

## Thanks

Initially forked from [holman/dotfiles](https://github.com/holman/dotfiles) with
many modifications.
