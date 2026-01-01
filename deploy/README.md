# 3chat Deployment Guide

This directory contains all the configuration files needed to deploy a fresh 3chat IM system.

## Architecture

The system consists of two servers:

1. **Frontend Server (Server 1)** - Nginx reverse proxy + static file hosting
2. **Backend Server (Server 2)** - Supabase self-hosted (PostgreSQL, Auth, Storage, Realtime, Edge Functions)

## Directory Structure

```
deploy/
├── nginx/
│   ├── nginx.conf          # Main Nginx configuration
│   └── 1388.you.conf       # Site-specific configuration (rename as needed)
└── supabase/
    ├── docker-compose.yml  # Supabase Docker Compose
    ├── .env.example        # Environment variables template
    └── volumes/
        ├── api/kong.yml    # Kong API gateway config
        ├── db/             # Database init scripts
        ├── logs/vector.yml # Log aggregation config
        └── pooler/         # Connection pooler config
```

## Deployment Steps

### Server 2 (Backend - Supabase)

1. Install Docker and Docker Compose
2. Copy the `supabase/` directory to `/opt/supabase/docker/`
3. Copy `.env.example` to `.env` and fill in your secrets:
   - Generate new `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`
   - Use https://supabase.com/docs/guides/self-hosting for key generation
4. Start services: `docker compose up -d`
5. Copy edge functions from `../supabase/functions/` to `/opt/supabase/docker/volumes/functions/`
6. Apply database migrations from `../supabase/migrations/`

### Server 1 (Frontend - Nginx)

1. Install Nginx (or use BaoTa panel)
2. Copy `nginx/nginx.conf` to `/etc/nginx/nginx.conf` (or panel equivalent)
3. Copy `nginx/1388.you.conf` to your sites directory, rename and update:
   - Domain names
   - SSL certificate paths
   - Backend server IP (proxy_pass addresses)
4. Build the frontend: `npm install && npm run build`
5. Copy `dist/` contents to your web root
6. Reload Nginx: `nginx -s reload`

### Frontend Configuration

1. Copy `.env.example` to `.env` in the project root
2. Update with your Supabase URL and keys:
   ```
   VITE_SUPABASE_URL=https://your-api-domain.com
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## Security Notes

- Never commit real `.env` files with secrets
- Generate new JWT secrets for production
- Use strong passwords for all services
- Enable SSL/TLS for all public endpoints
- Restrict database access to internal network only
