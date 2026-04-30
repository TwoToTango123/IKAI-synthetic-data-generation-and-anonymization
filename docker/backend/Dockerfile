FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Directory for optional file logs (containers typically use stdout/stderr)
ENV LOG_FILE=/var/log/ikai/ikai_app.log

RUN mkdir -p /var/log/ikai
RUN chown -R root:root /var/log/ikai

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY schemas ./schemas

RUN mkdir -p /app/logs
RUN chmod 755 /app/logs

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
