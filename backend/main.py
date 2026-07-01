"""心遇 - 相亲交友平台后端入口"""
import os
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from database import init_db, async_session
from seed_data import seed_database
from api import router
from admin_api import admin_router
from config import UPLOAD_DIR, ALLOWED_ORIGINS

# 前端静态文件目录
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：初始化数据库和种子数据"""
    # 确保上传目录存在
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    await init_db()
    async with async_session() as db:
        await seed_database(db)
    print("[OK] Database initialized")
    yield


app = FastAPI(
    title="心遇 HeartMeet API",
    description="相亲交友平台后端服务 - 包含用户系统、推荐引擎、行为分析",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件服务 — 提供上传的图片
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# API 路由
app.include_router(router)
app.include_router(admin_router)


@app.get("/")
@app.head("/")
async def root():
    """返回前端首页"""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "心遇 HeartMeet API", "docs": "/docs"}


# 捕获所有非API路径：是静态文件就返回文件，否则返回 index.html（支持 SPA 路由）
@app.get("/{full_path:path}")
@app.head("/{full_path:path}")
async def serve_frontend(full_path: str):
    # 跳过 API 相关路径（这些由 router 处理）
    if full_path.startswith(("api/", "uploads/")):
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    # 尝试返回前端静态文件
    file_path = os.path.join(FRONTEND_DIR, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)

    # 其他路径返回 index.html（SPA 路由）
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "心遇 HeartMeet API", "docs": "/docs"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
