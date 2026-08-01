import adminWorker from "./admin-worker.js";

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

    // ADMIN ROUTES → FORWARD TO ADMIN WORKER
    if (path.startsWith("/api/admin/")) {
      return adminWorker.fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  }
};
