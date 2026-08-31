#!/bin/sh
# SkillHub git 凭据供给器（GIT_ASKPASS）：
# 只输出密码（GitHub token），从环境读取——token 不进入命令行参数、不进 ps。
# 配合用法（见 sync-cycle.sh / daily-cycle.sh）：
#   GIT_TERMINAL_PROMPT=0 GIT_ASKPASS="$APP/server/deploy/git-askpass.sh" \
#     git push https://x-access-token@github.com/HBC-Tech-coder/skillhub.git main
# 用户名已在 URL 中（x-access-token），git 只会向本脚本询问密码。
printf '%s' "${SKILLHUB_GIT_TOKEN:-${GITHUB_TOKEN:-}}"
