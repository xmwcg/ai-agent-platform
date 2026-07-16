#!/usr/bin/env bash
# ============================================================
# AIbak 服务器侧 CNB 生产发布 watcher
# - 只监听通过 CNB 门禁后晋级的 deploy/production
# - 只拉取提交 SHA 对应镜像，不在 2G 应用机编译源码
# - 以镜像 digest 部署；内外网全部探针成功后才写状态
# - 失败自动恢复上一成功镜像，并通过真实渠道告警
# ============================================================
set -Eeuo pipefail

REPO_URL=${REPO_URL:-https://cnb.cool/aibak.site/ai-agent-platform.git}
RELEASE_BRANCH=${RELEASE_BRANCH:-deploy/production}
GIT_DIR=${GIT_DIR:-/opt/ai-agent-platform.git}
RUNTIME_DIR=${RUNTIME_DIR:-/usr/local/lib/aibak-deploy}
RELEASES_DIR=${RELEASES_DIR:-$RUNTIME_DIR/releases}
STATE_FILE=${STATE_FILE:-/opt/aibak-release.env}
LEGACY_STATE_FILE=${LEGACY_STATE_FILE:-/opt/.cnb-deploy-sha}
FAILED_STATE_FILE=${FAILED_STATE_FILE:-/opt/.cnb-deploy-failed}
LOG=${LOG:-/var/log/cnb-watcher.log}
DEPLOY_LOG=${DEPLOY_LOG:-/var/log/ai-platform-deploy.log}
EVIDENCE_DIR=${EVIDENCE_DIR:-/var/log/aibak-release-evidence}
LOCK_FILE=${LOCK_FILE:-/run/lock/cnb-watcher.lock}
PUBLIC_BASE_URL=${PUBLIC_BASE_URL:-https://aibak.site}
PRODUCTION_ENV_FILE=${PRODUCTION_ENV_FILE:-/etc/aibak/server.env}
REGISTRY_AUTH_FILE=${REGISTRY_AUTH_FILE:-/etc/aibak/registry.env}
REGISTRY=${REGISTRY:-docker.cnb.cool}
IMAGE_REPOSITORY=${IMAGE_REPOSITORY:-$REGISTRY/aibak.site/ai-agent-platform}
SERVER_IMAGE_REPOSITORY=${SERVER_IMAGE_REPOSITORY:-$IMAGE_REPOSITORY/server}
CLIENT_IMAGE_REPOSITORY=${CLIENT_IMAGE_REPOSITORY:-$IMAGE_REPOSITORY/client}
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-aibak-production}
MAX_ATTEMPTS=${MAX_ATTEMPTS:-3}
RETRY_DELAY_SECONDS=${RETRY_DELAY_SECONDS:-30}
FAILED_RETRY_COOLDOWN_SECONDS=${FAILED_RETRY_COOLDOWN_SECONDS:-900}
VERIFY_TIMEOUT_SECONDS=${VERIFY_TIMEOUT_SECONDS:-180}
REMOTE_CHECK_ATTEMPTS=${REMOTE_CHECK_ATTEMPTS:-3}
REMOTE_CHECK_RETRY_SECONDS=${REMOTE_CHECK_RETRY_SECONDS:-10}
REQUIRE_DEPLOY_ALERTS=${REQUIRE_DEPLOY_ALERTS:-true}
DEPLOY_ALERT_FORMAT=${DEPLOY_ALERT_FORMAT:-wecom}

mkdir -p \
  "$(dirname "$GIT_DIR")" "$RELEASES_DIR" "$EVIDENCE_DIR" \
  "$(dirname "$STATE_FILE")" "$(dirname "$FAILED_STATE_FILE")" \
  "$(dirname "$LOG")" "$(dirname "$LOCK_FILE")"
touch "$LOG" "$DEPLOY_LOG"
chmod 0600 "$LOG" "$DEPLOY_LOG" 2>/dev/null || true

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

atomic_write_text() {
  local path=$1
  local value=$2
  local tmp="${path}.tmp.$$"
  printf '%s\n' "$value" >"$tmp"
  chmod 0600 "$tmp"
  mv -f "$tmp" "$path"
}

send_alert() {
  local level=$1
  local message=$2
  if [ -z "${DEPLOY_ALERT_WEBHOOK:-}" ]; then
    log "真实告警渠道未配置，无法发送 ${level} 告警"
    return 1
  fi

  local payload
  payload=$(ALERT_LEVEL="$level" ALERT_MESSAGE="$message" ALERT_FORMAT="$DEPLOY_ALERT_FORMAT" node <<'NODE'
const level = process.env.ALERT_LEVEL || 'INFO';
const message = `[AIbak ${level}] ${process.env.ALERT_MESSAGE || ''}`;
const payload = process.env.ALERT_FORMAT === 'wecom'
  ? { msgtype: 'text', text: { content: message } }
  : { level, text: message };
process.stdout.write(JSON.stringify(payload));
NODE
  )

  curl -fsS --max-time 10 -X POST \
    -H 'Content-Type: application/json' \
    --data "$payload" \
    "$DEPLOY_ALERT_WEBHOOK" >>"$LOG" 2>&1
}

notify_failure() {
  local message=$1
  log "ALERT: $message"
  send_alert FAILURE "$message" || log "生产失败告警发送失败"
}

notify_success() {
  local message=$1
  log "$message"
  send_alert SUCCESS "$message" || log "生产成功通知发送失败（部署结果不受影响）"
}

require_alert_channel() {
  if [ "$REQUIRE_DEPLOY_ALERTS" = "true" ] && [ -z "${DEPLOY_ALERT_WEBHOOK:-}" ]; then
    log "阻止部署：REQUIRE_DEPLOY_ALERTS=true，但 DEPLOY_ALERT_WEBHOOK 未配置"
    return 1
  fi
}

# 防止 systemd timer 重叠执行。
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "已有部署任务运行，本轮跳过"
  exit 0
fi

for command_name in git node curl flock docker awk sed; do
  command -v "$command_name" >/dev/null 2>&1 || {
    log "缺少运行依赖: $command_name"
    exit 1
  }
done

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  log "缺少 Docker Compose 插件或 docker-compose"
  exit 1
fi

repo_git() {
  command git --git-dir="$GIT_DIR" "$@"
}

ensure_git_repository() {
  if [ ! -e "$GIT_DIR" ]; then
    git init --bare "$GIT_DIR" >>"$LOG" 2>&1
    return
  fi
  if [ ! -d "$GIT_DIR" ]; then
    log "发布 Git 路径已存在但不是目录，拒绝覆盖: $GIT_DIR"
    return 1
  fi
  if [ -z "$(find "$GIT_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
    git init --bare "$GIT_DIR" >>"$LOG" 2>&1
    return
  fi
  if ! repo_git rev-parse --is-bare-repository >/dev/null 2>&1; then
    log "发布 Git 目录已有内容但不是合法裸仓库，拒绝删除或覆盖: $GIT_DIR"
    return 1
  fi
}

remote_release_sha() {
  git ls-remote "$REPO_URL" "refs/heads/$RELEASE_BRANCH" 2>/dev/null | awk '{print $1}'
}

resolve_remote_release_sha() {
  local attempt sha
  for attempt in $(seq 1 "$REMOTE_CHECK_ATTEMPTS"); do
    sha=$(remote_release_sha || true)
    if [[ "$sha" =~ ^[a-f0-9]{40}$ ]]; then
      printf '%s\n' "$sha"
      return 0
    fi
    log "无法获取 CNB $RELEASE_BRANCH（第 $attempt/$REMOTE_CHECK_ATTEMPTS 次）" >&2
    if [ "$attempt" -lt "$REMOTE_CHECK_ATTEMPTS" ]; then
      sleep "$REMOTE_CHECK_RETRY_SECONDS"
    fi
  done
  return 1
}

fetch_release() {
  local sha=$1
  repo_git fetch --prune "$REPO_URL" "refs/heads/$RELEASE_BRANCH" >>"$LOG" 2>&1
  repo_git cat-file -e "${sha}^{commit}" >>"$LOG" 2>&1
  local fetched_sha
  fetched_sha=$(repo_git rev-parse FETCH_HEAD)
  [ "$fetched_sha" = "$sha" ] || {
    log "CNB 分支在获取期间发生变化，expected=$sha actual=$fetched_sha"
    return 1
  }
}

extract_release_files() {
  local sha=$1
  local release_dir="$RELEASES_DIR/$sha"
  local tmp_dir="${release_dir}.tmp.$$"
  rm -rf "$tmp_dir"
  mkdir -p "$tmp_dir"
  repo_git show "${sha}:deploy/docker-compose.production.yml" >"$tmp_dir/docker-compose.production.yml"
  repo_git show "${sha}:deploy/verify-release.mjs" >"$tmp_dir/verify-release.mjs"
  repo_git show "${sha}:client/nginx.ssl.runtime.conf" >"$tmp_dir/nginx.ssl.runtime.conf"
  chmod 0644 "$tmp_dir/docker-compose.production.yml" "$tmp_dir/nginx.ssl.runtime.conf"
  chmod 0755 "$tmp_dir/verify-release.mjs"
  rm -rf "$release_dir"
  mv "$tmp_dir" "$release_dir"
}

registry_login() {
  if [ ! -f "$REGISTRY_AUTH_FILE" ]; then
    log "未发现独立 Registry 凭据文件，尝试使用服务器现有 Docker 登录状态"
    return 0
  fi
  if find "$REGISTRY_AUTH_FILE" -perm /077 -print -quit | grep -q .; then
    log "Registry 凭据文件权限过宽，必须仅 root 可读: $REGISTRY_AUTH_FILE"
    return 1
  fi

  local registry_username registry_password
  registry_username=$(sed -n 's/^REGISTRY_USERNAME=//p' "$REGISTRY_AUTH_FILE" | tail -n 1)
  registry_password=$(sed -n 's/^REGISTRY_PASSWORD=//p' "$REGISTRY_AUTH_FILE" | tail -n 1)
  [ -n "$registry_username" ] && [ -n "$registry_password" ] || {
    log "Registry 凭据文件缺少 REGISTRY_USERNAME/REGISTRY_PASSWORD"
    return 1
  }
  printf '%s' "$registry_password" | docker login "$REGISTRY" \
    --username "$registry_username" --password-stdin >>"$LOG" 2>&1
}

pull_immutable_image() {
  local repository=$1
  local sha=$2
  local output_name=$3
  local tag="${repository}:${sha}"
  docker pull "$tag" >>"$DEPLOY_LOG" 2>&1

  local immutable_ref
  immutable_ref=$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$tag" \
    | awk -v prefix="${repository}@" 'index($0, prefix) == 1 { print; exit }')
  if [[ ! "$immutable_ref" =~ ^${repository}@sha256:[a-f0-9]{64}$ ]]; then
    log "镜像未返回合法不可变摘要: $repository"
    return 1
  fi
  printf -v "$output_name" '%s' "$immutable_ref"
}

reset_loaded_state() {
  LOADED_APP_COMMIT_SHA=''
  LOADED_SERVER_IMAGE=''
  LOADED_CLIENT_IMAGE=''
  LOADED_SERVER_IMAGE_DIGEST=''
  LOADED_CLIENT_IMAGE_DIGEST=''
  LOADED_RELEASE_COMPOSE_FILE=''
  LOADED_NGINX_RUNTIME_CONFIG=''
}

load_state() {
  local file=$1
  reset_loaded_state
  [ -f "$file" ] || return 1

  local first_line
  first_line=$(head -n 1 "$file" 2>/dev/null || true)
  if [[ "$first_line" =~ ^[a-f0-9]{40}$ ]]; then
    LOADED_APP_COMMIT_SHA="$first_line"
    return 0
  fi

  local key value
  while IFS='=' read -r key value; do
    case "$key" in
      APP_COMMIT_SHA) LOADED_APP_COMMIT_SHA=$value ;;
      SERVER_IMAGE) LOADED_SERVER_IMAGE=$value ;;
      CLIENT_IMAGE) LOADED_CLIENT_IMAGE=$value ;;
      SERVER_IMAGE_DIGEST) LOADED_SERVER_IMAGE_DIGEST=$value ;;
      CLIENT_IMAGE_DIGEST) LOADED_CLIENT_IMAGE_DIGEST=$value ;;
      RELEASE_COMPOSE_FILE) LOADED_RELEASE_COMPOSE_FILE=$value ;;
      NGINX_RUNTIME_CONFIG) LOADED_NGINX_RUNTIME_CONFIG=$value ;;
    esac
  done <"$file"
}

state_is_complete() {
  [[ "$LOADED_APP_COMMIT_SHA" =~ ^[a-f0-9]{40}$ ]] \
    && [[ "$LOADED_SERVER_IMAGE" =~ ^([^[:space:]]+@)?sha256:[a-f0-9]{64}$ ]] \
    && [[ "$LOADED_CLIENT_IMAGE" =~ ^([^[:space:]]+@)?sha256:[a-f0-9]{64}$ ]] \
    && [[ "$LOADED_SERVER_IMAGE_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] \
    && [[ "$LOADED_CLIENT_IMAGE_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] \
    && [ -f "$LOADED_RELEASE_COMPOSE_FILE" ] \
    && [ -f "$LOADED_NGINX_RUNTIME_CONFIG" ]
}

write_release_state() {
  local file=$1
  local sha=$2
  local server_image=$3
  local client_image=$4
  local compose_file=$5
  local nginx_config=$6
  local server_digest=${server_image##*@}
  local client_digest=${client_image##*@}
  local tmp="${file}.tmp.$$"
  cat >"$tmp" <<EOF
COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME
APP_COMMIT_SHA=$sha
SERVER_IMAGE=$server_image
CLIENT_IMAGE=$client_image
SERVER_IMAGE_DIGEST=$server_digest
CLIENT_IMAGE_DIGEST=$client_digest
PRODUCTION_ENV_FILE=$PRODUCTION_ENV_FILE
RELEASE_COMPOSE_FILE=$compose_file
NGINX_RUNTIME_CONFIG=$nginx_config
EOF
  chmod 0600 "$tmp"
  mv -f "$tmp" "$file"
}

capture_running_release() {
  local output_file=$1
  local fallback_sha=$2
  local compose_file=$3
  local nginx_config=$4
  local server_image client_image
  server_image=$(docker inspect --format '{{.Image}}' ai-platform-server 2>/dev/null || true)
  client_image=$(docker inspect --format '{{.Image}}' ai-platform-client 2>/dev/null || true)
  if [[ ! "$fallback_sha" =~ ^[a-f0-9]{40}$ ]] \
    || [[ ! "$server_image" =~ ^sha256:[a-f0-9]{64}$ ]] \
    || [[ ! "$client_image" =~ ^sha256:[a-f0-9]{64}$ ]]; then
    return 1
  fi
  write_release_state "$output_file" "$fallback_sha" "$server_image" "$client_image" "$compose_file" "$nginx_config"
}

compose_up() {
  local state_file=$1
  load_state "$state_file"
  state_is_complete || {
    log "发布状态不完整，拒绝执行 Compose: $state_file"
    return 1
  }
  "${COMPOSE[@]}" --env-file "$state_file" -f "$LOADED_RELEASE_COMPOSE_FILE" \
    -p "$COMPOSE_PROJECT_NAME" up -d --no-build --remove-orphans >>"$DEPLOY_LOG" 2>&1
}

verify_release() {
  local state_file=$1
  local scope=$2
  load_state "$state_file"
  state_is_complete || return 1
  local verifier="$(dirname "$LOADED_RELEASE_COMPOSE_FILE")/verify-release.mjs"
  [ -f "$verifier" ] || return 1

  local base_url timeout evidence github_args=()
  if [ "$scope" = 'internal' ]; then
    base_url='http://127.0.0.1:3000'
    timeout=$VERIFY_TIMEOUT_SECONDS
    evidence="$EVIDENCE_DIR/${LOADED_APP_COMMIT_SHA}-internal.json"
    github_args=(--skip-github)
  else
    base_url=$PUBLIC_BASE_URL
    timeout=90
    evidence="$EVIDENCE_DIR/${LOADED_APP_COMMIT_SHA}-public.json"
    github_args=(--expected-github-sha "$LOADED_APP_COMMIT_SHA")
  fi

  node "$verifier" \
    --base-url "$base_url" \
    --expected-sha "$LOADED_APP_COMMIT_SHA" \
    --expected-server-digest "$LOADED_SERVER_IMAGE_DIGEST" \
    --expected-client-digest "$LOADED_CLIENT_IMAGE_DIGEST" \
    --timeout-seconds "$timeout" \
    --interval-seconds 5 \
    --evidence-file "$evidence" \
    "${github_args[@]}" >>"$DEPLOY_LOG" 2>&1
}

verify_rollback() {
  local url
  for url in 'http://127.0.0.1:3000/api/health' "$PUBLIC_BASE_URL/api/health"; do
    curl -fsS --max-time 15 "$url" >/dev/null || return 1
  done
}

rollback_to_state() {
  local state_file=$1
  load_state "$state_file"
  local rollback_sha=$LOADED_APP_COMMIT_SHA
  log "恢复上一成功版本 ${rollback_sha:-unknown}"
  compose_up "$state_file" || return 1
  verify_rollback || return 1
  log "上一版本恢复并通过核心健康检查: ${rollback_sha:-unknown}"
}

preflight() {
  [ -f "$PRODUCTION_ENV_FILE" ] || {
    log "生产环境文件不存在: $PRODUCTION_ENV_FILE"
    return 1
  }
  [ -r "$PRODUCTION_ENV_FILE" ] || {
    log "生产环境文件不可读: $PRODUCTION_ENV_FILE"
    return 1
  }
  require_alert_channel || return 1
  docker info >/dev/null 2>&1 || {
    log "Docker daemon 不可用"
    return 1
  }
  registry_login || return 1
}

ensure_git_repository
if ! REMOTE_SHA=$(resolve_remote_release_sha); then
  notify_failure "连续 $REMOTE_CHECK_ATTEMPTS 次无法获取 CNB $RELEASE_BRANCH，发布链路已中断"
  exit 1
fi

CURRENT_SHA=''
if load_state "$STATE_FILE"; then
  CURRENT_SHA=$LOADED_APP_COMMIT_SHA
elif [ -f "$LEGACY_STATE_FILE" ]; then
  CURRENT_SHA=$(head -n 1 "$LEGACY_STATE_FILE" 2>/dev/null || true)
fi

if [ "$REMOTE_SHA" = "$CURRENT_SHA" ]; then
  rm -f "$FAILED_STATE_FILE"
  exit 0
fi

FAILED_SHA=''
FAILED_AT=''
if [ -f "$FAILED_STATE_FILE" ]; then
  read -r FAILED_SHA FAILED_AT <"$FAILED_STATE_FILE" || true
fi
if [ "$FAILED_SHA" = "$REMOTE_SHA" ] && [[ "$FAILED_AT" =~ ^[0-9]+$ ]]; then
  NOW=$(date +%s)
  ELAPSED=$((NOW - FAILED_AT))
  if [ "$ELAPSED" -lt "$FAILED_RETRY_COOLDOWN_SECONDS" ]; then
    REMAINING=$((FAILED_RETRY_COOLDOWN_SECONDS - ELAPSED))
    log "版本 $REMOTE_SHA 已连续部署失败，冷却期剩余 ${REMAINING}s，本轮跳过"
    exit 0
  fi
else
  rm -f "$FAILED_STATE_FILE"
fi

log "发现待发布版本 $REMOTE_SHA（当前成功版本 ${CURRENT_SHA:-none}）"
preflight || exit 1
fetch_release "$REMOTE_SHA" || {
  notify_failure "无法获取 CNB 发布提交 $REMOTE_SHA"
  exit 1
}
extract_release_files "$REMOTE_SHA" || {
  notify_failure "发布提交 $REMOTE_SHA 缺少生产 Compose、Nginx 或验收脚本"
  exit 1
}

RELEASE_DIR="$RELEASES_DIR/$REMOTE_SHA"
CANDIDATE_STATE="${STATE_FILE}.candidate"
ROLLBACK_STATE="${STATE_FILE}.rollback"
rm -f "$CANDIDATE_STATE" "$ROLLBACK_STATE"

if load_state "$STATE_FILE" && state_is_complete; then
  cp "$STATE_FILE" "$ROLLBACK_STATE"
  chmod 0600 "$ROLLBACK_STATE"
elif ! capture_running_release "$ROLLBACK_STATE" "$CURRENT_SHA" \
  "$RELEASE_DIR/docker-compose.production.yml" "$RELEASE_DIR/nginx.ssl.runtime.conf"; then
  log "未能生成旧版回滚快照；首次镜像化部署失败时可能需要人工恢复"
fi

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  log "部署尝试 $attempt/$MAX_ATTEMPTS：拉取不可变镜像"
  SERVER_IMAGE=''
  CLIENT_IMAGE=''
  if pull_immutable_image "$SERVER_IMAGE_REPOSITORY" "$REMOTE_SHA" SERVER_IMAGE \
    && pull_immutable_image "$CLIENT_IMAGE_REPOSITORY" "$REMOTE_SHA" CLIENT_IMAGE; then
    write_release_state "$CANDIDATE_STATE" "$REMOTE_SHA" "$SERVER_IMAGE" "$CLIENT_IMAGE" \
      "$RELEASE_DIR/docker-compose.production.yml" "$RELEASE_DIR/nginx.ssl.runtime.conf"

    if compose_up "$CANDIDATE_STATE" \
      && verify_release "$CANDIDATE_STATE" internal \
      && verify_release "$CANDIDATE_STATE" public; then
      mv -f "$CANDIDATE_STATE" "$STATE_FILE"
      chmod 0600 "$STATE_FILE"
      atomic_write_text "$LEGACY_STATE_FILE" "$REMOTE_SHA"
      rm -f "$FAILED_STATE_FILE" "$ROLLBACK_STATE"
      notify_success "部署成功：SHA=$REMOTE_SHA server=${SERVER_IMAGE##*@} client=${CLIENT_IMAGE##*@}"
      exit 0
    fi
  fi

  log "新版本部署或验收失败: $REMOTE_SHA"
  if [ -f "$ROLLBACK_STATE" ]; then
    if ! rollback_to_state "$ROLLBACK_STATE"; then
      notify_failure "部署 $REMOTE_SHA 失败，且上一版本恢复失败，请立即人工处理"
      exit 1
    fi
  else
    notify_failure "部署 $REMOTE_SHA 失败，且没有可用回滚快照，请立即人工处理"
    exit 1
  fi

  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    log "${RETRY_DELAY_SECONDS}s 后重试新版本"
    sleep "$RETRY_DELAY_SECONDS"
  fi
done

atomic_write_text "$FAILED_STATE_FILE" "$REMOTE_SHA $(date +%s)"
notify_failure "部署 $REMOTE_SHA 连续失败 $MAX_ATTEMPTS 次；已恢复版本 ${CURRENT_SHA:-unknown}，进入 ${FAILED_RETRY_COOLDOWN_SECONDS}s 冷却期"
exit 1
