# 1. Start from Python 3.11 slim (small-but-full-featured)
FROM python:3.11-slim

# 2. Install OS-level build deps for OpenCV & DLib
RUN apt-get update && apt-get install -y \
    build-essential cmake libglib2.0-0 libsm6 libxext6 libxrender-dev \
  && rm -rf /var/lib/apt/lists/*

# 3. Set working dir
WORKDIR /app

# 4. Copy only requirements first (cache layer)
COPY requirements.txt .

# 5. Install Python deps
RUN pip install --upgrade pip \
 && pip install -r requirements.txt

# 6. Copy the rest of your code
COPY . .

# 7. Download DLib models before runtime
RUN python download_models.py

# 8. Expose the port your app listens on
EXPOSE 8080

# 9. Use Gunicorn to serve your Flask/FastAPI app
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8080"]
