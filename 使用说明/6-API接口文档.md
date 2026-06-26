# 6. API 接口文档

所有 API 基于 RESTful 风格，前缀 `/api`。

Swagger 文档地址：`http://localhost:8000/docs`

## 认证说明

除了 `/api/register` 和 `/api/login`，所有接口需要在 Header 中携带 Token：

```
Authorization: Bearer <access_token>
```

## 接口列表

### 一、用户系统

#### 1. 注册
```
POST /api/register
Content-Type: application/json

请求体：
{
  "phone": "13800138001",       // 11位手机号
  "password": "Pass@123",       // 至少6位，含字母
  "nickname": "阳光小明",        // 1-50字符
  "gender": "male"              // male/female/other
}

响应：
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { ... }
}
```

#### 2. 登录
```
POST /api/login

请求体：
{
  "phone": "13800138001",
  "password": "Pass@123"
}

响应：同上（Token + User）
```

#### 3. 获取当前用户
```
GET /api/me
Authorization: Bearer <token>

响应：User 对象
```

#### 4. 更新个人信息
```
PUT /api/me

请求体（所有字段可选）：
{
  "nickname": "新昵称",
  "age": 26,
  "gender": "male",
  "city": "北京",
  "occupation": "产品经理",
  "bio": "个人介绍...",
  "interests": ["旅行", "摄影"],
  "personality_tags": ["开朗", "幽默"]
}

响应：更新后的 User 对象
```

#### 5. 更新择偶偏好
```
PUT /api/me/preference

请求体：
{
  "min_age": 20,
  "max_age": 35,
  "gender": "female",
  "cities": ["北京", "上海"],
  "tags": ["文艺", "运动"]
}
```

### 二、推荐系统

#### 6. 获取推荐用户
```
GET /api/recommend?page=1&page_size=10&gender=female&min_age=20&max_age=35&city=北京&tags=旅行,摄影

响应：
{
  "users": [
    {
      "id": 2,
      "nickname": "文艺小鹿",
      "avatar": "...",
      "age": 24,
      "gender": "female",
      "city": "北京",
      "occupation": "设计师",
      "bio": "一只热爱插画...",
      "interests": ["绘画", "手作"],
      "personality_tags": ["文艺", "温柔"],
      "common_interests": ["摄影"],       // 共同兴趣
      "recommend_reason": "共同兴趣: 摄影、同城"  // 推荐理由
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 10
}
```

#### 7. 获取用户详情
```
GET /api/users/{user_id}

响应：User 对象（完整信息）
```

### 三、交互行为

#### 8. 用户操作（喜欢/跳过/打招呼）
```
POST /api/actions

请求体：
{
  "target_user_id": 2,
  "action_type": "like"  // like | skip | favorite | greet
}

响应：
{
  "success": true,
  "is_matched": false,          // 是否双向匹配
  "message": "操作成功"
}
```

当 `is_matched: true` 时，表示双方互相喜欢！

#### 9. 行为日志上报
```
POST /api/behaviors

请求体：
{
  "target_user_id": 2,
  "action": "view_card",       // view_card|click_detail|like|skip|stay|greet|search
  "duration_ms": 3500,         // 停留时长（毫秒）
  "extra": {"source": "recommend"}
}
```

### 四、社交功能

#### 10. 获取匹配列表（互相喜欢的人）
```
GET /api/matches

响应：
{
  "matches": [
    { "id": 2, "nickname": "文艺小鹿", "avatar": "...", "age": 24, "city": "北京" }
  ],
  "total": 1
}
```

#### 11. 获取聊天列表
```
GET /api/chat-list

响应：
{
  "chat_list": [
    {
      "user_id": 2,
      "nickname": "文艺小鹿",
      "avatar": "...",
      "last_action": "greet",
      "last_message": "你好呀~",
      "time": "2026-06-23T10:30:00"
    }
  ],
  "total": 1
}
```

### 五、行为分析

#### 12. 获取用户行为分析
```
GET /api/analysis

响应：
{
  "user_id": 1,
  "total_views": 45,
  "total_likes": 12,
  "total_skips": 20,
  "like_rate": 37.5,
  "preferred_genders": { "female": 10, "male": 2 },
  "preferred_ages": { "18-24": 5, "25-30": 6, "31-35": 1, "36+": 0 },
  "preferred_cities": { "北京": 8, "上海": 3 },
  "preferred_tags": { "文艺": 7, "摄影": 5, "旅行": 4, ... },
  "recent_behaviors": [
    { "action": "like", "target_user_id": 5, "duration_ms": 3200, "created_at": "..." }
  ]
}
```

### 六、辅助接口

#### 13. 获取所有标签
```
GET /api/tags

响应：
{
  "interests": ["旅行", "摄影", "美食", ...],
  "personality": ["开朗", "幽默", "文艺", ...]
}
```

## 错误响应格式

```json
{
  "detail": "错误描述信息"
}
```

HTTP 状态码：
- `200` - 成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未认证
- `404` - 资源不存在
