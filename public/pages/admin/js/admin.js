/* ============================================================
   BASIC API HELPER
============================================================ */
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/* ============================================================
   AUTH SYSTEM
============================================================ */

const DEV_BYPASS = true; // you always get in during development

function requireAdminLogin() {
  if (DEV_BYPASS) return;

  const token = localStorage.getItem("adminToken");
  if (!token) {
    location.href = "/admin/login.html";
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const form = document.getElementById("loginForm");
  const password = form.password.value.trim();

  try {
    const res = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password })
    });

    if (res.ok) {
      localStorage.setItem("adminToken", res.token);
      location.href = "/admin/index.html";
    } else {
      document.getElementById("loginError").textContent = "Incorrect password.";
    }
  } catch (err) {
    document.getElementById("loginError").textContent = "Login failed.";
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();
  const form = document.getElementById("passwordForm");

  const current_password = form.current_password.value.trim();
  const new_password = form.new_password.value.trim();
  const confirm_password = form.confirm_password.value.trim();

  if (new_password !== confirm_password) {
    document.getElementById("passwordError").textContent = "Passwords do not match.";
    return;
  }

  try {
    const res = await api("/api/admin/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password,
        new_password
      })
    });

    if (res.ok) {
      document.getElementById("passwordSuccess").textContent =
        "Password updated. Verification email sent to victor@arbor-aid.com.";
    } else {
      document.getElementById("passwordError").textContent = "Incorrect current password.";
    }
  } catch (err) {
    document.getElementById("passwordError").textContent = "Error updating password.";
  }
}

/* ============================================================
   DASHBOARD PREVIEW LOADERS
============================================================ */

async function loadPreviewCustomers() {
  try {
    const customers = await api("/api/admin/customers");
    const box = document.getElementById("previewCustomers");
    if (!box) return;

    box.innerHTML = "";
    customers.slice(0, 5).forEach(c => {
      const li = document.createElement("li");
      li.textContent = `${c.name} — ${c.phone}`;
      box.appendChild(li);
    });
  } catch (err) {}
}

async function loadPreviewJobs() {
  try {
    const jobs = await api("/api/admin/jobs?status=scheduled");
    const box = document.getElementById("previewJobs");
    if (!box) return;

    box.innerHTML = "";
    jobs.slice(0, 5).forEach(j => {
      const li = document.createElement("li");
      li.textContent = `${j.scheduled_date || "No date"} — ${j.title}`;
      box.appendChild(li);
    });
  } catch (err) {}
}

async function loadPreviewReviews() {
  try {
    const reviews = await api("/api/reviews?limit=5");
    const box = document.getElementById("previewReviews");
    if (!box) return;

    box.innerHTML = "";
    reviews.forEach(r => {
      const li = document.createElement("li");
      li.textContent = `${r.title || "Review"} — ${r.rating}★`;
      box.appendChild(li);
    });
  } catch (err) {}
}

async function loadPreviewCalendar() {
  try {
    const now = new Date().toISOString();
    const events = await api(`/api/admin/calendar?from=${now}`);
    const box = document.getElementById("previewCalendar");
    if (!box) return;

    box.innerHTML = "";
    events.slice(0, 5).forEach(e => {
      const li = document.createElement("li");
      li.textContent = `${e.title} — ${e.start_datetime}`;
      box.appendChild(li);
    });
  } catch (err) {}
}

/* ============================================================
   ANALYTICS
============================================================ */

async function loadAdminAnalytics() {
  try {
    const data = await api("/api/admin/analytics");

    if (document.getElementById("adminJobs"))
      document.getElementById("adminJobs").textContent = data.jobs || 0;

    if (document.getElementById("adminRevenue"))
      document.getElementById("adminRevenue").textContent = `$${data.revenue || 0}`;

    if (document.getElementById("adminOpenContracts"))
      document.getElementById("adminOpenContracts").textContent = data.openContracts || 0;

    if (document.getElementById("cardJobsTotal"))
      document.getElementById("cardJobsTotal").textContent = data.jobs || 0;

    if (document.getElementById("cardContractsOpen"))
      document.getElementById("cardContractsOpen").textContent = data.openContracts || 0;

  } catch (err) {}
}

async function loadSiteAnalytics() {
  try {
    const data = await api("/api/admin/analytics/site");
    const box = document.getElementById("siteAnalytics");
    if (!box) return;

    box.innerHTML = "";

    const total = document.createElement("div");
    total.textContent = `Total views: ${data.totalViews}`;
    box.appendChild(total);

    const perPageTitle = document.createElement("h3");
    perPageTitle.textContent = "Views per page";
    box.appendChild(perPageTitle);

    data.perPage.forEach(row => {
      const div = document.createElement("div");
      div.textContent = `${row.path}: ${row.views}`;
      box.appendChild(div);
    });

    const perDayTitle = document.createElement("h3");
    perDayTitle.textContent = "Views per day (last 30 days)";
    box.appendChild(perDayTitle);

    data.perDay.forEach(row => {
      const div = document.createElement("div");
      div.textContent = `${row.day}: ${row.views}`;
      box.appendChild(div);
    });

    if (document.getElementById("cardVisitsToday"))
      document.getElementById("cardVisitsToday").textContent = data.perDay[0]?.views || 0;

    if (document.getElementById("cardPageViews"))
      document.getElementById("cardPageViews").textContent = data.totalViews || 0;

  } catch (err) {}
}

/* ============================================================
   CUSTOMERS
============================================================ */

async function loadCustomers() {
  try {
    const customers = await api("/api/admin/customers");
    const list = document.getElementById("customerList");
    if (!list) return;

    list.innerHTML = "";
    customers.forEach(c => {
      const li = document.createElement("li");
      li.textContent = `${c.name} — ${c.phone}`;
      li.dataset.id = c.id;
      li.onclick = () => loadCustomerDetail(c.id);
      list.appendChild(li);
    });
  } catch (err) {}
}

async function loadCustomerDetail(id) {
  try {
    const c = await api(`/api/admin/customers/${id}`);
    const box = document.getElementById("customerDetail");
    if (!box) return;

    box.innerHTML = `
      <h3>${c.name}</h3>
      <p>${c.phone} · ${c.email}</p>
      <p>${c.address || ""}</p>
      <p>${c.notes || ""}</p>
    `;
  } catch (err) {}
}

async function createCustomer(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const data = Object.fromEntries(new FormData(form).entries());
  try {
    await api("/api/admin/customers", {
      method: "POST",
      body: JSON.stringify(data)
    });
    loadCustomers();
  } catch (err) {}
}

/* ============================================================
   JOBS
============================================================ */

async function loadJobs(status = "scheduled") {
  try {
    const jobs = await api(`/api/admin/jobs?status=${encodeURIComponent(status)}`);
    const list = document.getElementById("jobList");
    if (!list) return;

    list.innerHTML = "";
    jobs.forEach(j => {
      const li = document.createElement("li");
      li.textContent = `${j.scheduled_date || "No date"} — ${j.title}`;
      li.dataset.id = j.id;
      li.onclick = () => loadJobDetail(j.id);
      list.appendChild(li);
    });
  } catch (err) {}
}

async function loadJobDetail(id) {
  try {
    const j = await api(`/api/admin/jobs/${id}`);
    const box = document.getElementById("jobDetail");
    if (!box) return;

    box.innerHTML = `
      <h3>${j.title}</h3>
      <p>Status: ${j.status}</p>
      <p>Customer: ${j.customer_name || ""}</p>
      <p>Address: ${j.customer_address || ""}</p>
      <p>Phone: ${j.customer_phone || ""}</p>
      <p>Scheduled: ${j.scheduled_date || ""} (${j.arrival_window || ""})</p>
      <p>Estimate: $${j.price_estimate || 0}</p>
      <p>Final: $${j.final_price || 0}</p>
      <p>Notes: ${j.crew_notes || ""}</p>
    `;
  } catch (err) {}
}

async function createJob(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const data = Object.fromEntries(new FormData(form).entries());
  try {
    await api("/api/admin/jobs", {
      method: "POST",
      body: JSON.stringify(data)
    });
    loadJobs("scheduled");
  } catch (err) {}
}

/* ============================================================
   CONTRACTS
============================================================ */

async function sendContract(formId, endpoint) {
  const form = document.getElementById(formId);
  if (!form) return;

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (res.signatureToken) {
      console.log("Signing link:", `https://arbor-aid.com/sign/contract/${res.signatureToken}`);
    }
  } catch (err) {}
}

async function sendExistingContract(id) {
  try {
    const res = await api(`/api/admin/contracts/${id}/send`, {
      method: "POST"
    });
    console.log("Sign URL:", res.signUrl);
  } catch (err) {}
}

/* ============================================================
   INVOICES
============================================================ */

async function sendInvoice(formId, endpoint) {
  const form = document.getElementById(formId);
  if (!form) return;

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  } catch (err) {}
}

async function sendExistingInvoice(id) {
  try {
    const res = await api(`/api/admin/invoices/${id}/send`, {
      method: "POST"
    });
  } catch (err) {}
}

async function markInvoicePaid(id) {
  try {
    await api(`/api/admin/invoices/${id}/mark-paid`, {
      method: "POST"
    });
  } catch (err) {}
}

/* ============================================================
   CALENDAR
============================================================ */

async function loadCalendar(from, to) {
  try {
    const events = await api(`/api/admin/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const box = document.getElementById("calendarEvents");
    if (!box) return;

    box.innerHTML = "";
    events.forEach(e => {
      const div = document.createElement("div");
      div.className = "analytics-box";
      div.innerHTML = `
        <strong>${e.title}</strong><br>
        ${e.start_datetime} — ${e.end_datetime || ""}<br>
        Job: ${e.job_title || ""}<br>
        Customer: ${e.customer_name || ""}<br>
        Crew: ${e.crew_assigned || ""}
      `;
      box.appendChild(div);
    });
  } catch (err) {}
}

async function createCalendarEvent(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const data = Object.fromEntries(new FormData(form).entries());
  try {
    await api("/api/admin/calendar", {
      method: "POST",
      body: JSON.stringify(data)
    });
  } catch (err) {}
}

/* ============================================================
   REVIEWS
============================================================ */

async function loadAdminReviews() {
  try {
    const reviews = await api("/api/reviews?limit=10");
    const box = document.getElementById("adminReviews");
    if (!box) return;

    box.innerHTML = "";
    reviews.forEach(r => {
      const div = document.createElement("div");
      div.className = "analytics-box";
      div.innerHTML = `
        <strong>${r.title || "Review"}</strong><br>
        ${r.text}<br>
        <em>${r.name || "Customer"} — ${r.city || "Atlanta"}</em>
      `;
      box.appendChild(div);
    });
  } catch (err) {}
}

/* ============================================================
   INIT
============================================================ */

window.addEventListener("load", () => {
  requireAdminLogin();

  loadAdminAnalytics();
  loadSiteAnalytics();

  loadPreviewCustomers();
  loadPreviewJobs();
  loadPreviewReviews();
  loadPreviewCalendar();

  loadJobs("scheduled");
  loadCustomers();
});
