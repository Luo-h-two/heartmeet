import os
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# 数据库路径优先级：data 目录的 .sqlite（云端友好，避开 .gitignore） > data 目录的 .db > backend 根目录的 .db
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR = os.path.join(_BACKEND_DIR, "data")
_CANDIDATES = [
    os.path.join(_DATA_DIR, "heartmeet.sqlite"),
    os.path.join(_DATA_DIR, "heartmeet.db"),
    os.path.join(_BACKEND_DIR, "heartmeet.db"),
]

_ACTIVE_DB = None
for p in _CANDIDATES:
    if os.path.exists(p):
        _ACTIVE_DB = p
        break
if _ACTIVE_DB is None:
    _ACTIVE_DB = _CANDIDATES[0]  # 默认新建到 data 目录的 .sqlite

# 始终使用绝对路径指向真实存在的 db（覆盖 .env 中的相对路径）
DATABASE_URL = f"sqlite+aiosqlite:///{_ACTIVE_DB}"
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# AI 聊天助手配置（OpenAI 兼容 API）
AI_API_BASE = os.getenv("AI_API_BASE", "https://api.deepseek.com/v1")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "deepseek-chat")
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "500"))
AI_TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.8"))

# 图片上传配置
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5MB

# CORS 配置
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
