# Dockerfile in the root directory

# Use the official Python base image
FROM python:3.12-slim

# Set environment variable to make Python output appear immediately
ENV PYTHONUNBUFFERED 1

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file and install dependencies
# We copy the entire project into /app, so the requirements.txt path is /app/backend/requirements.txt
COPY backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy the entire backend source code
COPY backend /app/backend

# The main application entrypoint is in backend/app/main.py
# The web server is Uvicorn, which will run the FastAPI app
# We tell it to run 'main:app' from the 'backend.app' directory.
# This assumes your main.py is inside backend/app/.
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8080"]