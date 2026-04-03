#!/usr/bin/env bash

set -Eeuo pipefail

REMOTE_HOST="${REMOTE_HOST:-ubuntu@ec2-32-193-139-223.compute-1.amazonaws.com}"
SSH_KEY_PATH="${SSH_KEY_PATH:-/Users/juan/Downloads/keypardefault.pem}"
REMOTE_SCRIPT_PATH="${REMOTE_SCRIPT_PATH:-/home/ubuntu/deploy-scripts/deploy_aurorachat.sh}"
REMOTE_INSTALL_DIR="${REMOTE_INSTALL_DIR:-/home/ubuntu/deploy-scripts}"
BRANCH="${BRANCH:-main}"
DEPLOY_TYPE="${DEPLOY_TYPE:-}"
BUILD_SERVICES="${BUILD_SERVICES:-}"
DEPLOY_SERVICES="${DEPLOY_SERVICES:-}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  log "ERROR: $*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

choose_deploy_type() {
  if [[ -n "$DEPLOY_TYPE" ]]; then
    return 0
  fi

  echo "Escolha o tipo de deploy:"
  echo "1. frontend"
  echo "2. backend"
  echo "3. full"
  echo "4. custom"
  printf "Opcao: "
  read -r choice

  case "$choice" in
    1) DEPLOY_TYPE="frontend" ;;
    2) DEPLOY_TYPE="backend" ;;
    3) DEPLOY_TYPE="full" ;;
    4) DEPLOY_TYPE="custom" ;;
    *) die "Opcao invalida: $choice" ;;
  esac

  if [[ "$DEPLOY_TYPE" == "custom" ]]; then
    printf "Servicos para build (ex: web_server): "
    read -r BUILD_SERVICES
    printf "Servicos para restart (ex: web_server nginx): "
    read -r DEPLOY_SERVICES
  fi
}

main() {
  require_cmd git
  require_cmd ssh
  require_cmd rsync

  choose_deploy_type

  local current_branch
  current_branch="$(git branch --show-current)"
  [[ "$current_branch" == "$BRANCH" ]] || die "Switch to branch $BRANCH before running this script. Current branch: $current_branch"

  if ! git diff --quiet || ! git diff --cached --quiet; then
    die "Worktree has tracked changes. Commit or stash them before running the automated push+deploy flow."
  fi

  log "Pushing $BRANCH to origin."
  git push origin "$BRANCH"

  log "Syncing remote deploy script."
  rsync -av -e "ssh -i $SSH_KEY_PATH" \
    deployment/scripts/deploy_aurorachat.sh \
    "$REMOTE_HOST:$REMOTE_INSTALL_DIR/"

  log "Running remote deploy."
  ssh -i "$SSH_KEY_PATH" "$REMOTE_HOST" \
    "chmod +x '$REMOTE_SCRIPT_PATH' && NONINTERACTIVE=1 DEPLOY_TYPE='$DEPLOY_TYPE' BUILD_SERVICES='$BUILD_SERVICES' DEPLOY_SERVICES='$DEPLOY_SERVICES' '$REMOTE_SCRIPT_PATH'"
}

main "$@"
