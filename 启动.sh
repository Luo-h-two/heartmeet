#!/bin/bash
echo "========================================"
echo "   心遇 HeartMeet - 相亲交友平台"
echo "========================================"
echo ""
echo "[1] 启动后端服务 (Python FastAPI)"
echo "[2] 启动前端服务 (HTTP Server)"
echo "[3] 同时启动前后端"
echo "[0] 退出"
echo ""
read -p "请选择 (0-3): " choice

case $choice in
  1)
    echo "正在启动后端服务..."
    echo "后端地址: http://localhost:8000"
    echo "Swagger文档: http://localhost:8000/docs"
    cd "$(dirname "$0")/backend"
    python main.py
    ;;
  2)
    echo "正在启动前端服务..."
    echo "前端地址: http://localhost:5173"
    cd "$(dirname "$0")/frontend"
    python -m http.server 5173 &
    open http://localhost:5173
    wait
    ;;
  3)
    echo "正在启动后端服务..."
    cd "$(dirname "$0")/backend"
    python main.py &
    sleep 3
    echo "正在启动前端服务..."
    cd "$(dirname "$0")/frontend"
    python -m http.server 5173 &
    echo "前端地址: http://localhost:5173"
    echo "后端地址: http://localhost:8000"
    open http://localhost:5173
    wait
    ;;
  0)
    echo "退出"
    ;;
esac
