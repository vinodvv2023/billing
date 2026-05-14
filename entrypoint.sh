#!/bin/sh
set -eu

export PATH="/usr/local/bin:$PATH"

echo "Starting sandbox-api on port 8080..."
/usr/local/bin/sandbox-api &

echo "Waiting for sandbox-api to become ready..."
until curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; do
  sleep 0.2
done
echo "sandbox-api is ready"

echo "Running database migrations..."
alembic upgrade head

APP_PORT="${PORT:-8000}"
APP_ENV_VALUE="${APP_ENV:-production}"
APP_WORKERS="${UVICORN_WORKERS:-2}"
APP_FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-*}"

# Route the process through an explicit shell so wildcard-like values such as
# FORWARDED_ALLOW_IPS=* stay quoted and do not break uvicorn argument parsing.
APP_COMMAND="sh -lc 'exec uvicorn app.main:app --host 0.0.0.0 --port \"${APP_PORT}\" --workers \"${APP_WORKERS}\" --proxy-headers --forwarded-allow-ips \"${APP_FORWARDED_ALLOW_IPS}\"'"

echo "Starting BillingApp backend on port ${APP_PORT} through sandbox-api..."
PROCESS_PAYLOAD="{
  \"name\": \"billing-backend\",
  \"workingDir\": \"/app\",
  \"command\": \"$APP_COMMAND\",
  \"waitForCompletion\": false,
  \"restartOnFailure\": true,
  \"maxRestarts\": 25,
  \"env\": {
    \"PORT\": \"${APP_PORT}\",
    \"APP_ENV\": \"${APP_ENV_VALUE}\",
    \"UVICORN_WORKERS\": \"${APP_WORKERS}\",
    \"FORWARDED_ALLOW_IPS\": \"${APP_FORWARDED_ALLOW_IPS}\"
  }
}"

PROCESS_RESPONSE_FILE="/tmp/billing-backend-process-response.json"
HTTP_STATUS="$(curl -sS -o "${PROCESS_RESPONSE_FILE}" -w "%{http_code}" http://127.0.0.1:8080/process \
  -X POST \
  -H "Content-Type: application/json" \
  -d "${PROCESS_PAYLOAD}")"

if [ "${HTTP_STATUS}" -lt 200 ] || [ "${HTTP_STATUS}" -ge 300 ]; then
  echo "sandbox-api process launch failed with HTTP ${HTTP_STATUS}"
  echo "Process payload:"
  echo "${PROCESS_PAYLOAD}"
  echo "Process response:"
  cat "${PROCESS_RESPONSE_FILE}" || true
  exit 1
fi

echo "sandbox-api accepted process launch request:"
cat "${PROCESS_RESPONSE_FILE}" || true

wait
