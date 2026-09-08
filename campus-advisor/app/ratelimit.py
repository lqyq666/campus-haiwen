"""简易内存速率限制中间件"""
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """基于 IP 的速率限制，每 IP 每分钟 N 次请求"""

    def __init__(self, app, max_per_minute: int = 60):
        super().__init__(app)
        self.max_per_minute = max_per_minute
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        # 跳过静态文件
        path = request.url.path
        STATIC_EXTENSIONS = (".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".woff", ".woff2")
        if path.startswith("/static") or path == "/" or path.split("/")[-1].endswith(STATIC_EXTENSIONS):
            return await call_next(request)

        # 按 IP 限流
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60

        # 清理过期记录
        self._requests[client_ip] = [t for t in self._requests[client_ip] if now - t < window]

        if len(self._requests[client_ip]) >= self.max_per_minute:
            return JSONResponse(
                status_code=429,
                content={"error": "Too many requests, please try again later"},
            )

        self._requests[client_ip].append(now)
        return await call_next(request)
