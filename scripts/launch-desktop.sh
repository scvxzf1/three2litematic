#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_PID=""

cleanup() {
  trap - EXIT INT TERM HUP
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    printf '\n\n正在关闭 three2litematic 服务...\n'
    kill -TERM -- "-${SERVER_PID}" 2>/dev/null || kill -TERM "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM HUP

cd -- "${PROJECT_ROOT}"
printf 'three2litematic 开发工作台\n'
printf '项目目录: %s\n' "${PROJECT_ROOT}"
printf '服务地址: http://127.0.0.1:28741\n'
printf '关闭此终端将停止前后端服务。\n\n'

if ! command -v npm >/dev/null 2>&1; then
  printf '错误: 未找到 npm，请先安装 Node.js。\n'
  read -r -p '按回车关闭...' _
  exit 1
fi

setsid npm run serve &
SERVER_PID=$!

for _ in {1..50}; do
  if curl --silent --fail --max-time 1 http://127.0.0.1:28741/ >/dev/null 2>&1; then
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open http://127.0.0.1:28741/ >/dev/null 2>&1 || true
    fi
    break
  fi
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    printf '\n服务启动失败，请查看上方日志。\n'
    wait "${SERVER_PID}" || true
    read -r -p '按回车关闭...' _
    exit 1
  fi
  sleep 0.2
done

wait "${SERVER_PID}"
