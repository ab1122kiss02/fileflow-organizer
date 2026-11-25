@echo off
chcp 65001 >nul
echo 正在啟動 FileFlow 本機網頁伺服器 (http://localhost:8765)...
echo 請保持此視窗開啟，結束使用時直接關閉即可。
start "" http://localhost:8765
python -m http.server 8765 --directory "%~dp0"
