#!/bin/bash
# List available Gemini models
# Usage: ./list-models.sh YOUR_API_KEY

API_KEY=${1:-$GEMINI_API_KEY}

if [ -z "$API_KEY" ]; then
    echo "Error: API key required"
    echo "Usage: ./list-models.sh YOUR_API_KEY"
    echo "Or set GEMINI_API_KEY environment variable"
    exit 1
fi

echo "Fetching available Gemini models..."
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}" | jq '.models[] | {name: .name, displayName: .displayName, supportedGenerationMethods: .supportedGenerationMethods}'
