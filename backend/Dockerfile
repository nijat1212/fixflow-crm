FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY . .

# Cloud Run injects $PORT environment variable (default 8080)
ENV PORT=8080

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
