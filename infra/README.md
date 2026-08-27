# Deploying to the VPS

Everything here runs under Dokploy on `dokploy-network`. Only PostgREST
containers and your apps get a public domain. The admin app and Databasus
bind to the Tailscale IP and are reachable from the tailnet only.

## Order

1. Tailscale on the VPS, laptop, phone. Note the VPS's tailnet hostname
   (`tailscale status`) and its 100.x IP (`tailscale ip -4`).
2. Postgres is already running from `postgres/compose.yml`. Create the admin
   role and the auth database once:

   ```sh
   docker exec -i -e APP_ADMIN_PASSWORD='<strong password>' <postgres-container> \
     sh < sql/01-app-admin.sh
   ```

   The script also grants `pg_read_all_stats` to `app_admin` and creates the
   `pg_stat_statements` extension. If the cluster already ran the old script,
   run those two lines by hand:

   ```sh
   docker exec -i <postgres-container> psql -U <superuser> -d postgres \
     -c "GRANT pg_read_all_stats TO app_admin" \
     -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements"
   ```

   `pg_stat_statements` only loads after Postgres restarts with
   `-c shared_preload_libraries=pg_stat_statements` in its command
   (`postgres/compose.yml` has it). Redeploy the Postgres compose once for that;
   the data volume is untouched. Without it the Monitoring page still shows
   connections, cache hit and size, only the slow-statement table stays empty.

3. Admin app. Dokploy → Compose → point at this repo, compose path
   `infra/admin/compose.yml`, branch `dev`. Env:

   | Name | Value |
   |---|---|
   | `TAILSCALE_IP` | from `tailscale ip -4` |
   | `TAILSCALE_HOSTNAME` | from `tailscale status`, e.g. `vps` |
   | `APP_ADMIN_PASSWORD` | same as step 2 |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |

   `TAILSCALE_HOSTNAME` also feeds the Connect page and the sidebar's Backups
   link (`http://<hostname>:4005`). `METRICS_SAMPLER=off` disables the
   once-a-minute stats sampler if you ever run more than one replica.

   No domain. Deploy.

4. Open `http://<hostname>:3100` from a tailnet device. The first visit shows
   `/setup`: pick an email and password, scan the TOTP QR code, store the backup
   codes. The app creates its own tables in `db_web_meta` on boot.

5. Databasus. Dokploy → Compose → `infra/databasus/compose.yml`, env
   `TAILSCALE_IP`. Open `http://<hostname>:4005`, add the Postgres connection
   (host `postgres`, user `postgres`, the superuser password), Google Drive
   destination, daily schedule, 30 days retention, ntfy webhook.

6. Restore test. In Databasus, restore the latest snapshot into a new database
   `restore_test`, then in the admin app's SQL editor on that database run
   `SELECT count(*) FROM <a table>`. Drop `restore_test` afterwards. Write the
   date into `plan.md`.

7. Add Cloudflare R2 as a second Databasus destination.

## PostgREST per project-env

Copy `postgrest/compose.template.yml`, replace `{{database}}`, set `PW` to the
authenticator password the admin app showed when the database was created, and
`JWT_SECRET`. Attach a domain in Dokploy.
