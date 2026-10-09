#!/bin/bash
set -e

echo "=== Checking DNS Resolution for trieducation.in ==="
RESOLVED_APEX=$(getent hosts trieducation.in 2>/dev/null | awk '{print $1}')
echo "Apex domain (trieducation.in) resolves to: '${RESOLVED_APEX}' (Target: 65.0.40.184)"

if [ "$RESOLVED_APEX" != "65.0.40.184" ]; then
    echo ""
    echo "[!] DNS A record for trieducation.in has not propagated to 65.0.40.184 yet."
    echo "Current resolution: '${RESOLVED_APEX}'"
    echo "Please ensure in your GoDaddy DNS settings:"
    echo "  1. Type: A, Name: @, Value: 65.0.40.184"
    echo "  2. Domain status 'clientHold' is cleared via WHOIS registrant email verification."
    exit 1
fi

echo ""
echo "=== DNS Verified! Requesting Let's Encrypt SSL Certificate ==="
sudo certbot --nginx -d trieducation.in -d www.trieducation.in --non-interactive --agree-tos -m contact@trikonekt.com --redirect

echo "=== Testing Nginx Configuration ==="
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "=== SUCCESS: https://trieducation.in and https://www.trieducation.in are LIVE with SSL! ==="
