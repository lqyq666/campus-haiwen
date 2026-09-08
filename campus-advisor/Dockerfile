FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir --retries 5 --timeout 120 -r requirements.txt

# 复制代码
COPY . .

# 暴露端口
EXPOSE 8002

# 启动（Docker 内绑定 0.0.0.0，通过 nginx 反代暴露）
ENV HOST=0.0.0.0
CMD ["python", "server.py"]
