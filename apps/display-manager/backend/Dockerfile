# Backend image. Two stages: build wheels (spidev needs a compiler) with the
# full Python image, then install them into the much smaller slim image.
FROM python:3.12.16 AS build
WORKDIR /build
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

FROM python:3.12.16-slim
WORKDIR /srv
COPY --from=build /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
