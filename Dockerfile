FROM python:3.11-slim

WORKDIR /app
COPY auth/ .

RUN pip install fastapi uvicorn pyjwt psycopg2-binary redis requests

EXPOSE 3000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
