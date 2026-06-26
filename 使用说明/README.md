# 心遇 (HeartMeet) - 相亲交友平台

## 📁 项目目录结构

```
heart-meet/
├── README.md                    # 项目总览
├── backend/                     # Python 后端
│   ├── main.py                  # FastAPI 入口，应用启动
│   ├── api.py                   # RESTful API 路由
│   ├── models.py                # 数据库模型定义
│   ├── schemas.py               # Pydantic 数据校验模型
│   ├── auth.py                  # JWT 鉴权模块
│   ├── recommender.py           # 推荐系统与行为分析
│   ├── database.py              # 数据库连接配置
│   ├── config.py                # 环境变量配置
│   ├── seed_data.py             # 模拟数据初始化
│   ├── requirements.txt         # Python 依赖
│   └── .env                     # 环境变量
├── frontend/                    # 前端
│   ├── index.html               # 主页面（SPA 入口）
│   ├── styles.css               # 全局样式（含暗黑模式）
│   └── app.js                   # 前端逻辑（路由/状态/API）
└── 使用说明/                     # 中文使用文档
    ├── 1-快速开始.md
    ├── 2-页面结构说明.md
    ├── 3-路由设计.md
    ├── 4-组件划分.md
    ├── 5-数据库设计.md
    ├── 6-API接口文档.md
    ├── 7-推荐算法说明.md
    └── 8-行为分析说明.md
```
