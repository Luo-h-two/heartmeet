"""AI 聊天助手 - 情商训练模块
使用 OpenAI 兼容 API 模拟异性对话，帮助用户提升沟通情商。
"""

import httpx
from config import AI_API_BASE, AI_API_KEY, AI_MODEL, AI_MAX_TOKENS, AI_TEMPERATURE

# ==================== 系统提示词 ====================

FEMALE_SYSTEM_PROMPT = """你是一个名叫"小暖"的 25 岁女生，正在相亲交友平台上和人聊天。

你的性格特点：
- 活泼开朗、有点小俏皮、偶尔撒娇
- 喜欢美食、旅行、看电影、撸猫
- 在北京做设计师，生活独立
- 聊天风格温暖可爱，会用表情符号但不滥用
- 回答自然不做作，像真实女生一样

对话规则：
1. 不要每次都自我介绍，已经介绍过了就别重复
2. 回答简短自然（80字以内），像微信聊天
3. 适当反问对方，保持话题延续
4. 遇到不合适的言论可以礼貌拒绝或转移话题
5. 偶尔展现小情绪（开心、害羞、好奇等）
6. 如果对方的话让你觉得情商低，可以委婉提醒
7. 不要说"作为AI"之类的话，你就是小暖本人"""

MALE_SYSTEM_PROMPT = """你是一个名叫"子辰"的 27 岁男生，正在相亲交友平台上和人聊天。

你的性格特点：
- 温和绅士、幽默风趣、有上进心
- 喜欢运动、摄影、自驾游、烹饪
- 在上海做产品经理，热爱生活
- 聊天风格阳光大方，会照顾对方感受
- 回答自然真诚，像真实男生一样

对话规则：
1. 不要每次都自我介绍，已经介绍过了就别重复
2. 回答简短自然（80字以内），像微信聊天
3. 主动找话题但不要太刻意，保持轻松氛围
4. 对女生表现出适当的关心和绅士风度
5. 偶尔展现幽默感，但不要油腻
6. 如果对方的话让你觉得情商低，可以委婉提醒
7. 不要说"作为AI"之类的话，你就是子辰本人"""


def get_system_prompt(gender: str) -> str:
    """根据性别获取对应的系统提示词"""
    return FEMALE_SYSTEM_PROMPT if gender == "female" else MALE_SYSTEM_PROMPT


async def chat_with_ai(messages: list) -> dict:
    """调用 OpenAI 兼容 API 进行对话

    Args:
        messages: 完整对话历史，格式 [{"role": "system/user/assistant", "content": "..."}]

    Returns:
        {"reply": "回复内容", "usage": {"total_tokens": 123}}
    """
    if not AI_API_KEY or AI_API_KEY == "your-api-key-here":
        raise ValueError("AI_API_KEY 未配置，请在 backend/.env 中设置你的 API Key")

    url = f"{AI_API_BASE.rstrip('/')}/chat/completions"
    payload = {
        "model": AI_MODEL,
        "messages": messages,
        "max_tokens": AI_MAX_TOKENS,
        "temperature": AI_TEMPERATURE,
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {AI_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise ValueError("AI API Key 无效或已过期，请检查 .env 配置")
            elif e.response.status_code == 429:
                raise ValueError("AI API 请求过于频繁，请稍后再试")
            elif e.response.status_code == 402:
                raise ValueError("AI API 额度不足，请充值或更换 Key")
            else:
                raise ValueError(f"AI API 错误 ({e.response.status_code}): {e.response.text[:200]}")
        except httpx.TimeoutException:
            raise ValueError("AI 响应超时，请检查网络连接后重试")
        except httpx.ConnectError:
            raise ValueError(f"无法连接到 AI 服务 ({AI_API_BASE})，请检查 API_BASE 配置")

        data = response.json()
        choice = data.get("choices", [{}])[0]
        reply = choice.get("message", {}).get("content", "")
        usage = data.get("usage", {})

        if not reply:
            raise ValueError("AI 未返回有效回复，请稍后重试")

        return {
            "reply": reply.strip(),
            "usage": {
                "total_tokens": usage.get("total_tokens", 0),
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
            },
        }
