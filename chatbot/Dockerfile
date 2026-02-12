FROM python:3.11-slim

WORKDIR /app

# Install only chatbot dependencies (subset of root requirements.txt)
COPY chatbot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy chatbot package
COPY chatbot/ ./chatbot/

EXPOSE 8000

CMD ["uvicorn", "chatbot.api:app", "--host", "0.0.0.0", "--port", "8000"]
