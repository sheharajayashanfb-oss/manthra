#!/usr/bin/env bash
# One-time VM setup. Run this on the VM as a user with sudo.
# Tested on Ubuntu 22.04 LTS.
set -euo pipefail

DOMAIN="manthra.informaticsint.au"
WWW_DIR="/var/www/manthra"

echo "Setting up Manthra distribution server on ${DOMAIN}..."

# ── nginx ─────────────────────────────────────────────────────────────────────
sudo apt-get update -q
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Create web root
sudo mkdir -p "${WWW_DIR}/releases/latest"
sudo chown -R "$USER:$USER" "${WWW_DIR}"

# Install nginx site
sudo cp /tmp/manthra-nginx.conf /etc/nginx/sites-available/manthra
sudo ln -sf /etc/nginx/sites-available/manthra /etc/nginx/sites-enabled/manthra
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# ── TLS (Let's Encrypt) ───────────────────────────────────────────────────────
# Make sure DNS for ${DOMAIN} points to this server's IP before running this.
echo ""
echo "Obtaining TLS certificate for ${DOMAIN}..."
sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m admin@informaticsint.com

sudo systemctl reload nginx

echo ""
echo "VM setup complete."
echo "Now from your dev machine, run: ./scripts/deploy.sh"
