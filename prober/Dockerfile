# syntax=docker/dockerfile:1.6
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml ./
RUN pip install .
COPY src/ ./src/
RUN pip install --no-deps -e .
USER nobody
EXPOSE 8000
ENTRYPOINT ["python", "-m", "prober"]
