alias gl='git pull'
alias gp='git push'
alias gco='git checkout'
alias gb='git branch'
alias g='git status --short'
alias glog="git log --graph --pretty=format':%C(yellow)%h%Cblue%d%Creset %s %C(white) %an, %ar%Creset'"

# Git branch - show all merged local branches
alias gbm="git branch --merged | grep -vE '^\*|main|master|develop'"

# Git branch - delete all local merged branches
alias gbdm="gbm | xargs -n 1 git branch -d"

# Cleanup local branches that have been merged to main
alias gbc='git branch --merged main | grep -v "\*" | grep -v "main" | grep -v "master" | xargs -n 1 git branch -d'
