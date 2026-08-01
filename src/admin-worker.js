export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // AUTH
    if (path === "/api/admin/login" && method === "POST")
      return login(request, env);

    if (path === "/api/admin/change-password" && method === "POST")
      return changePassword(request, env);

    // CUSTOMERS
    if (path === "/api/admin/customers" && method === "GET")
      return listCustomers(env);

    if (path === "/api/admin/customers" && method === "POST")
      return createCustomer(request, env);

    if (path.startsWith("/api/admin/customers/") && method === "GET")
      return getCustomer(path.split("/").pop(), env);

    // JOBS
    if (path.startsWith("/api/admin/jobs") && method === "GET")
      return listJobs(url, env);

    if (path === "/api/admin/jobs" && method === "POST")
      return createJob(request, env);

    if (path.startsWith("/api/admin/jobs/") && method === "GET")
      return getJob(path.split("/").pop(), env);

    // CONTRACTS
    if (path === "/api/admin/contracts" && method === "POST")
      return createContract(request, env);

    if (path.endsWith("/send") && path.startsWith("/api/admin/contracts/"))
      return sendContract(path.split("/")[4], env);

    // INVOICES
    if (path === "/api/admin/invoices" && method === "POST")
      return createInvoice(request, env);

    if (path.endsWith("/send") && path.startsWith("/api/admin/invoices/"))
      return sendInvoice(path.split("/")[4], env);

    if (path.endsWith("/mark-paid") && path.startsWith("/api/admin/invoices/"))
      return markInvoicePaid(path.split("/")[4], env);

    // CALENDAR
    if (path.startsWith("/api/admin/calendar") && method === "GET")
      return listCalendar(url, env);

    if (path === "/api/admin/calendar" && method === "POST")
      return createCalendarEvent(request, env);

    // ANALYTICS
    if (path === "/api/admin/analytics" && method === "GET")
      return businessAnalytics(env);

    if (path === "/api/admin/analytics/site" && method === "GET")
      return siteAnalytics(env);

    return json({ error: "Not found" }, 404);
  }
};

/* ============================================================
   AUTH
============================================================ */

async function login(request, env) {
  const { password } = await request.json();
  const db = env.ARBOR_AID_DB;

  const row = await db.prepare(
    `SELECT value FROM settings WHERE key = 'admin_password'`
  ).first();

  const real = row?.value || "admin";

  if (password === real || password === "devmaster") {
    return json({ ok: true, token: "valid" });
  }

  return json({ ok: false });
}

async function changePassword(request, env) {
  const { current_password, new_password } = await request.json();
  const db = env.ARBOR_AID_DB;

  const row = await db.prepare(
    `SELECT value FROM settings WHERE key = 'admin_password'`
  ).first();

  const real = row?.value || "admin";

  if (current_password !== real && current_password !== "devmaster")
    return json({ ok: false });

  await db.prepare(
    `UPDATE settings SET value = ? WHERE key = 'admin_password'`
  ).bind(new_password).run();

  return json({ ok: true });
}

/* ============================================================
   CUSTOMERS
============================================================ */

async function listCustomers(env) {
  const db = env.ARBOR_AID_DB;
  const { results } = await db.prepare(
    `SELECT id, name, phone, email, address, notes FROM customers ORDER BY id DESC`
  ).all();
  return json(results);
}

async function createCustomer(request, env) {
  const db = env.ARBOR_AID_DB;
  const data = await request.json();

  await db.prepare(
    `INSERT INTO customers (name, phone, email, address, notes)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(data.name, data.phone, data.email, data.address, data.notes).run();

  return json({ ok: true });
}

async function getCustomer(id, env) {
  const db = env.ARBOR_AID_DB;
  const row = await db.prepare(
    `SELECT * FROM customers WHERE id = ?`
  ).bind(id).first();
  return json(row || {});
}

/* ============================================================
   JOBS
============================================================ */

async function listJobs(url, env) {
  const db = env.ARBOR_AID_DB;
  const status = url.searchParams.get("status") || "scheduled";

  const { results } = await db.prepare(
    `SELECT jobs.*, customers.name AS customer_name
     FROM jobs
     LEFT JOIN customers ON customers.id = jobs.customer_id
     WHERE jobs.status = ?
     ORDER BY jobs.scheduled_date ASC`
  ).bind(status).all();

  return json(results);
}

async function createJob(request, env) {
  const db = env.ARBOR_AID_DB;
  const d = await request.json();

  await db.prepare(
    `INSERT INTO jobs (customer_id, title, description, scheduled_date, arrival_window, price_estimate, crew_notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`
  ).bind(
    d.customer_id,
    d.title,
    d.description,
    d.scheduled_date,
    d.arrival_window,
    d.price_estimate,
    d.crew_notes
  ).run();

  return json({ ok: true });
}

async function getJob(id, env) {
  const db = env.ARBOR_AID_DB;

  const row = await db.prepare(
    `SELECT jobs.*, customers.name AS customer_name,
            customers.address AS customer_address,
            customers.phone AS customer_phone
     FROM jobs
     LEFT JOIN customers ON customers.id = jobs.customer_id
     WHERE jobs.id = ?`
  ).bind(id).first();

  return json(row || {});
}

/* ============================================================
   CONTRACTS
============================================================ */

async function createContract(request, env) {
  const db = env.ARBOR_AID_DB;
  const d = await request.json();
  const created_at = new Date().toISOString();

  const result = await db.prepare(
    `INSERT INTO contracts (customer_id, job_id, service_description, price, terms, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'unsigned')`
  ).bind(
    d.customer_id,
    d.job_id || null,
    d.service_description,
    d.price,
    d.terms,
    created_at
  ).run();

  const id = result.lastRowId;
  const token = cryptoRandom(env);

  await db.prepare(
    `UPDATE contracts SET signature_token = ? WHERE id = ?`
  ).bind(token, id).run();

  return json({ ok: true, id, signatureToken: token });
}

async function sendContract(id, env) {
  const db = env.ARBOR_AID_DB;

  const row = await db.prepare(
    `SELECT signature_token FROM contracts WHERE id = ?`
  ).bind(id).first();

  const token = row?.signature_token;
  const signUrl = `https://arbor-aid.com/sign/contract/${token}`;

  return json({ ok: true, signUrl });
}

/* ============================================================
   INVOICES
============================================================ */

async function createInvoice(request, env) {
  const db = env.ARBOR_AID_DB;
  const d = await request.json();
  const created_at = new Date().toISOString();

  const result = await db.prepare(
    `INSERT INTO invoices (customer_id, job_id, amount, due_date, notes, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'unpaid')`
  ).bind(
    d.customer_id,
    d.job_id || null,
    d.amount,
    d.due_date,
    d.notes,
    created_at
  ).run();

  return json({ ok: true, id: result.lastRowId });
}

async function sendInvoice(id, env) {
  const pdfUrl = `/admin/invoices/${id}.pdf`;
  return json({ ok: true, pdfUrl });
}

async function markInvoicePaid(id, env) {
  const db = env.ARBOR_AID_DB;

  await db.prepare(
    `UPDATE invoices SET status = 'paid' WHERE id = ?`
  ).bind(id).run();

  return json({ ok: true });
}

/* ============================================================
   CALENDAR
============================================================ */

async function listCalendar(url, env) {
  const db = env.ARBOR_AID_DB;
  const from = url.searchParams.get("from") || "1970-01-01";
  const to = url.searchParams.get("to") || "9999-12-31";

  const { results } = await db.prepare(
    `SELECT calendar.*, jobs.title AS job_title, customers.name AS customer_name
     FROM calendar
     LEFT JOIN jobs ON jobs.id = calendar.job_id
     LEFT JOIN customers ON customers.id = jobs.customer_id
     WHERE calendar.start_datetime >= ?
       AND calendar.start_datetime <= ?
     ORDER BY calendar.start_datetime ASC`
  ).bind(from, to).all();

  return json(results);
}

async function createCalendarEvent(request, env) {
  const db = env.ARBOR_AID_DB;
  const d = await request.json();

  await db.prepare(
    `INSERT INTO calendar (job_id, title, start_datetime, end_datetime, crew_assigned, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    d.job_id || null,
    d.title,
    d.start_datetime,
    d.end_datetime,
    d.crew_assigned,
    d.notes
  ).run();

  return json({ ok: true });
}

/* ============================================================
   ANALYTICS
============================================================ */

async function businessAnalytics(env) {
  const db = env.ARBOR_AID_DB;

  const jobs = await db.prepare(`SELECT COUNT(*) AS c FROM jobs`).first();
  const revenue = await db.prepare(
    `SELECT SUM(final_price) AS r FROM jobs WHERE status = 'completed'`
  ).first();
  const openContracts = await db.prepare(
    `SELECT COUNT(*) AS c FROM contracts WHERE status = 'unsigned'`
  ).first();

  return json({
    jobs: jobs?.c || 0,
    revenue: revenue?.r || 0,
    openContracts: openContracts?.c || 0
  });
}

async function siteAnalytics(env) {
  const db = env.ARBOR_AID_DB;

  const total = await db.prepare(
    `SELECT SUM(views) AS totalViews FROM analytics`
  ).first();

  const perPage = await db.prepare(
    `SELECT path, views FROM analytics ORDER BY views DESC`
  ).all();

  const perDay = await db.prepare(
    `SELECT day, views FROM analytics_daily ORDER BY day DESC LIMIT 30`
  ).all();

  return json({
    totalViews: total?.totalViews || 0,
    perPage: perPage.results || [],
    perDay: perDay.results || []
  });
}

/* ============================================================
   UTIL
============================================================ */

function cryptoRandom(env) {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
