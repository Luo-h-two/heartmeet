# 一键部署指南

## 🚀 一键部署到 Railway

点击下方按钮，自动连接 GitHub 并部署项目：

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/Luo-h-two/heartmeet)

## 📋 部署步骤

1. 点击上方按钮
2. 使用 GitHub 账号登录 Railway
3. 授权 Railway 访问你的仓库
4. 等待部署完成（约 2-3 分钟）
5. 获取公开访问地址

## 🔗 部署后地址

部署成功后，你会得到类似这样的链接：
```
https://heartmeet-xxx.railway.app
```

| 页面 | 访问地址 |
|------|----------|
| **用户前端** | `https://heartmeet-xxx.railway.app/` |
| **管理后台** | `https://heartmeet-xxx.railway.app/admin.html` |
| **在线简历** | `https://heartmeet-xxx.railway.app/resume.html` |
| **API 文档** | `https://heartmeet-xxx.railway.app/docs` |

## 💡 为什么选择 Railway？

- ✅ 完全免费（每月 $5 额度）
- ✅ 支持持久进程和文件系统
- ✅ SQLite 数据库持久化
- ✅ 自动从 GitHub 拉取代码
- ✅ 一键部署，无需配置

## 📝 环境变量（可选）

如需自定义配置，可以添加以下环境变量：

| 变量名 | 值 |
|--------|-----|
| `PORT` | 8000 |
| `SECRET_KEY` | 自定义密钥 |

## 🛠️ 本地开发

```bash
# 进入项目目录
cd heart-meet/backend

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

访问：`http://localhost:8000`