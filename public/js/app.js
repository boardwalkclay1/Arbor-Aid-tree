// Basic menu toggle
function toggleMenu() {
  const nav = document.getElementById("mainNav");
  if (nav) nav.classList.toggle("open");
}

// Falling leaves animation (UPDATED)
const leafContainer = document.getElementById("leaf-container");

function createLeaf() {
  if (!leafContainer) return;

  const leaf = document.createElement("div");
  leaf.classList.add("leaf");

  // random horizontal position
  leaf.style.left = Math.random() * 100 + "vw";

  // random fall speed
  leaf.style.animationDuration = (Math.random() * 3 + 3) + "s";

  leafContainer.appendChild(leaf);

  // remove leaf after animation
  setTimeout(() => leaf.remove(), 6000);
}

// faster, smoother, constant falling leaves
setInterval(createLeaf, 300);

// Fade-in on load + initial data fetch
window.addEventListener("load", () => {
  document.body.classList.add("page-loaded");
  loadHomeReviews();
  loadHomeStats();
  loadWeather();
});

// Load review snippets for homepage
async function loadHomeReviews() {
  const container = document.getElementById("homeTestimonials");
  if (!container) return;

  try {
    const res = await fetch("/api/reviews?limit=3");
    if (!res.ok) throw new Error("Failed to load reviews");
    const reviews = await res.json();

    container.innerHTML = "";
    reviews.forEach(r => {
      const article = document.createElement("article");
      article.className = "testimonial-snippet";
      article.innerHTML = `
        <h3>${r.title || "Customer Review"}</h3>
        <p>${r.text}</p>
        <span>- ${r.name || "Customer"}, ${r.city || "Atlanta"}</span>
      `;
      container.appendChild(article);
    });
  } catch (err) {
    container.innerHTML = "<p>Reviews will appear here soon.</p>";
  }
}

// Load simple stats (jobs, 5★ reviews)
async function loadHomeStats() {
  const jobsEl = document.getElementById("statJobs");
  const reviewsEl = document.getElementById("statReviews");
  if (!jobsEl || !reviewsEl) return;

  try {
    const res = await fetch("/api/stats");
    if (!res.ok) throw new Error("Failed to load stats");
    const stats = await res.json();

    jobsEl.textContent = `Jobs completed this month: ${stats.jobsThisMonth || 0}`;
    reviewsEl.textContent = `5★ reviews: ${stats.fiveStarCount || 0}`;
  } catch (err) {
    jobsEl.textContent = "Jobs completed this month: —";
    reviewsEl.textContent = "5★ reviews: —";
  }
}

// Load weather for Atlanta
async function loadWeather() {
  const summaryEl = document.getElementById("weatherSummary");
  const tempEl = document.getElementById("weatherTemp");
  if (!summaryEl || !tempEl) return;

  try {
    const res = await fetch("/api/weather?city=Atlanta");
    if (!res.ok) throw new Error("Failed to load weather");
    const data = await res.json();

    summaryEl.textContent = data.description || "Weather data unavailable";
    tempEl.textContent = data.temp ? `${data.temp}°F` : "";
  } catch (err) {
    summaryEl.textContent = "Weather data unavailable";
    tempEl.textContent = "";
  }
}

/* =========================
   ADMIN PAGE HOOKS (Victor)
========================= */

// Create contract/invoice payload and send to Worker
async function sendContract(formId, endpoint) {
  const form = document.getElementById(formId);
  if (!form) return;

  const submitBtn = form.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.disabled = true;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to send contract");
    const result = await res.json();

    alert("Contract created and emailed.");
    if (result.pdfUrl) {
      const link = document.createElement("a");
      link.href = result.pdfUrl;
      link.download = result.fileName || "contract.pdf";
      link.click();
    }
  } catch (err) {
    alert("There was an issue creating the contract. Please try again.");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Load admin analytics
async function loadAdminAnalytics() {
  const panel = document.getElementById("adminAnalytics");
  if (!panel) return;

  try {
    const res = await fetch("/api/admin/analytics");
    if (!res.ok) throw new Error("Failed to load analytics");
    const data = await res.json();

    panel.querySelector("#adminJobs").textContent = data.jobs || 0;
    panel.querySelector("#adminRevenue").textContent = `$${data.revenue || 0}`;
    panel.querySelector("#adminOpenContracts").textContent = data.openContracts || 0;
  } catch (err) {
    panel.innerHTML = "<p>Analytics unavailable.</p>";
  }
}
