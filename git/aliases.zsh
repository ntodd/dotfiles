alias gl='git pull'
alias gp='git push'
alias gco='git checkout'
alias gb='git branch'
alias g='git status --short'
alias glog="git log --graph --pretty=format':%C(yellow)%h%Cblue%d%Creset %s %C(white) %an, %ar%Creset'"

# Git branch - show all local branches merged into main
alias gbm='git branch --merged main | grep -vE "^\*|main|master|develop"'

# Git branch - delete all local branches merged into main
alias gbdm='gbm | xargs -n 1 git branch -d'
