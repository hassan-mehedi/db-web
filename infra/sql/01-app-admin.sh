#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -v pw="$APP_ADMIN_PASSWORD" <<'SQL'
CREATE ROLE app_admin LOGIN PASSWORD :'pw' CREATEDB CREATEROLE;
CREATE DATABASE db_web_meta OWNER app_admin;
SQL
