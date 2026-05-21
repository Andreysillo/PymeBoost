const { initDatabase, getDatabase } = require("../src/config/database");
const http = require("http");

initDatabase();
const db = getDatabase();
const v = db.prepare("SELECT value FROM app_metadata WHERE key='seed_version'").get();
console.log("seed_version:", v?.value);
for (const t of ["pymes", "advisors", "applications", "contracts", "conversations", "messages"]) {
  console.log(t, db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n);
}

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:5000${path}`, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve({ status: r.statusCode, body: d }));
      })
      .on("error", reject);
  });
}

(async () => {
  try {
    const health = await get("/health");
    console.log("health", health.status, health.body.slice(0, 80));
    const dash = await get("/api/advisors/1/dashboard");
    const j = JSON.parse(dash.body);
    console.log("advisor1 dashboard", dash.status, {
      opps: j.allOpportunities?.length,
      featured: j.featuredOpportunities?.length,
      apps: j.myApplications?.length,
      pendingSign: j.pendingSignatures?.length,
      active: j.activeProjects?.length,
      stats: j.stats,
    });
    const pyme = await get("/api/pymes/1/dashboard");
    const p = JSON.parse(pyme.body);
    console.log("pyme1 dashboard", pyme.status, {
      apps: p.applications?.length,
      contracts: p.contracts?.length,
    });
    const convs = await get("/api/conversations?role=advisor&userId=1");
    const c = JSON.parse(convs.body);
    console.log("advisor convs", convs.status, c.conversations?.length, "unread", c.totalUnread);

    const dash2 = JSON.parse((await get("/api/advisors/1/dashboard")).body);
    const pendingId = dash2.pendingSignatures?.[0]?.id;
    if (pendingId) {
      const sign = await post(`/api/contracts/${pendingId}/sign`, { role: "advisor", userId: 1 });
      console.log("sign contract", sign.status, sign.body.slice(0, 120));
    }

    const apply = await post("/api/applications", {
      advisorId: 2,
      smeId: 7,
      message: "Smoke test application from Jorge",
    });
    console.log("new application", apply.status, apply.body.slice(0, 80));

    const contracts = await get("/api/contracts?role=advisor&userId=1");
    const ct = JSON.parse(contracts.body);
    console.log("advisor contracts", contracts.status, ct.contracts?.length);
  } catch (e) {
    console.log("HTTP skipped (server down):", e.message);
  }
})();

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 5000,
        path,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve({ status: r.statusCode, body: d }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
