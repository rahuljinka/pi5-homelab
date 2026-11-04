# Bluetooth bridge image. Talks to the host's BlueZ over D-Bus, so it needs
# no Bluetooth hardware access of its own, and runs as an unprivileged user.
FROM python:3.12.16-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY bridge.py .
# "nobody": the host's D-Bus only accepts users that exist on the host.
USER 65534:65534
EXPOSE 8100
CMD ["uvicorn", "bridge:app", "--host", "0.0.0.0", "--port", "8100"]
