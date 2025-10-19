#!/bin/bash
# Create dummy Lambda packages for testing Terraform configuration

BACKEND_DIR="../../../../services/backend"
DIST_DIR="$BACKEND_DIR/dist"

# Create dist directory structure
mkdir -p "$DIST_DIR/handlers"
mkdir -p "$DIST_DIR/agents"
mkdir -p "$DIST_DIR/orchestration"

# Create dummy handler files
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/handlers/upload_presign.mjs"
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/handlers/cards_create.mjs"
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/handlers/cards_list.mjs"
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/handlers/cards_get.mjs"
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/handlers/cards_delete.mjs"
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/handlers/cards_revalue.mjs"

# Create dummy agent files
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/agents/pricing-agent.mjs"
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/agents/authenticity_agent.mjs"

# Create dummy orchestration files
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/orchestration/rekognition-extract.mjs"
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/orchestration/aggregator.mjs"
echo 'export const handler = async (event) => ({ statusCode: 200, body: "OK" });' > "$DIST_DIR/orchestration/error-handler.mjs"

echo "✅ Dummy Lambda files created in $DIST_DIR"
echo "You can now run: terraform plan"
