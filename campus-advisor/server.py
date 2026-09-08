"""Campus Advisor — entry point"""
import os
import uvicorn

if __name__ == "__main__":
    # 默认监听 0.0.0.0 以便局域网/手机访问
    # 如需仅本地访问，设置环境变量 HOST=127.0.0.1
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8002"))
    # SQLite 和进程内限流都更适合单进程；需要横向扩展时应先迁移到
    # PostgreSQL/Redis，再提高 WEB_CONCURRENCY。
    workers = max(1, int(os.environ.get("WEB_CONCURRENCY", "1")))
    if workers != 1:
        raise RuntimeError("Campus SQLite runtime requires WEB_CONCURRENCY=1")
    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        workers=workers,
        log_level="info",
        proxy_headers=True,
        forwarded_allow_ips=os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1,::1"),
    )
