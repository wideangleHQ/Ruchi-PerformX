const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  const res = await client.query("SELECT id, full_name, role, department_id, deleted_at FROM users WHERE full_name ILIKE '%Reception%';");
  console.log("RECEPTION_DESK:", res.rows);
  await client.end();
}
run().catch(console.error);
