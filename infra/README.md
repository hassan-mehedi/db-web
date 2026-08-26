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

   Then the Better Auth tables:

   ```sh
   docker exec -i <postgres-container> psql -U app_admin -d db_web_meta < sql/better-auth-schema.sql
   ```

3. Admin app. Dokploy → Compose → point at this repo, compose path
   `infra/admin/compose.yml`, branch `dev`. Env:

   | Name | Value |
   |---|---|
   | `TAILSCALE_IP` | from `tailscale ip -4` |
   | `TAILSCALE_HOSTNAME` | from `tailscale status`, e.g. `vps` |
   | `APP_ADMIN_PASSWORD` | same as step 2 |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |

   No domain. Deploy. Then seed the single user. The seed script needs
   `tsx`, which is not in the runtime image, so run it from your laptop
   against the VPS database over an SSH tunnel:

   ```sh
   ssh -L 15432:<postgres-container-ip>:5432 vps
   DATABASE_URL_META=postgres://app_admin:<pw>@localhost:15432/db_web_meta \
   BETTER_AUTH_SECRET=<same as Dokploy> \
   BETTER_AUTH_URL=http://<hostname>:3100 \
   pnpm --filter admin seed:admin
   ```

   `BETTER_AUTH_SECRET` must match the deployed value: the TOTP secret is
   encrypted with it.

4. Open `http://<hostname>:3100` from a tailnet device. Log in, TOTP, done.

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
