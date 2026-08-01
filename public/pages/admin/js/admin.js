// ========== BASIC HELPERS ==========

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ========== ANALYTICS ==========

async function loadAdminAnalytics() {
  try {
    const data = await api("/api/admin/analytics");
    document.getElementById("adminJobs").textContent = data.jobs || 0;
    document.getElementById("adminRevenue").textContent = `$${data.revenue || 0}`;
    document.getElementById("adminOpenContracts").textContent = data.openContracts || 0;
  } catch (err) {
    console.error(err);
  }
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
  } catch (err) {
    console.error(err);
  }
}

// ========== CUSTOMERS ==========

async function loadCustomers() {
  try {
    const customers = await api("/api/admin/customers");
    const list = document.getElementById("customerList");
    if (!list) return;

    list.innerHTML = "";
    customers.forEach(c => {
      const li = document.createElement("li");
      li.textContent = `${c.name} — ${c.phone} — ${c.city || ""}`;
      li.dataset.id = c.id;
      li.onclick = () => loadCustomerDetail(c.id);
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
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
  } catch (err) {
    console.error(err);
  }
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
    alert("Customer saved.");
    loadCustomers();
  } catch (err) {
    alert("Error saving customer.");
  }
}

// ========== JOBS ==========

async function loadJobs(status = "scheduled") {
  try {
    const jobs = await api(`/api/admin/jobs?status=${encodeURIComponent(status)}`);
    const list = document.getElementById("jobList");
    if (!list) return;

    list.innerHTML = "";
    jobs.forEach(j => {
      const li = document.createElement("li");
      li.textContent = `${j.scheduled_date || "No date"} — ${j.title} — ${j.customer_name || ""}`;
      li.dataset.id = j.id;
      li.onclick = () => loadJobDetail(j.id);
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
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
  } catch (err) {
    console.error(err);
  }
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
    alert("Job created.");
    loadJobs("scheduled");
  } catch (err) {
    alert("Error creating job.");
  }
}

// ========== CONTRACTS ==========

async function sendContract(formId, endpoint) {
  const form = document.getElementById(formId);
  if (!form) return;

  const submitBtn = form.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.disabled = true;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    alert("Contract created.");
    if (res.signatureToken) {
      const link = `https://arbor-aid.com/sign/contract/${res.signatureToken}`;
      console.log("Signing link:", link);
    }
  } catch (err) {
    alert("There was an issue creating the contract.");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function sendExistingContract(id) {
  try {
    const res = await api(`/api/admin/contracts/${id}/send`, {
      method: "POST"
    });
    alert("Contract sent.");
    console.log("Sign URL:", res.signUrl);
  } catch (err) {
    alert("Error sending contract.");
  }
}

// ========== INVOICES ==========

async function sendInvoice(formId, endpoint) {
  const form = document.getElementById(formId);
  if (!form) return;

  const submitBtn = form.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.disabled = true;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    alert("Invoice created.");
    if (res.id) {
      console.log("Invoice ID:", res.id);
    }
  } catch (err) {
    alert("There was an issue creating the invoice.");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function sendExistingInvoice(id) {
  try {
    const res = await api(`/api/admin/invoices/${id}/send`, {
      method: "POST"
    });
    alert("Invoice sent.");
    console.log("Invoice PDF:", res.pdfUrl);
  } catch (err) {
    alert("Error sending invoice.");
  }
}

async function markInvoicePaid(id) {
  try {
    await api(`/api/admin/invoices/${id}/mark-paid`, {
      method: "POST"
    });
    alert("Invoice marked as paid.");
  } catch (err) {
    alert("Error marking invoice paid.");
  }
}

// ========== CALENDAR ==========

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
  } catch (err) {
    console.error(err);
  }
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
    alert("Event created.");
  } catch (err) {
    alert("Error creating event.");
  }
}

// ========== REVIEWS TEST (ADMIN) ==========

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
  } catch (err) {
    console.error(err);
  }
}

// ========== WEATHER TEST ==========

async function testWeather() {
  try {
    const data = await api("/api/weather?city=Atlanta");
    const el = document.getElementById("weatherTestResult");
    if (!el) return;
    el.textContent = `Weather: ${data.description} — ${data.temp}°F`;
  } catch (err) {
    console.error(err);
  }
}

// ========== INIT ==========

window.addEventListener("load", () => {
  // Load initial analytics & jobs
  loadAdminAnalytics();
  loadSiteAnalytics();
  loadJobs("scheduled");
  loadCustomers();
});
