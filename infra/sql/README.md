# Cluster one-offs

`01-app-admin.sh` creates the `app_admin` role and the `db_web_meta` database.

Locally, `compose.dev.yml` mounts this directory into
`/docker-entrypoint-initdb.d`, so it runs on first start of an empty volume.

On the VPS, run it once by hand against the running container:

```sh
docker exec -i -e APP_ADMIN_PASSWORD='<strong password>' <postgres-container> \
  sh < infra/sql/01-app-admin.sh
```

`app_admin` deliberately lacks superuser. `postgres` stays outside the admin app.
