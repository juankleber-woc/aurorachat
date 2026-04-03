#!/usr/bin/env bash

set -Eeuo pipefail

APP_NAME="AuroraChat"
GITHUB_REPO="${GITHUB_REPO:-juankleber-woc/aurorachat}"
GITHUB_API_BASE="https://api.github.com/repos/${GITHUB_REPO}"
GITHUB_RAW_BASE="https://raw.githubusercontent.com/${GITHUB_REPO}"
RELEASE_TAG="${RELEASE_TAG:-}"

NONINTERACTIVE="${NONINTERACTIVE:-0}"
DRY_RUN="${DRY_RUN:-0}"
INSTALL_ROOT="${INSTALL_ROOT:-}"
DEPLOY_MODE="${DEPLOY_MODE:-}"
DEPLOY_PROFILE="${DEPLOY_PROFILE:-}"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
HOST_PORT="${HOST_PORT:-3000}"

CURRENT_STEP=0
TOTAL_STEPS=8

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

RUN_ID="$(date +%Y%m%d-%H%M%S)"
DOWNLOADER=""
SUDO=""
LOG_DIR=""
STATE_DIR=""
WORK_DIR=""
DATA_DIR=""
LOG_FILE=""

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

print_step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo ""
    echo -e "${BLUE}${BOLD}=== $1 - Step ${CURRENT_STEP}/${TOTAL_STEPS} ===${NC}"
    echo ""
}

is_interactive() {
    [[ "$NONINTERACTIVE" != "1" ]] && [[ -r /dev/tty ]] && [[ -w /dev/tty ]]
}

read_prompt_line() {
    local prompt_text="$1"
    if ! is_interactive; then
        REPLY=""
        return
    fi
    printf "%s" "$prompt_text" > /dev/tty
    IFS= read -r REPLY < /dev/tty || REPLY=""
}

prompt_or_default() {
    local prompt_text="$1"
    local default_value="$2"
    read_prompt_line "$prompt_text"
    [[ -z "$REPLY" ]] && REPLY="$default_value"
}

confirm_or_default() {
    local prompt_text="$1"
    local default_value="$2"
    prompt_or_default "$prompt_text" "$default_value"
    [[ "$REPLY" =~ ^[Yy]$|^[Ss]$ ]]
}

run_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
        print_info "[dry-run] $*"
        return 0
    fi
    "$@"
}

detect_downloader() {
    if command -v curl >/dev/null 2>&1; then
        DOWNLOADER="curl"
        return
    fi
    if command -v wget >/dev/null 2>&1; then
        DOWNLOADER="wget"
        return
    fi
    print_error "Nem curl nem wget estão instalados."
    exit 1
}

download_to_file() {
    local url="$1"
    local output="$2"
    if [[ "$DOWNLOADER" == "curl" ]]; then
        curl -fsSL --retry 3 --retry-delay 2 --retry-connrefused -o "$output" "$url"
    else
        wget -q --tries=3 --timeout=20 -O "$output" "$url"
    fi
}

download_to_stdout() {
    local url="$1"
    if [[ "$DOWNLOADER" == "curl" ]]; then
        curl -fsSL --retry 3 --retry-delay 2 --retry-connrefused "$url"
    else
        wget -q -O - --tries=3 --timeout=20 "$url"
    fi
}

detect_sudo() {
    if [[ "$(id -u)" -eq 0 ]]; then
        SUDO=""
    elif command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        SUDO=""
    fi
}

choose_install_root() {
    if [[ -n "$INSTALL_ROOT" ]]; then
        return
    fi

    if [[ "$(id -u)" -eq 0 ]] || [[ -w /opt ]] || command -v sudo >/dev/null 2>&1; then
        INSTALL_ROOT="/opt/aurorachat"
    else
        INSTALL_ROOT="$HOME/aurorachat"
    fi
}

ensure_directories() {
    WORK_DIR="${INSTALL_ROOT}/deployment"
    DATA_DIR="${INSTALL_ROOT}/data"
    LOG_DIR="${INSTALL_ROOT}/logs"
    STATE_DIR="${INSTALL_ROOT}/state"

    run_cmd ${SUDO} mkdir -p "$WORK_DIR" "$DATA_DIR/nginx" "$DATA_DIR/certbot/conf" "$DATA_DIR/certbot/www" "$LOG_DIR" "$STATE_DIR"

    if [[ -n "$SUDO" ]] && [[ "$(id -u)" -ne 0 ]]; then
        run_cmd ${SUDO} chown -R "$USER":"$(id -gn)" "$INSTALL_ROOT" || true
    fi
}

setup_logging() {
    LOG_FILE="${LOG_DIR}/customer-deploy-${RUN_ID}.log"
    if [[ "$DRY_RUN" != "1" ]]; then
        exec > >(tee -a "$LOG_FILE") 2>&1
    fi
}

detect_compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD=(docker compose)
        return
    fi
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD=(docker-compose)
        return
    fi
    print_error "Docker Compose não está instalado."
    exit 1
}

docker_compose() {
    (cd "$WORK_DIR" && "${COMPOSE_CMD[@]}" -f "$1" "${@:2}")
}

docker_compose_stack() {
    local primary_file="$1"
    shift

    if [[ "$primary_file" == "docker-compose.yml" && "$DEPLOY_PROFILE" == "lite" ]]; then
        (cd "$WORK_DIR" && "${COMPOSE_CMD[@]}" -f "$primary_file" -f "docker-compose.onyx-lite.yml" "$@")
        return
    fi

    (cd "$WORK_DIR" && "${COMPOSE_CMD[@]}" -f "$primary_file" "$@")
}

install_docker_if_needed() {
    if command -v docker >/dev/null 2>&1; then
        return
    fi

    print_info "Docker não foi encontrado. Vou instalar automaticamente."
    if [[ "$DRY_RUN" == "1" ]]; then
        print_info "[dry-run] instalaria Docker via get.docker.com"
        return
    fi

    local tmp_script
    tmp_script="$(mktemp)"
    download_to_file "https://get.docker.com" "$tmp_script"
    ${SUDO} sh "$tmp_script"
    rm -f "$tmp_script"

    ${SUDO} systemctl enable docker >/dev/null 2>&1 || true
    ${SUDO} systemctl start docker >/dev/null 2>&1 || true
}

ensure_docker_access() {
    if docker info >/dev/null 2>&1; then
        return
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
        print_info "[dry-run] ajustaria acesso ao Docker e seguiria com o deploy."
        return
    fi

    if [[ "$(id -u)" -eq 0 ]]; then
        print_error "Docker está instalado, mas o daemon não está respondendo."
        exit 1
    fi

    if ! getent group docker >/dev/null 2>&1; then
        run_cmd ${SUDO} groupadd docker
    fi

    print_info "Vou adicionar ${USER} ao grupo docker para concluir a instalação."
    run_cmd ${SUDO} usermod -aG docker "$USER"
    print_warning "Abra uma nova sessão SSH e rode o script novamente para continuar."
    exit 1
}

get_latest_release_tag() {
    local response tag

    if [[ -n "$RELEASE_TAG" ]]; then
        printf '%s\n' "$RELEASE_TAG"
        return 0
    fi

    response="$(download_to_stdout "${GITHUB_API_BASE}/releases/latest" 2>/dev/null || true)"
    tag="$(printf '%s' "$response" | tr -d '\n' | sed -n 's/.*"tag_name":"\([^"]*\)".*/\1/p')"
    if [[ -n "$tag" ]]; then
        printf '%s\n' "$tag"
        return 0
    fi

    response="$(download_to_stdout "${GITHUB_API_BASE}/releases?per_page=20" 2>/dev/null || true)"
    tag="$(printf '%s' "$response" | grep -o '"tag_name":"[^"]*"' | head -1 | cut -d'"' -f4)"
    if [[ -n "$tag" ]]; then
        printf '%s\n' "$tag"
        return 0
    fi

    if command -v git >/dev/null 2>&1; then
        tag="$(
            git ls-remote --tags --refs "https://github.com/${GITHUB_REPO}.git" 2>/dev/null \
                | sed 's#.*refs/tags/##' \
                | sort -V \
                | tail -1
        )"
        if [[ -n "$tag" ]]; then
            printf '%s\n' "$tag"
            return 0
        fi
    fi

    return 1
}

set_kv() {
    local file="$1"
    local key="$2"
    local value="$3"

    if grep -q "^${key}=" "$file" 2>/dev/null; then
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

random_hex() {
    openssl rand -hex 32
}

download_release_bundle() {
    local release_tag="$1"
    local raw_base="${GITHUB_RAW_BASE}/${release_tag}/deployment"
    local files=(
        "docker_compose/docker-compose.yml:${WORK_DIR}/docker-compose.yml"
        "docker_compose/docker-compose.prod.yml:${WORK_DIR}/docker-compose.prod.yml"
        "docker_compose/docker-compose.onyx-lite.yml:${WORK_DIR}/docker-compose.onyx-lite.yml"
        "docker_compose/env.template:${WORK_DIR}/env.template"
        "docker_compose/env.nginx.template:${WORK_DIR}/env.nginx.template"
        "docker_compose/init-letsencrypt.sh:${WORK_DIR}/init-letsencrypt.sh"
        "data/nginx/app.conf.template:${DATA_DIR}/nginx/app.conf.template"
        "data/nginx/app.conf.template.prod:${DATA_DIR}/nginx/app.conf.template.prod"
        "data/nginx/mcp.conf.inc.template:${DATA_DIR}/nginx/mcp.conf.inc.template"
        "data/nginx/mcp_upstream.conf.inc.template:${DATA_DIR}/nginx/mcp_upstream.conf.inc.template"
        "data/nginx/run-nginx.sh:${DATA_DIR}/nginx/run-nginx.sh"
    )

    local entry remote_path local_path
    for entry in "${files[@]}"; do
        remote_path="${entry%%:*}"
        local_path="${entry#*:}"
        print_info "Baixando $(basename "$local_path") da release ${release_tag}..."
        if [[ "$DRY_RUN" == "1" ]]; then
            print_info "[dry-run] ${raw_base}/${remote_path} -> ${local_path}"
            continue
        fi
        download_to_file "${raw_base}/${remote_path}" "$local_path"
    done

    run_cmd chmod +x "${WORK_DIR}/init-letsencrypt.sh" "${DATA_DIR}/nginx/run-nginx.sh"
}

choose_operation() {
    OPERATION="${OPERATION:-deploy}"
    if ! is_interactive; then
        return
    fi

    echo "Escolha o que você quer fazer:"
    echo "1. Instalar ou atualizar para a última release estável"
    echo "2. Fazer rollback para a release anterior"
    echo "3. Parar a aplicação"
    echo ""
    prompt_or_default "Opção [default: 1]: " "1"
    echo ""

    case "$REPLY" in
        2) OPERATION="rollback" ;;
        3) OPERATION="stop" ;;
        *) OPERATION="deploy" ;;
    esac
}

choose_deploy_mode() {
    if [[ -n "$DEPLOY_MODE" ]]; then
        return
    fi

    if ! is_interactive; then
        DEPLOY_MODE="private"
        return
    fi

    echo "Como essa instalação vai ficar publicada?"
    echo "1. Privada ou interna (HTTP em porta local, ideal para VPN, proxy externo ou teste)"
    echo "2. Pública com domínio e HTTPS automático via Let's Encrypt"
    echo ""
    prompt_or_default "Opção [default: 1]: " "1"
    echo ""

    case "$REPLY" in
        2) DEPLOY_MODE="public" ;;
        *) DEPLOY_MODE="private" ;;
    esac
}

choose_profile() {
    if [[ -n "$DEPLOY_PROFILE" ]]; then
        return
    fi

    if ! is_interactive; then
        DEPLOY_PROFILE="standard"
        return
    fi

    if ! is_interactive; then
        return
    fi

    echo "Qual perfil de deploy você quer usar?"
    echo "1. Standard (recomendado)"
    echo "2. Lite (menos recursos, sem pipeline completa de busca/indexação)"
    echo ""
    prompt_or_default "Opção [default: 1]: " "1"
    echo ""

    case "$REPLY" in
        2) DEPLOY_PROFILE="lite" ;;
        *) DEPLOY_PROFILE="standard" ;;
    esac
}

collect_public_settings() {
    if [[ "$DEPLOY_MODE" != "public" ]]; then
        return
    fi

    if [[ -z "$DOMAIN" ]] && is_interactive; then
        prompt_or_default "Domínio público da aplicação (ex: app.seudominio.com): " ""
        DOMAIN="$REPLY"
    fi

    if [[ -z "$EMAIL" ]] && is_interactive; then
        prompt_or_default "E-mail para o Let's Encrypt [opcional]: " ""
        EMAIL="$REPLY"
    fi

    if [[ -z "$DOMAIN" ]]; then
        print_error "Para deploy público com HTTPS automático, o domínio é obrigatório."
        exit 1
    fi
}

ensure_env_files() {
    local env_file="${WORK_DIR}/.env"
    local nginx_env_file="${WORK_DIR}/.env.nginx"

    if [[ "$DRY_RUN" == "1" ]]; then
        print_info "[dry-run] criaria ou atualizaria ${env_file} com IMAGE_TAG=${TARGET_RELEASE}"
        if [[ "$DEPLOY_MODE" == "public" ]]; then
            print_info "[dry-run] criaria ou atualizaria ${nginx_env_file} com DOMAIN=${DOMAIN}"
        fi
        return
    fi

    if [[ ! -f "$env_file" ]]; then
        cp "${WORK_DIR}/env.template" "$env_file"
        print_success "Criei um novo arquivo .env."
    else
        print_info "Encontrei um .env existente e vou reaproveitar as configurações atuais."
    fi

    set_kv "$env_file" "IMAGE_TAG" "$TARGET_RELEASE"
    set_kv "$env_file" "AUTH_TYPE" "basic"

    if ! grep -q '^USER_AUTH_SECRET="[^"]\+"' "$env_file" 2>/dev/null; then
        set_kv "$env_file" "USER_AUTH_SECRET" "\"$(random_hex)\""
    fi

    if [[ "$DEPLOY_PROFILE" == "lite" ]]; then
        set_kv "$env_file" "COMPOSE_PROFILES" ""
        set_kv "$env_file" "FILE_STORE_BACKEND" "postgres"
        set_kv "$env_file" "OPENSEARCH_FOR_ONYX_ENABLED" "false"
    fi

    if [[ "$DEPLOY_MODE" == "private" ]]; then
        set_kv "$env_file" "HOST_PORT" "$HOST_PORT"
    fi

    if [[ "$DEPLOY_MODE" == "public" ]]; then
        if [[ ! -f "$nginx_env_file" ]]; then
            cp "${WORK_DIR}/env.nginx.template" "$nginx_env_file"
        fi
        set_kv "$nginx_env_file" "DOMAIN" "$DOMAIN"
        set_kv "$nginx_env_file" "EMAIL" "$EMAIL"
    fi
}

save_state() {
    if [[ "$DRY_RUN" == "1" ]]; then
        print_info "[dry-run] salvaria o estado do deploy em ${STATE_DIR}/release-state.env"
        return
    fi

    cat > "${STATE_DIR}/release-state.env" <<EOF
CURRENT_RELEASE=${TARGET_RELEASE}
PREVIOUS_RELEASE=${PREVIOUS_RELEASE:-}
DEPLOY_MODE=${DEPLOY_MODE}
DEPLOY_PROFILE=${DEPLOY_PROFILE}
HOST_PORT=${HOST_PORT}
DOMAIN=${DOMAIN}
EMAIL=${EMAIL}
COMPOSE_FILE=${COMPOSE_FILE}
EOF
}

load_state() {
    if [[ -f "${STATE_DIR}/release-state.env" ]]; then
        # shellcheck disable=SC1091
        source "${STATE_DIR}/release-state.env"
    fi
}

wait_for_health() {
    local url="$1"
    local attempt=1
    local max_attempts=30
    local status_code=""

    while [[ "$attempt" -le "$max_attempts" ]]; do
        status_code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
        if [[ "$status_code" == "200" ]]; then
            print_success "Health check aprovado em ${url}."
            return 0
        fi
        print_info "Health check ainda não respondeu 200 (${status_code:-sem resposta}). Tentativa ${attempt}/${max_attempts}."
        sleep 10
        attempt=$((attempt + 1))
    done

    return 1
}

perform_rollback() {
    load_state
    if [[ -z "${PREVIOUS_RELEASE:-}" ]]; then
        print_error "Não existe release anterior registrada para rollback."
        exit 1
    fi

    TARGET_RELEASE="$PREVIOUS_RELEASE"
    print_warning "Fazendo rollback para ${TARGET_RELEASE}."
    download_release_bundle "$TARGET_RELEASE"
    ensure_env_files
    deploy_release "rollback"
}

stop_services() {
    load_state
    local compose_file="${COMPOSE_FILE:-docker-compose.yml}"
    detect_compose_cmd
    print_info "Parando os containers do ${APP_NAME}."
    docker_compose_stack "$compose_file" down
    print_success "Aplicação parada."
}

deploy_release() {
    local run_reason="${1:-deploy}"
    local health_url

    detect_compose_cmd

    if [[ "$DRY_RUN" == "1" ]]; then
        print_info "[dry-run] executaria docker compose para publicar ${TARGET_RELEASE}"
        if [[ "$DEPLOY_MODE" == "public" ]]; then
            print_info "[dry-run] rodaria init-letsencrypt.sh para ${DOMAIN}, se necessário"
            print_info "[dry-run] validaria http://localhost/api/health"
        else
            print_info "[dry-run] validaria http://localhost:${HOST_PORT}/api/health"
        fi
        return 0
    fi

    print_info "Baixando imagens Docker da release ${TARGET_RELEASE}."
    docker_compose_stack "$COMPOSE_FILE" pull
    docker_compose_stack "$COMPOSE_FILE" up -d

    if [[ "$DEPLOY_MODE" == "public" ]]; then
    if [[ ! -d "${DATA_DIR}/certbot/conf/live/${DOMAIN}" ]]; then
        print_info "Preparando HTTPS automático com Let's Encrypt."
        (cd "$WORK_DIR" && bash ./init-letsencrypt.sh)
    fi
        health_url="http://localhost/api/health"
    else
        health_url="http://localhost:${HOST_PORT}/api/health"
    fi

    if wait_for_health "$health_url"; then
        print_success "${APP_NAME} publicado com sucesso."
        return 0
    fi

    if [[ "$run_reason" == "rollback" ]]; then
        print_error "O rollback também falhou no health check."
        exit 1
    fi

    print_warning "O deploy falhou no health check. Vou tentar rollback automático."
    if [[ -n "${PREVIOUS_RELEASE:-}" ]]; then
        local failed_release="$TARGET_RELEASE"
        TARGET_RELEASE="$PREVIOUS_RELEASE"
        download_release_bundle "$TARGET_RELEASE"
        ensure_env_files
        deploy_release "rollback"
        print_warning "Rollback concluído após falha da release ${failed_release}."
        exit 1
    fi

    print_error "Não foi possível validar a aplicação e não havia release anterior para rollback."
    exit 1
}

main() {
    detect_downloader
    detect_sudo
    choose_install_root
    ensure_directories
    setup_logging

    echo ""
    echo -e "${BLUE}${BOLD}AuroraChat Customer Installer${NC}"
    echo "Repositório: ${GITHUB_REPO}"
    echo "Diretório de instalação: ${INSTALL_ROOT}"
    echo ""

    print_step "Entendendo a operação"
    choose_operation
    load_state

    if [[ "$OPERATION" == "rollback" ]]; then
        perform_rollback
        return
    fi

    if [[ "$OPERATION" == "stop" ]]; then
        stop_services
        return
    fi

    print_step "Preparando o servidor"
    install_docker_if_needed
    ensure_docker_access
    detect_compose_cmd

    print_step "Descobrindo a última release estável"
    TARGET_RELEASE="$(get_latest_release_tag || true)"
    if [[ -z "$TARGET_RELEASE" ]]; then
        print_error "Não consegui descobrir uma release estável no GitHub."
        print_info "Publique ao menos uma GitHub Release ou rode com RELEASE_TAG=<tag>."
        exit 1
    fi
    PREVIOUS_RELEASE="${CURRENT_RELEASE:-}"
    print_success "Última release estável encontrada: ${TARGET_RELEASE}"

    print_step "Coletando preferências da instalação"
    choose_deploy_mode
    choose_profile
    collect_public_settings

    if is_interactive; then
        echo "Resumo:"
        echo "• Release: ${TARGET_RELEASE}"
        echo "• Modo: ${DEPLOY_MODE}"
        echo "• Perfil: ${DEPLOY_PROFILE}"
        if [[ "$DEPLOY_MODE" == "public" ]]; then
            echo "• Domínio: ${DOMAIN}"
        else
            echo "• Porta local: ${HOST_PORT}"
        fi
        echo ""
        if ! confirm_or_default "Continuar com esse deploy? (Y/n) " "Y"; then
            print_warning "Instalação cancelada pelo usuário."
            exit 0
        fi
    fi

    print_step "Baixando os arquivos da release"
    download_release_bundle "$TARGET_RELEASE"

    print_step "Preparando arquivos de configuração"
    ensure_env_files

    print_step "Publicando a aplicação"
    if [[ "$DEPLOY_MODE" == "public" ]]; then
        COMPOSE_FILE="docker-compose.prod.yml"
    else
        COMPOSE_FILE="docker-compose.yml"
    fi

    save_state
    deploy_release "deploy"

    print_step "Finalizando"
    save_state
    print_success "Deploy concluído."
    print_info "Log salvo em ${LOG_FILE}"

    if [[ "$DEPLOY_MODE" == "public" ]]; then
        print_info "Acesse em: https://${DOMAIN}"
    else
        print_info "Acesse em: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'IP_DO_SERVIDOR'):${HOST_PORT}"
    fi
}

main "$@"
