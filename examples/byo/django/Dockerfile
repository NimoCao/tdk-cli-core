# A real `django-admin startproject` app (default SQLite, no external database): the generator runs at build time.
FROM python:3.12-slim@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800b0d6f
ENV PYTHONUNBUFFERED=1
WORKDIR /work
RUN pip install --no-cache-dir django \
 && django-admin startproject app . \
 && python manage.py migrate --noinput
# runserver must listen beyond loopback (0.0.0.0) and on the port TDK assigns.
CMD ["sh", "-c", "python manage.py runserver 0.0.0.0:${PORT:-8000} --noreload"]
