#!/usr/bin/env bash
# Creates Secret Manager secrets for the Toodledo MCP server.
# Run once after creating the GCloud project.
#
# Usage: bash scripts/setup-secrets.sh

set -euo pipefail

PROJECT="toodledo-mcp"
REGION="us-central1"

echo "=== Toodledo MCP - Secret Manager Setup ==="
echo "Project: $PROJECT"
echo ""

# Ensure we're targeting the right project
gcloud config set project "$PROJECT"

# Create secrets (ignores "already exists" errors)
create_secret() {
  local name="$1"
  if gcloud secrets describe "$name" --project="$PROJECT" &>/dev/null; then
    echo "Secret '$name' already exists, skipping creation."
  else
    echo "Creating secret '$name'..."
    gcloud secrets create "$name" --replication-policy="automatic" --project="$PROJECT"
  fi
}

create_secret "TOODLEDO_CLIENT_ID"
create_secret "TOODLEDO_CLIENT_SECRET"
create_secret "TOODLEDO_TOKENS"
create_secret "MCP_BEARER_TOKEN"

echo ""
echo "=== Setting secret values ==="

# TOODLEDO_CLIENT_ID
read -rp "Toodledo Client ID [claudemcp]: " CLIENT_ID
CLIENT_ID="${CLIENT_ID:-claudemcp}"
echo -n "$CLIENT_ID" | gcloud secrets versions add "TOODLEDO_CLIENT_ID" --data-file=- --project="$PROJECT"

# TOODLEDO_CLIENT_SECRET
read -rsp "Toodledo Client Secret: " CLIENT_SECRET
echo ""
echo -n "$CLIENT_SECRET" | gcloud secrets versions add "TOODLEDO_CLIENT_SECRET" --data-file=- --project="$PROJECT"

# TOODLEDO_TOKENS - read from local tokens file
TOKENS_FILE="$HOME/.toodledo-mcp/tokens.json"
if [[ -f "$TOKENS_FILE" ]]; then
  echo "Found tokens at $TOKENS_FILE"
  cat "$TOKENS_FILE" | gcloud secrets versions add "TOODLEDO_TOKENS" --data-file=- --project="$PROJECT"
  echo "Uploaded tokens to Secret Manager."
else
  echo "WARNING: No tokens file found at $TOKENS_FILE"
  echo "You'll need to manually add the TOODLEDO_TOKENS secret version."
fi

# MCP_BEARER_TOKEN - generate a random one
BEARER_TOKEN=$(openssl rand -base64 32 | tr -d '/+=' | head -c 48)
echo -n "$BEARER_TOKEN" | gcloud secrets versions add "MCP_BEARER_TOKEN" --data-file=- --project="$PROJECT"
echo ""
echo "Generated MCP Bearer Token: $BEARER_TOKEN"
echo "Save this! You'll need it to configure claude.ai's remote MCP server."

echo ""
echo "=== Granting Cloud Run access ==="

# Get the default compute service account
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in TOODLEDO_CLIENT_ID TOODLEDO_CLIENT_SECRET TOODLEDO_TOKENS MCP_BEARER_TOKEN; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT" \
    --quiet
done

# TOODLEDO_TOKENS also needs secretVersionAdder for token refresh writes
gcloud secrets add-iam-policy-binding "TOODLEDO_TOKENS" \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretVersionAdder" \
  --project="$PROJECT" \
  --quiet

echo ""
echo "=== Done ==="
echo "Secrets created and service account ($SA) granted access."
echo ""
echo "Next steps:"
echo "  1. Push to master — GitHub Actions will build and deploy automatically"
echo "  2. Configure claude.ai with the Cloud Run URL and bearer token"
