@echo off
chcp 65001 >nul
title 心遇 HeartMeet - 相亲交友平台
echo ========================================
echo    心遇 HeartMeet - 相亲交友平台
echo ========================================
echo.
echo [1] 启动后端服务 (Python FastAPI)
echo [2] 启动前端服务 (HTTP Server)
echo [3] 同时启动前后端（推荐）
echo [4] 检查并安装后端依赖
echo [0] 退出
echo.
set /p choice=请选择 (0-4): 

if "%choice%"=="1" goto backend
if "%choice%"=="2" goto frontend
if "%choice%"=="3" goto both
if "%choice%"=="4" goto install_deps
if "%choice%"=="0" goto end
goto end

:install_deps
echo.
echo 正在安装后端依赖...
cd /d "%~dp0backend"
echo.
echo 安装项目依赖（可能需要1-2分钟）...
python -m pip install fastapi uvicorn sqlalchemy pydantic "python-jose[cryptography]" python-multipart aiosqlite httpx python-dotenv --quiet
if %errorlevel% neq 0 (
    echo.
    echo [错误] 依赖安装失败！请检查网络连接或手动运行：
    echo   cd heart-meet\backend
    echo   pip install -r requirements.txt
)
echo.
echo 依赖安装完成！请重新运行启动脚本。
echo.
pause
goto end

:backend
echo.
echo 正在检查后端依赖...
cd /d "%~dp0backend"
python -c "import fastapi; import uvicorn; print('ok')" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [错误] 后端依赖未安装！
    echo 请先选择 [4] 安装依赖，或手动运行：
    echo   cd backend
    echo   pip install -r requirements.txt
    echo.
    pause
    goto end
)
echo 正在启动后端服务...
echo 后端地址: http://localhost:8000
echo Swagger文档: http://localhost:8000/docs
echo.
start "HeartMeet-Backend" cmd /k "cd /d %~dp0backend && echo 后端服务启动中... && python main.py"
echo 后端窗口已在新终端打开，请不要关闭该窗口。
pause
goto end

:frontend
echo.
echo 正在启动前端服务...
echo 前端地址: http://localhost:5173
echo.
start http://localhost:5173
cd /d "%~dp0frontend"
python -m http.server 5173
goto end

:both
echo.
echo ========================================
echo  正在启动心遇交友平台...
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] 检查后端依赖...
python -c "import fastapi; import uvicorn; import sqlalchemy; import aiosqlite; import jose; import httpx; import dotenv; print('ok')" >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 后端依赖缺失，正在自动安装...
    python -m pip install fastapi uvicorn sqlalchemy pydantic "python-jose[cryptography]" python-multipart aiosqlite httpx python-dotenv --quiet 2>&1
    python -c "import fastapi; import uvicorn" >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 依赖安装失败！请手动运行：
        echo   cd heart-meet\backend
        echo   pip install -r requirements.txt
        pause
        goto end
    )
    echo 依赖安装成功！
)

echo.
echo [2/3] 启动后端服务 (端口 8000)...
start "HeartMeet-Backend" cmd /k "cd /d %~dp0backend && title 心遇-后端服务 && echo 后端服务启动中... && python main.py"

echo 等待后端启动（5秒）...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] 启动前端服务 (端口 5173)...
echo.
echo ========================================
echo  启动完成！
echo  前端: http://localhost:5173
echo  后端: http://localhost:8000
echo  文档: http://localhost:8000/docs
echo  演示: 13800138001 / Pass@123
echo ========================================
echo.
start http://localhost:5173
cd /d "%~dp0frontend"
python -m http.server 5173
goto end

:end
