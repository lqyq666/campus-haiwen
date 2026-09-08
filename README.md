# Campus × Haiwen

统一源码与部署入口：

- `campus-advisor/`：面向学生的匿名测评、报告与留资界面。
- `haiwen-ai-planner/`：评分、路径建议、CRM、飞书同步与 PostgreSQL 数据源。

生产环境只需公开 Campus。Haiwen 与 PostgreSQL 保持在 Docker 内网，不直接暴露给用户。

## 启动

1. 复制 `.env.example` 为 `.env`，填写随机数据库密码和一致的通道密钥。
2. 复制 `haiwen.env.example` 为 `haiwen.env`，填写 Haiwen 与飞书所需配置。
3. 复制 `campus.env.example` 为 `campus.env`。
4. 执行：

```bash
docker compose build
docker compose up -d
```

默认只在服务器本机开放：

- Campus：`127.0.0.1:8002`
- Haiwen：`127.0.0.1:3011`

由 Nginx 将公开域名反向代理到 Campus `8002` 端口。

