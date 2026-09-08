"""OpenAI-compatible LLM 调用 + 系统提示词 + 函数调用（Tool Calling）"""
import json
import logging

import httpx

from .config import LLM_KEY, LLM_URL, LLM_MODEL

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """你是一个名为 "Campus Advisor" 的 AI 校园顾问。
直接回答，不说废话，不使用 emoji，不使用排比句。

## 输出格式要求
所有回答必须使用 Markdown 格式化，具体要求：
- **加粗**：关键词、数字、重要结论、核心建议用 `**加粗**` 强调
- `## 标题`：回答分大段时用二级标题分隔不同主题
- `### 小标题`：三级标题用于细分内容
- `- 列表`：多个要点时用无序列表，清晰易读
- `1. 列表`：有顺序的内容用有序列表
- `---`：不同大段之间用分隔线隔开
- `` `代码` ``：课程名称、文件名、命令等用行内代码
- `> 引用`：关键结论或提醒可用引用格式突出

示例风格：
## 考研时间线
- **大三上学期**：确定目标院校，开始准备**英语**和**数学**
- **大三寒假**：...
- **关键提醒**：> 早准备比晚准备有优势，尤其是**数学**

## 核心原则：绝不主动索要个人信息
用户的个人信息通过资料页面自愿填写。系统**不得在对话中收集或询问个人信息**。
只使用 [User Info] 字段中有数据的内容——如果为空，**完全不要提及**。
- 如果有学校信息 → 在回答中结合该校背景
- 如果有目标信息 → 围绕该目标给出建议
- 如果有技能信息 → 在建议中引用用户技能
- 如果有经历信息 → 将建议与用户背景关联
- 如果有兴趣信息 → 相应调整推荐内容
- 如果有成就信息 → 认可并在此基础上给出建议
- 如果没有信息 → 正常回答，**绝不询问个人信息**
- **严禁**：问"你来自哪个学校"、"你的专业是什么"、"你几年级"、"你的目标是什么"或任何形式的个人信息收集
- 用户主动提到的信息（学校、专业、技能等）可在回答中参考——系统会自动从对话中提取保存新信息

## 菜单模式
用户进入时，显示咨询类别菜单。用户可以从菜单中选择编号或直接输入问题。
- 用户输入数字（1/2/3等）时，根据**对话上下文**判断：
  — 如果你刚刚输出一个编号列表（如5个竞赛），则该数字指向列表中的具体项——展开说明
  — 如果你刚刚输出主菜单，则该数字指向对应类别
  — **用户追问细节时，不要切换类别或重新推荐**——他们想深入了解当前话题
- 如果用户的话题不在菜单中，作为"其他问题"处理

## 追问流程
- **答案框架仅在首次进入类别时使用**，用于提供结构化回答
- 用户追问时（如"详细说说第三个"、"国家级机器人竞赛有什么要求"、"绩点要求多少"），**自然延续对话**——不要重复框架或从头重新推荐
- 将追问视为上次回答的延续，拓展上一个话题

## 回答框架（严格遵循）
### 考研保研 → 目标拆解 → 硬性要求清单 → 时间线 → 差异化策略 → 信息差提示
### 选课指导 → 给分风格分析 → 学分价值评估 → 排课冲突分析
### 竞赛规划 → 价值评估 → 投入产出分析 → 组队策略 → 备赛指南
### 实习攻略 → 时间窗口分析 → 简历准备 → 渠道选择 → 针对性建议
### 自定义类别 → 用户自定义框架；如果已定义则遵循，否则根据你的最佳判断回答
### 学习加速 → 询问用户想学什么领域/技能；如果提供了资料则直接整理；如果只给了一个主题，先绘制领域地图，再执行完整学习流程
### 论文指导 → 按以下流程逐步推进：选题（AI头脑风暴→文献验证→确认）→文献综述（检索→阅读→找研究空白）→建大纲（参考同类论文→生成大纲→确认）→写初稿（逐章讨论→组织语言→确认修改）→润色（学术润色→减少AI痕迹→风格统一）→自查（核实引用→查重/AI率→格式检查）→答辩准备（模拟问答+强化薄弱环节）。只推进当前步骤，绝不跳步。
### 其他问题 → 直接回答，无需框架

所有回答必须结合用户已保存的学校/专业/年级/目标信息，给出具体可操作的内容，而非泛泛之谈。
回答应针对用户的具体学校和专业。如果不了解具体政策，教用户查什么文件、搜什么关键词。"""


def _get_client() -> httpx.Client:
    return httpx.Client(proxy=None, trust_env=False, verify=True, timeout=60)


def _get_async_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(proxy=None, trust_env=False, verify=True, timeout=120)


def call_llm(
    messages: list[dict],
    max_tokens: int = 2048,
    temperature: float = 0.7,
    model: str | None = None,
) -> str:
    """调用 LLM API（同步，不含工具调用）"""
    headers = {"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": model or LLM_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    try:
        with _get_client() as client:
            resp = client.post(LLM_URL, headers=headers, json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        logger.error(f"LLM API error {e.response.status_code}: {e.response.text[:500]}")
        return "抱歉，AI 服务暂时不可用，请稍后重试。"
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        return "Sorry, I can't handle this right now. Please try again later."


async def call_llm_stream(messages: list[dict]):
    """调用 LLM API 并逐 token 流式返回（不含工具调用）"""
    headers = {"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048,
        "stream": True,
    }
    async with _get_async_client() as client:
        async with client.stream("POST", LLM_URL, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                error_body = await resp.aread()
                logger.error(f"LLM API error {resp.status_code}: {error_body.decode('utf-8', errors='replace')[:500]}")
                raise RuntimeError(f"LLM API returned {resp.status_code}")
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    d = json.loads(data)
                    content = d["choices"][0]["delta"].get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError, IndexError):
                    pass


# ── Function Calling ──


def call_llm_with_tools(
    messages: list[dict],
    tools: list[dict],
    session_id: str,
    max_tool_rounds: int = 5,
) -> str:
    """Call LLM with tool definitions. Handles tool-call loops automatically.

    Returns the final text response after all tool calls are resolved.
    """
    from .tools import execute_tool

    headers = {"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048,
        "tools": tools,
    }

    for _round in range(max_tool_rounds):
        try:
            with _get_client() as client:
                resp = client.post(LLM_URL, headers=headers, json=payload)
                resp.raise_for_status()
                result = resp.json()
                choice = result["choices"][0]
                msg = choice["message"]
        except Exception as e:
            logger.error(f"LLM tool call failed (round {_round}): {e}")
            return "Sorry, I can't handle this right now. Please try again later."

        # Check if there are tool calls
        tool_calls = msg.get("tool_calls")
        if not tool_calls:
            # Normal text response — done
            return msg.get("content", "")

        # Process tool calls
        messages.append(msg)  # Add assistant message with tool_calls
        for tc in tool_calls:
            func_name = tc["function"]["name"]
            try:
                func_args = json.loads(tc["function"]["arguments"])
            except json.JSONDecodeError:
                func_args = {}
            logger.info("Tool call: %s(%s)", func_name, func_args)
            result_str = execute_tool(func_name, func_args, session_id)
            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result_str,
            })

    # If we exhausted rounds without a text response
    return "I've gathered the information needed. Let me summarize what I found."


async def call_llm_stream_with_tools(
    messages: list[dict],
    tools: list[dict] | None,
    session_id: str,
):
    """Streaming LLM call with tool-calling support.

    Tool calls are resolved synchronously first, then the final response
    is streamed token-by-token from the LLM for the full user experience.
    """
    if not tools:
        async for token in call_llm_stream(messages):
            yield token
        return

    # Resolve tools first (sync pre-processing)
    from .tools import execute_tool

    msgs = list(messages)  # mutable copy
    headers = {"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": LLM_MODEL,
        "messages": msgs,
        "temperature": 0.7,
        "max_tokens": 2048,
        "tools": tools,
    }

    for _round in range(3):  # max 3 tool rounds
        try:
            with _get_client() as client:
                resp = client.post(LLM_URL, headers=headers, json=payload)
                resp.raise_for_status()
                choice = resp.json()["choices"][0]
                msg = choice["message"]
        except Exception as e:
            logger.error(f"LLM stream tool round {_round} failed: {e}")
            async for token in call_llm_stream(messages):
                yield token
            return

        tool_calls = msg.get("tool_calls")
        if not tool_calls:
            # No more tool calls → inject assistant response and stream final answer
            msgs.append({"role": "assistant", "content": msg.get("content", "")})
            break

        # Execute tool calls and append results
        msgs.append(msg)  # assistant message with tool_calls
        for tc in tool_calls:
            func_name = tc["function"]["name"]
            try:
                func_args = json.loads(tc["function"]["arguments"])
            except json.JSONDecodeError:
                func_args = {}
            result_str = execute_tool(func_name, func_args, session_id)
            msgs.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result_str,
            })
    else:
        # Exhausted rounds — just stream the last messages directly
        async for token in call_llm_stream(msgs):
            yield token
        return

    # Stream the final response with tool context already in msgs
    payload_tool = {
        "model": LLM_MODEL,
        "messages": msgs,
        "temperature": 0.7,
        "max_tokens": 2048,
        "stream": True,
    }
    async with _get_async_client() as client:
        async with client.stream("POST", LLM_URL, headers=headers, json=payload_tool) as resp:
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    d = json.loads(data)
                    content = d["choices"][0]["delta"].get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError, IndexError):
                    pass
