# Base Image: Python 3.11 Slim
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Set working directory inside container
WORKDIR /app

# Install system dependencies needed for psycopg2 and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file and install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY . /app/

# Expose Gunicorn application port
EXPOSE 8000

# Default command to start WSGI server
CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000", "--workers=2", "--threads=2", "--timeout=60", "--max-requests=500", "--max-requests-jitter=50"]
