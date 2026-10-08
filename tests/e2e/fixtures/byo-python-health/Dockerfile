FROM python:3.12-slim@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800b0d6f
WORKDIR /app
COPY app.py .
ENV PORT=4500
EXPOSE 4500
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home app
USER app
CMD ["python", "app.py"]
