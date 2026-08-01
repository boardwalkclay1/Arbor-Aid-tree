export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // PUBLIC ROUTES
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
    if (path === "/api/track" && method === "POST") {
      return handleTrack(request, env);
    }

    // PUBLIC CONTRACT SIGNING
    if (path.startsWith("/api/contracts/") && method === "GET") {
      return handleGetContractByToken(path, env);
    }
    if (path.startsWith("/api/contracts/") && method === "POST") {
      return handleSignContract(path, request, env);
    }

    // ADMIN ROUTES (auth can be added later)
    // Customers
    if (path === "/api/admin/customers" && method === "POST") {
      return handleCreateCustomer(request, env);
    }
    if (path === "/api/admin/customers" && method === "GET") {
      return handleListCustomers(env);
    }
    if (path.startsWith("/api/admin/customers/") && method === "GET") {
      return handleGetCustomer(path, env);
    }
    if (path.startsWith("/api/admin/customers/") && method === "PUT") {
      return handleUpdateCustomer(path, request, env);
    }

    // Jobs
    if (path === "/api/admin/jobs" && method === "POST") {
      return handleCreateJob(request, env);
    }
    if (path === "/api/admin/jobs" && method === "GET") {
      return handleListJobs(url, env);
    }
    if (path.startsWith("/api/admin/jobs/") && method === "GET") {
      return handleGetJob(path, env);
    }
    if (path.startsWith("/api/admin/jobs/") && method === "PUT") {
      return handleUpdateJob(path, request, env);
    }

    // Contracts
    if (path === "/api/admin/contracts" && method === "POST") {
      return handleAdminCreateContract(request, env);
    }
    if (path.startsWith("/api/admin/contracts/") && path.endsWith("/send") && method === "POST") {
      return handleAdminSendContract(path, env);
    }

    // Invoices
    if (path === "/api/admin/invoices" && method === "POST") {
      return handleAdminCreateInvoice(request, env);
    }
    if (path.startsWith("/api/admin/invoices/") && path.endsWith("/send") && method === "POST") {
      return handleAdminSendInvoice(path, env);
    }
    if (path.startsWith("/api/admin/invoices/") && path.endsWith("/mark-paid") && method === "POST") {
      return handleAdminMarkInvoicePaid(path, env);
    }

    // Calendar
    if (path === "/api/admin/calendar" && method === "POST") {
      return handleCreateCalendarEvent(request, env);
    }
    if (path === "/api/admin/calendar" && method === "GET") {
      return handleListCalendarEvents(url, env);
    }

    // Analytics
    if (path === "/api/admin/analytics" && method === "GET") {
      return handleAdminAnalytics(env);
    }
    if (path === "/api/admin/analytics/site" && method === "GET") {
      return handleSiteAnalytics(env);
    }

    return new Response("Not found", { status: 404 });
  }
};

/* ========== PUBLIC HANDLERS (CONTACT / ESTIMATE / REVIEWS / STATS / WEATHER / TRACK) ========== */

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
    `INSERT INTO customers (name, phone, email, notes, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(name, phone, email, message, created_at).run();

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

async function handleTrack(request, env) {
  const db = env.ARBOR_AID_DB;
  const body = await request.json();
  const path = body.path || "/";
  const referrer = body.referrer || "";
  const ua = body.userAgent || "";
  const ip_hash = body.ipHash || "";
  const created_at = new Date().toISOString();

  await db.prepare(
    `INSERT INTO site_analytics (path, referrer, user_agent, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(path, referrer, ua, ip_hash, created_at).run();

  return json({ ok: true });
}

/* ========== PUBLIC CONTRACT SIGNING ========== */

async function handleGetContractByToken(path, env) {
  const token = path.split("/").pop();
  const db = env.ARBOR_AID_DB;

  const row = await db.prepare(
    `SELECT id, customer_id, job_id, service_description, price, terms, status
     FROM contracts
     WHERE signature_token = ?`
  ).bind(token).first();

  if (!row) return json({ error: "Not found" }, 404);

  return json(row);
}

async function handleSignContract(path, request, env) {
  const token = path.split("/").pop();
  const db = env.ARBOR_AID_DB;

  const now = new Date().toISOString();

  await db.prepare(
    `UPDATE contracts
     SET status = 'signed', signed_at = ?
     WHERE signature_token = ?`
  ).bind(now, token).run();

  return json({ ok: true });
}

/* ========== ADMIN: CUSTOMERS ========== */

async function handleCreateCustomer(request, env) {
  const db = env.ARBOR_AID_DB;
  const body = await request.json();

  const { name, phone, email, address, notes } = body;
  const created_at = new Date().toISOString();

  await db.prepare(
    `INSERT INTO customers (name, phone, email, address, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(name, phone, email, address, notes || "", created_at).run();

  return json({ ok: true });
}

async function handleListCustomers(env) {
  const db = env.ARBOR_AID_DB;
  const { results } = await db.prepare(
    `SELECT id, name, phone, email, address, created_at
     FROM customers
     ORDER BY created_at DESC`
  ).all();

  return json(results);
}

async function handleGetCustomer(path, env) {
  const id = Number(path.split("/").pop());
  const db = env.ARBOR_AID_DB;

  const row = await db.prepare(
    `SELECT id, name, phone, email, address, notes, created_at
     FROM customers
     WHERE id = ?`
  ).bind(id).first();

  if (!row) return json({ error: "Not found" }, 404);
  return json(row);
}

async function handleUpdateCustomer(path, request, env) {
  const id = Number(path.split("/").pop());
  const db = env.ARBOR_AID_DB;
  const body = await request.json();

  const { name, phone, email, address, notes } = body;

  await db.prepare(
    `UPDATE customers
     SET name = ?, phone = ?, email = ?, address = ?, notes = ?
     WHERE id = ?`
  ).bind(name, phone, email, address, notes || "", id).run();

  return json({ ok: true });
}

/* ========== ADMIN: JOBS ========== */

async function handleCreateJob(request, env) {
  const db = env.ARBOR_AID_DB;
  const body = await request.json();

  const {
    customer_id,
    title,
    description,
    status,
    scheduled_date,
    arrival_window,
    price_estimate,
    crew_notes
  } = body;

  const created_at = new Date().toISOString();

  await db.prepare(
    `INSERT INTO jobs (customer_id, title, description, status, scheduled_date,
                       arrival_window, price_estimate, crew_notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    customer_id,
    title,
    description || "",
    status || "scheduled",
    scheduled_date || null,
    arrival_window || "",
    price_estimate || 0,
    crew_notes || "",
    created_at
  ).run();

  return json({ ok: true });
}

async function handleListJobs(url, env) {
  const db = env.ARBOR_AID_DB;
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = `SELECT j.id, j.title, j.status, j.scheduled_date, c.name AS customer_name
               FROM jobs j
               LEFT JOIN customers c ON j.customer_id = c.id
               WHERE 1=1`;
  const binds = [];

  if (status) {
    query += ` AND j.status = ?`;
    binds.push(status);
  }
  if (from) {
    query += ` AND j.scheduled_date >= ?`;
    binds.push(from);
  }
  if (to) {
    query += ` AND j.scheduled_date <= ?`;
    binds.push(to);
  }

  query += ` ORDER BY j.scheduled_date ASC`;

  const { results } = await db.prepare(query).bind(...binds).all();
  return json(results);
}

async function handleGetJob(path, env) {
  const id = Number(path.split("/").pop());
  const db = env.ARBOR_AID_DB;

  const row = await db.prepare(
    `SELECT j.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
     FROM jobs j
     LEFT JOIN customers c ON j.customer_id = c.id
     WHERE j.id = ?`
  ).bind(id).first();

  if (!row) return json({ error: "Not found" }, 404);
  return json(row);
}

async function handleUpdateJob(path, request, env) {
  const id = Number(path.split("/").pop());
  const db = env.ARBOR_AID_DB;
  const body = await request.json();

  const {
    title,
    description,
    status,
    scheduled_date,
    arrival_window,
    price_estimate,
    final_price,
    crew_notes
  } = body;

  await db.prepare(
    `UPDATE jobs
     SET title = ?, description = ?, status = ?, scheduled_date = ?,
         arrival_window = ?, price_estimate = ?, final_price = ?, crew_notes = ?
     WHERE id = ?`
  ).bind(
    title,
    description || "",
    status,
    scheduled_date || null,
    arrival_window || "",
    price_estimate || 0,
    final_price || null,
    crew_notes || "",
    id
  ).run();

  return json({ ok: true });
}

/* ========== ADMIN: CONTRACTS ========== */

async function handleAdminCreateContract(request, env) {
  const db = env.ARBOR_AID_DB;
  const body = await request.json();

  const {
    customer_id,
    job_id,
    service_description,
    price,
    terms
  } = body;

  const created_at = new Date().toISOString();
  const signature_token = cryptoRandomToken();

  const result = await db.prepare(
    `INSERT INTO contracts (customer_id, job_id, service_description, price, terms,
                            status, signature_token, created_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`
  ).bind(
    customer_id,
    job_id || null,
    service_description,
    price || 0,
    terms || "",
    signature_token,
    created_at
  ).run();

  const id = result.lastRowId;

  return json({ ok: true, id, signatureToken: signature_token });
}

async function handleAdminSendContract(path, env) {
  const id = Number(path.split("/")[4]); // /api/admin/contracts/:id/send
  const db = env.ARBOR_AID_DB;

  const row = await db.prepare(
    `SELECT c.id, c.signature_token, cu.email, cu.name
     FROM contracts c
     LEFT JOIN customers cu ON c.customer_id = cu.id
     WHERE c.id = ?`
  ).bind(id).first();

  if (!row) return json({ error: "Not found" }, 404);

  const signUrl = `https://arbor-aid.com/sign/contract/${row.signature_token}`;

  // TODO: send email via env.MAIL_API
  // await sendMail(env, row.email, "Tree Service Agreement", `Sign here: ${signUrl}`);

  await db.prepare(
    `UPDATE contracts SET status = 'sent' WHERE id = ?`
  ).bind(id).run();

  return json({ ok: true, signUrl });
}

/* ========== ADMIN: INVOICES ========== */

async function handleAdminCreateInvoice(request, env) {
  const db = env.ARBOR_AID_DB;
  const body = await request.json();

  const {
    customer_id,
    job_id,
    amount,
    due_date,
    notes
  } = body;

  const created_at = new Date().toISOString();

  const result = await db.prepare(
    `INSERT INTO invoices (customer_id, job_id, amount, due_date, status, notes, created_at)
     VALUES (?, ?, ?, ?, 'draft', ?, ?)`
  ).bind(
    customer_id,
    job_id || null,
    amount || 0,
    due_date || null,
    notes || "",
    created_at
  ).run();

  const id = result.lastRowId;

  return json({ ok: true, id });
}

async function handleAdminSendInvoice(path, env) {
  const id = Number(path.split("/")[4]); // /api/admin/invoices/:id/send
  const db = env.ARBOR_AID_DB;

  const row = await db.prepare(
    `SELECT i.id, i.amount, cu.email, cu.name
     FROM invoices i
     LEFT JOIN customers cu ON i.customer_id = cu.id
     WHERE i.id = ?`
  ).bind(id).first();

  if (!row) return json({ error: "Not found" }, 404);

  // TODO: generate PDF + send email
  // const pdfUrl = `/admin/invoices/${id}.pdf`;
  const pdfUrl = `/admin/invoices/${id}.pdf`;

  await db.prepare(
    `UPDATE invoices SET status = 'sent', pdf_url = ? WHERE id = ?`
  ).bind(pdfUrl, id).run();

  return json({ ok: true, pdfUrl });
}

async function handleAdminMarkInvoicePaid(path, env) {
  const id = Number(path.split("/")[4]); // /api/admin/invoices/:id/mark-paid
  const db = env.ARBOR_AID_DB;
  const paid_at = new Date().toISOString();

  await db.prepare(
    `UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?`
  ).bind(paid_at, id).run();

  return json({ ok: true });
}

/* ========== ADMIN: CALENDAR ========== */

async function handleCreateCalendarEvent(request, env) {
  const db = env.ARBOR_AID_DB;
  const body = await request.json();

  const {
    job_id,
    title,
    start_datetime,
    end_datetime,
    crew_assigned,
    notes
  } = body;

  await db.prepare(
    `INSERT INTO calendar_events (job_id, title, start_datetime, end_datetime,
                                  crew_assigned, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    job_id || null,
    title,
    start_datetime,
    end_datetime || null,
    crew_assigned || "",
    notes || ""
  ).run();

  return json({ ok: true });
}

async function handleListCalendarEvents(url, env) {
  const db = env.ARBOR_AID_DB;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = `SELECT ce.*, j.title AS job_title, c.name AS customer_name
               FROM calendar_events ce
               LEFT JOIN jobs j ON ce.job_id = j.id
               LEFT JOIN customers c ON j.customer_id = c.id
               WHERE 1=1`;
  const binds = [];

  if (from) {
    query += ` AND ce.start_datetime >= ?`;
    binds.push(from);
  }
  if (to) {
    query += ` AND ce.start_datetime <= ?`;
    binds.push(to);
  }

  query += ` ORDER BY ce.start_datetime ASC`;

  const { results } = await db.prepare(query).bind(...binds).all();
  return json(results);
}

/* ========== ADMIN: ANALYTICS ========== */

async function handleAdminAnalytics(env) {
  const db = env.ARBOR_AID_DB;

  const jobsRow = await db.prepare(
    `SELECT COUNT(*) AS jobs FROM jobs`
  ).first();

  const revenueRow = await db.prepare(
    `SELECT SUM(final_price) AS revenue FROM jobs WHERE status = 'completed'`
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

async function handleSiteAnalytics(env) {
  const db = env.ARBOR_AID_DB;

  const totalRow = await db.prepare(
    `SELECT COUNT(*) AS totalViews FROM site_analytics`
  ).first();

  const perPage = await db.prepare(
    `SELECT path, COUNT(*) AS views
     FROM site_analytics
     GROUP BY path
     ORDER BY views DESC`
  ).all();

  const perDay = await db.prepare(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS views
     FROM site_analytics
     GROUP BY day
     ORDER BY day DESC
     LIMIT 30`
  ).all();

  return json({
    totalViews: totalRow?.totalViews || 0,
    perPage: perPage.results || [],
    perDay: perDay.results || []
  });
}

/* ========== HELPERS ========== */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function cryptoRandomToken() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
}
