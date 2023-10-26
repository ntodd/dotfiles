# Docker Compose
alias dc='CURRENT_UID=$(id -u):$(id -g) docker compose'
alias dcb='CURRENT_UID=$(id -u):$(id -g) docker compose build --parallel'
alias dcu='CURRENT_UID=$(id -u):$(id -g) docker compose up'
alias dcr='CURRENT_UID=$(id -u):$(id -g) docker compose run --rm'
alias dce='CURRENT_UID=$(id -u):$(id -g) docker compose exec'
