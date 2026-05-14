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

# Blaxel preview URLs in this setup are mapped to the app port exposed as 8000.
# Do not inherit the platform's edge/service PORT here, or the preview will proxy
# to a different internal port and return 502 even though uvicorn is running.
APP_PORT="${APP_INTERNAL_PORT:-8000}"
APP_HOST="${HOST:-0.0.0.0}"
APP_ENV_VALUE="${APP_ENV:-production}"
APP_WORKERS="${UVICORN_WORKERS:-1}"
APP_FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-*}"

APP_LAUNCHER="/tmp/start-billing-backend.sh"
cat > "${APP_LAUNCHER}" <<EOF
#!/bin/sh
set -eu
cd /app
exec uvicorn app.main:app \
  --host "${APP_HOST}" \
  --port "${APP_PORT}" \
  --workers "${APP_WORKERS}" \
  --proxy-headers \
  --forwarded-allow-ips "${APP_FORWARDED_ALLOW_IPS}"
EOF
chmod +x "${APP_LAUNCHER}"

APP_COMMAND="${APP_LAUNCHER}"

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
    \"APP_INTERNAL_PORT\": \"${APP_PORT}\",
    \"HOST\": \"${APP_HOST}\",
    \"APP_ENV\": \"${APP_ENV_VALUE}\",
    \"UVICORN_WORKERS\": \"${APP_WORKERS}\",
    \"FORWARDED_ALLOW_IPS\": \"${APP_FORWARDED_ALLOW_IPS}\",
    \"DATABASE_URL\": \"${DATABASE_URL:-}\",
    \"SECRET_KEY\": \"${SECRET_KEY:-}\",
    \"FRONTEND_URL\": \"${FRONTEND_URL:-}\",
    \"BACKEND_PUBLIC_URL\": \"${BACKEND_PUBLIC_URL:-}\",
    \"CORS_ORIGINS\": \"${CORS_ORIGINS:-}\",
    \"TRUSTED_HOSTS\": \"${TRUSTED_HOSTS:-}\",
    \"SESSION_COOKIE_SECURE\": \"${SESSION_COOKIE_SECURE:-}\",
    \"SESSION_SAME_SITE\": \"${SESSION_SAME_SITE:-}\",
    \"SESSION_COOKIE_DOMAIN\": \"${SESSION_COOKIE_DOMAIN:-}\",
    \"ACCESS_TOKEN_EXPIRE_MINUTES\": \"${ACCESS_TOKEN_EXPIRE_MINUTES:-}\",
    \"ALGORITHM\": \"${ALGORITHM:-}\",
    \"GOOGLE_CLIENT_ID\": \"${GOOGLE_CLIENT_ID:-}\",
    \"GOOGLE_CLIENT_SECRET\": \"${GOOGLE_CLIENT_SECRET:-}\",
    \"GITHUB_CLIENT_ID\": \"${GITHUB_CLIENT_ID:-}\",
    \"GITHUB_CLIENT_SECRET\": \"${GITHUB_CLIENT_SECRET:-}\",
    \"MICROSOFT_CLIENT_ID\": \"${MICROSOFT_CLIENT_ID:-}\",
    \"MICROSOFT_CLIENT_SECRET\": \"${MICROSOFT_CLIENT_SECRET:-}\",
    \"TWITTER_CLIENT_ID\": \"${TWITTER_CLIENT_ID:-}\",
    \"TWITTER_CLIENT_SECRET\": \"${TWITTER_CLIENT_SECRET:-}\"
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
