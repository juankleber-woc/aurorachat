#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/aurorachat}"
COMPOSE_FILE="${COMPOSE_FILE:-deployment/docker_compose/docker-compose.yml}"
BRANCH="${BRANCH:-main}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://localhost:3000}"
HEALTHCHECK_EXPECTED_CODE="${HEALTHCHECK_EXPECTED_CODE:-200}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-60}"
HEALTHCHECK_SLEEP_SECONDS="${HEALTHCHECK_SLEEP_SECONDS:-5}"
LOG_DIR="${LOG_DIR:-/home/ubuntu/deploy-logs}"
STATE_DIR="${STATE_DIR:-/home/ubuntu/deploy-state}"
NONINTERACTIVE="${NONINTERACTIVE:-0}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-1}"
DEPLOY_TYPE="${DEPLOY_TYPE:-}"
BUILD_SERVICES="${BUILD_SERVICES:-}"
DEPLOY_SERVICES="${DEPLOY_SERVICES:-}"

RUN_ID="$(date '+%Y%m%d-%H%M%S')"
LOG_FILE=""
PREVIOUS_COMMIT=""

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

run() {
  log "+ $*"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  "$@"
}

run_compose() {
  run docker compose -f "$COMPOSE_FILE" "$@"
}

setup_logging() {
  mkdir -p "$LOG_DIR" "$STATE_DIR"
  LOG_FILE="$LOG_DIR/deploy-$RUN_ID.log"
  touch "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1
}

choose_deploy_type() {
  if [[ -n "$DEPLOY_TYPE" ]]; then
    return 0
  fi

  if [[ "$NONINTERACTIVE" == "1" ]]; then
    DEPLOY_TYPE="full"
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
}

configure_services() {
  case "$DEPLOY_TYPE" in
    frontend)
      BUILD_SERVICES="${BUILD_SERVICES:-web_server}"
      DEPLOY_SERVICES="${DEPLOY_SERVICES:-web_server nginx}"
      ;;
    backend)
      BUILD_SERVICES="${BUILD_SERVICES:-api_server background}"
      DEPLOY_SERVICES="${DEPLOY_SERVICES:-api_server background nginx}"
      ;;
    full)
      BUILD_SERVICES="${BUILD_SERVICES:-api_server background web_server}"
      DEPLOY_SERVICES="${DEPLOY_SERVICES:-api_server background web_server nginx}"
      ;;
    custom)
      if [[ "$NONINTERACTIVE" == "1" ]]; then
        [[ -n "$BUILD_SERVICES" && -n "$DEPLOY_SERVICES" ]] || die "For custom deploy in non-interactive mode, set BUILD_SERVICES and DEPLOY_SERVICES."
      else
        printf "Servicos para build (ex: web_server): "
        read -r BUILD_SERVICES
        printf "Servicos para restart (ex: web_server nginx): "
        read -r DEPLOY_SERVICES
      fi
      ;;
    *)
      die "Unsupported DEPLOY_TYPE: $DEPLOY_TYPE"
      ;;
  esac
}

save_state() {
  local state_file="$STATE_DIR/last-deploy.env"
  cat >"$state_file" <<EOF
RUN_ID=$RUN_ID
DEPLOY_TYPE=$DEPLOY_TYPE
PREVIOUS_COMMIT=$PREVIOUS_COMMIT
BUILD_SERVICES=$BUILD_SERVICES
DEPLOY_SERVICES=$DEPLOY_SERVICES
LOG_FILE=$LOG_FILE
EOF
  log "Saved deploy state to $state_file."
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

  return 1
}

rollback() {
  [[ "$ROLLBACK_ON_FAILURE" == "1" ]] || {
    log "Rollback disabled."
    return 1
  }

  [[ -n "$PREVIOUS_COMMIT" ]] || {
    log "Skipping rollback because previous commit was not captured."
    return 1
  }

  log "Starting rollback to commit $PREVIOUS_COMMIT."

  run git checkout "$BRANCH"
  run git reset --hard "$PREVIOUS_COMMIT"
  run_compose build $BUILD_SERVICES
  run_compose up -d --no-deps $DEPLOY_SERVICES

  if wait_for_healthcheck; then
    log "Rollback completed successfully."
    return 0
  fi

  log "Rollback failed."
  return 1
}

on_error() {
  local exit_code=$?
  log "Deploy failed with exit code $exit_code."
  rollback || true
  exit "$exit_code"
}

main() {
  require_cmd git
  require_cmd docker
  require_cmd curl

  [[ -d "$PROJECT_DIR" ]] || die "Project directory not found: $PROJECT_DIR"

  setup_logging
  trap on_error ERR

  choose_deploy_type
  configure_services

  cd "$PROJECT_DIR"
  PREVIOUS_COMMIT="$(git rev-parse HEAD)"

  log "Starting deploy from $PROJECT_DIR."
  log "Deploy type: $DEPLOY_TYPE"
  log "Build services: $BUILD_SERVICES"
  log "Deploy services: $DEPLOY_SERVICES"
  log "Previous commit: $PREVIOUS_COMMIT"

  if [[ "$SKIP_GIT_PULL" != "1" ]]; then
    log "Updating repository from origin/$BRANCH."
    run git fetch --all --prune
    run git checkout "$BRANCH"
    run git pull --ff-only origin "$BRANCH"
  else
    log "Skipping git pull because SKIP_GIT_PULL=1."
  fi

  save_state

  log "Building selected services."
  run_compose build $BUILD_SERVICES

  log "Stopping current services."
  run_compose stop $DEPLOY_SERVICES

  log "Starting updated services."
  run_compose up -d --no-deps $DEPLOY_SERVICES

  log "Running health check."
  wait_for_healthcheck || die "Health check failed for $HEALTHCHECK_URL."

  log "Deployment completed successfully."
  log "Log file: $LOG_FILE"
}

main "$@"
