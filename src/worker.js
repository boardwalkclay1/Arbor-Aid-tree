export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Simple routing
    if (path === "/api/contact" && method === "POST") {
      return handleContact(request, env);
    }
    if (path === "/api/estimate" && method === "POST") {
      return handleEstimate(request, env);
    }
    if (path === "/api/reviews" && method === "GET") {
      return handleReviews(request, env);
    }
    if (path === "/api/stats" && method === "GET") {
      return handleStats(env);
    }
    if (path.startsWith("/api/weather") && method === "GET") {
      return handleWeather(url, env);
    }

    // Admin routes (you can add auth later)
    if (path === "/api/admin/contract" && method === "POST") {
      return handleContract(request, env);
    }
    if (path === "/api/admin/invoice" && method === "POST") {
      return handleInvoice(request, env);
    }
    if (path === "/api/admin/analytics" && method === "GET") {
      return handleAdminAnalytics(env);
    }

    return new Response("Not found", { status: 404 });
  }
};

async function handleContact(request, env) {
  const db = env.ARBOR_AID_DB;
  const body = await request.formData();
  const name = body.get("name");
  const phone = body.get("phone");
  const email = body.get("email");
  const message = body.get("message") || "";
  const source = "contact";
  const created_at = new Date().toISOString();

  await db.prepare(
    `INSERT INTO customers (name, phone, email, message, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(name, phone, email, message, source, created_at).run();

  return json({ ok: true });
}

async function handleEstimate(request, env) {
  const db = env.ARBOR_AID_DB;
  const body = await request.formData();
  const name = body.get("name");
  const phone = body.get("phone");
  const email = body.get("email");
  const service = body.get("service");
  const details = body.get("details") || "";
  const created_at = new Date().toISOString();

  await db.prepare(
    `INSERT INTO estimates (name, phone, email, service, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(name, phone, email, service, details, created_at).run();

  return json({ ok: true });
}

async function handleReviews(request, env) {
  const db = env.ARBOR_AID_DB;
  const limit = Number(new URL(request.url).searchParams.get("limit") || 3);

  const { results } = await db.prepare(
    `SELECT name, city, title, text, rating
     FROM reviews
     WHERE is_public = 1
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(limit).all();

  return json(results);
}

async function handleStats(env) {
  const db = env.ARBOR_AID_DB;

  const jobsRow = await db.prepare(
    `SELECT COUNT(*) AS jobsThisMonth
     FROM jobs
     WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
  ).first();

  const reviewsRow = await db.prepare(
    `SELECT COUNT(*) AS fiveStarCount
     FROM reviews
     WHERE rating = 5`
  ).first();

  return json({
    jobsThisMonth: jobsRow?.jobsThisMonth || 0,
    fiveStarCount: reviewsRow?.fiveStarCount || 0
  });
}

async function handleWeather(url, env) {
  const db = env.ARBOR_AID_DB;
  const city = url.searchParams.get("city") || "Atlanta";

  // Check cache (last 60 minutes)
  const now = Date.now();
  const cacheRow = await db.prepare(
    `SELECT summary, temp, raw_json, fetched_at
     FROM weather_cache
     WHERE city = ?
     ORDER BY fetched_at DESC
     LIMIT 1`
  ).bind(city).first();

  if (cacheRow) {
    const age = now - Date.parse(cacheRow.fetched_at);
    if (age < 60 * 60 * 1000) {
      return json({
        description: cacheRow.summary,
        temp: cacheRow.temp
      });
    }
  }

  // Call external weather API via env.WEATHER_API_URL / KEY
  const res = await fetch(`${env.WEATHER_API_URL}?city=${encodeURIComponent(city)}&key=${env.WEATHER_API_KEY}`);
  const data = await res.json();

  const summary = data.description || data.weather?.[0]?.description || "Weather";
  const temp = data.temp || data.main?.temp || null;
  const raw_json = JSON.stringify(data);
  const fetched_at = new Date().toISOString();

  await db.prepare(
    `INSERT INTO weather_cache (city, summary, temp, raw_json, fetched_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(city, summary, temp, raw_json, fetched_at).run();

  return json({ description: summary, temp });
}

async function handleContract(request, env) {
  const db = env.ARBOR_AID_DB;
  const body = await request.json();

  const created_at = new Date().toISOString();

  const { customer_name, customer_email, customer_phone, address, service, price, terms } = body;

  const result = await db.prepare(
    `INSERT INTO contracts (customer_name, customer_email, customer_phone, address, service, price, terms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(customer_name, customer_email, customer_phone, address, service, price, terms, created_at).run();

  const id = result.lastRowId;

  // TODO: generate PDF + email via another service or Worker
  const pdf_url = `/admin/contracts/${id}.pdf`;

  await db.prepare(
    `UPDATE contracts SET pdf_url = ? WHERE id = ?`
  ).bind(pdf_url, id).run();

  return json({ ok: true, id, pdfUrl: pdf_url, fileName: `contract-${id}.pdf` });
}

async function handleInvoice(request, env) {
  const db = env.ARBOR_AID_DB;
  const body = await request.json();

  const created_at = new Date().toISOString();

  const { customer_name, customer_email, customer_phone, address, service, price, due_date } = body;

  const result = await db.prepare(
    `INSERT INTO invoices (customer_name, customer_email, customer_phone, address, service, price, due_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(customer_name, customer_email, customer_phone, address, service, price, due_date, created_at).run();

  const id = result.lastRowId;

  const pdf_url = `/admin/invoices/${id}.pdf`;

  await db.prepare(
    `UPDATE invoices SET pdf_url = ? WHERE id = ?`
  ).bind(pdf_url, id).run();

  return json({ ok: true, id, pdfUrl: pdf_url, fileName: `invoice-${id}.pdf` });
}

async function handleAdminAnalytics(env) {
  const db = env.ARBOR_AID_DB;

  const jobsRow = await db.prepare(
    `SELECT COUNT(*) AS jobs FROM jobs`
  ).first();

  const revenueRow = await db.prepare(
    `SELECT SUM(price) AS revenue FROM jobs WHERE status = 'completed'`
  ).first();

  const openContractsRow = await db.prepare(
    `SELECT COUNT(*) AS openContracts FROM contracts WHERE status != 'signed'`
  ).first();

  return json({
    jobs: jobsRow?.jobs || 0,
    revenue: revenueRow?.revenue || 0,
    openContracts: openContractsRow?.openContracts || 0
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
