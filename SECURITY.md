# Security notes

db-web can create and drop databases and run arbitrary SQL as `app_admin`.
Treat the admin port like SSH.

- Keep `BIND_IP` on `127.0.0.1` or a Tailscale address. If you need it on a
  public interface, put a TLS reverse proxy in front and keep the container
  bound to localhost. Never `0.0.0.0` on plain HTTP.
- The single account requires a password and a TOTP code. Sign-in and code
  checks are rate limited to 5 per minute per IP. Backup codes are shown once
  at setup.
- Session cookies are `HttpOnly`, `SameSite=Strict`, and `Secure` when
  `DB_WEB_URL` starts with `https://`. Sessions last 12 hours.
- Responses carry `Content-Security-Policy`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin`.
- `app_admin` has `CREATEDB` and `CREATEROLE`, not superuser. The `postgres`
  superuser password never reaches the app.
- Metric samples and query history live in `db_web_meta` on the same server.
  Query history stores the SQL text you ran, including any literals in it.

Found a problem? Open a GitHub issue marked "security" or contact the
maintainer through the profile on the repository page. Please do not post a
working exploit before a fix is out.
