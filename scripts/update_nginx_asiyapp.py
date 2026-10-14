import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

nginx_conf = """server {
    server_name asiyapp.com www.asiyapp.com;

    root /srv/trikonekt/staging/frontend/build;
    index index.html;

    access_log /var/log/nginx/asiyapp.access.log;
    error_log /var/log/nginx/asiyapp.error.log;

    client_max_body_size 25m;

    # High-Performance Gzip Compression for 4G Networks
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        application/json
        application/javascript
        application/x-javascript
        application/xml
        application/xml+rss
        application/rss+xml
        image/svg+xml
        image/x-icon
        font/woff
        font/woff2;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300;
    }

    # Permanent Caching for Versioned React Static Assets (JS, CSS, Media)
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    location /media/ {
        alias /srv/trikonekt/staging/backend/media/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    location = /healthz {
        proxy_pass http://127.0.0.1:8001/healthz;
        proxy_set_header Host $host;
    }

    # Prevent caching of index.html so frontend updates are immediately visible
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    listen 443 ssl; # managed by Certbot
    listen [::]:443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/asiyapp.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/asiyapp.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.asiyapp.com) {
        return 301 https://$host$request_uri;
    }

    if ($host = asiyapp.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name asiyapp.com www.asiyapp.com;
    return 404;
}
"""

print("Updating Nginx configuration on EC2...")
proc = subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    f"echo '{nginx_conf}' | sudo tee /etc/nginx/sites-available/asiyapp.com > /dev/null && "
    "sudo nginx -t && sudo systemctl reload nginx"
], capture_output=True, text=True, check=True)

print("STDOUT:\n", proc.stdout)
print("Nginx updated and reloaded successfully!")
