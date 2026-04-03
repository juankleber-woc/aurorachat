#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/aurorachat}"
COMPOSE_FILE="${COMPOSE_FILE:-deployment/docker_compose/docker-compose.yml}"
BRANCH="${BRANCH:-main}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://localhost:3000}"
HEALTHCHECK_EXPECTED_CODE="${HEALTHCHECK_EXPECTED_CODE:-200}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-60}"
HEALTHCHECK_SLEEP_SECONDS="${HEALTHCHECK_SLEEP_SECONDS:-5}"
DEPLOY_SERVICES="${DEPLOY_SERVICES:-api_server background web_server nginx}"
BUILD_SERVICES="${BUILD_SERVICES:-api_server background web_server}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"

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

run_compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

wait_for_healthcheck() {
  local attempt=1
  local status_code

  while (( attempt <= HEALTHCHECK_RETRIES )); do
    status_code="$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTHCHECK_URL" || true)"

    if [[ "$status_code" == "$HEALTHCHECK_EXPECTED_CODE" ]]; then
      log "Health check passed at $HEALTHCHECK_URL with status $status_code."
      return 0
    fi

    log "Health check attempt $attempt/$HEALTHCHECK_RETRIES returned ${status_code:-<no response>}; waiting ${HEALTHCHECK_SLEEP_SECONDS}s."
    sleep "$HEALTHCHECK_SLEEP_SECONDS"
    ((attempt++))
  done

  die "Health check failed for $HEALTHCHECK_URL after $HEALTHCHECK_RETRIES attempts."
}

main() {
  require_cmd git
  require_cmd docker
  require_cmd curl

  [[ -d "$PROJECT_DIR" ]] || die "Project directory not found: $PROJECT_DIR"
  cd "$PROJECT_DIR"

  log "Starting deploy from $PROJECT_DIR on branch $BRANCH."

  if [[ "$SKIP_GIT_PULL" != "1" ]]; then
    log "Updating repository."
    git fetch --all --prune
    git checkout "$BRANCH"
    git pull --ff-only origin "$BRANCH"
  else
    log "Skipping git pull because SKIP_GIT_PULL=1."
  fi

  log "Building services: $BUILD_SERVICES"
  run_compose build $BUILD_SERVICES

  log "Stopping current services: $DEPLOY_SERVICES"
  run_compose stop $DEPLOY_SERVICES

  log "Starting updated services: $DEPLOY_SERVICES"
  run_compose up -d --no-deps $DEPLOY_SERVICES

  log "Running health check."
  wait_for_healthcheck

  log "Deployment completed successfully."
}

main "$@"
