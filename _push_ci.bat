@echo off
cd /d "g:\项目成品及测试\AIBAK\reasoni-deepseek\ai-agent-platform"
git push github main --force-with-lease > _push.log 2>&1
echo PUSH_EXIT=%ERRORLEVEL% >> _push.log
