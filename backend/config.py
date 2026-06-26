import os
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./heartmeet.db")
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
