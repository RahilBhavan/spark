# SPARK BTC — scheduler or api_server
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Default: run scheduler (override in compose for api)
CMD ["python", "scheduler.py"]
