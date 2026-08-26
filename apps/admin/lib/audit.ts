export function audit(action: string, database: string, sql: string) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), action, database, sql }));
}
