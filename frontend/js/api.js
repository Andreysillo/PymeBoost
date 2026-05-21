const API_BASE =
  window.location.protocol === "file:"
    ? "http://localhost:5000"
    : window.location.origin;

const Session = {
  getRole() {
    return localStorage.getItem("pymeboost_role") || "pyme";
  },
  getUserId() {
    const stored = localStorage.getItem("pymeboost_user_id");
    if (stored) return Number(stored);
    return this.getRole() === "advisor" ? 1 : 1;
  },
  set(role, userId) {
    localStorage.setItem("pymeboost_role", role);
    localStorage.setItem("pymeboost_user_id", String(userId));
  },
  asPyme(id) {
    this.set("pyme", id || 1);
  },
  asAdvisor(id) {
    this.set("advisor", id || 1);
  },
};

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function formatMoney(n) {
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n.toLocaleString("es-MX")}`;
}

function matchClass(score) {
  if (score >= 80) return "match-high";
  if (score >= 60) return "match-mid";
  return "match-low";
}

function statusBadge(status) {
  const map = {
    activo: ["badge-active", "Activo"],
    pendiente: ["badge-pending", "Pendiente firma"],
    completado: ["badge-done", "Completado"],
  };
  const [cls, label] = map[status] || ["badge-pending", status];
  return `<span class="pill ${cls}">${label}</span>`;
}

function showToast(msg) {
  let t = document.getElementById("pb-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "pb-toast";
    t.style.cssText =
      "position:fixed;bottom:24px;right:24px;background:#7c3aed;color:white;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;display:none;box-shadow:0 4px 20px rgba(124,58,237,0.4);";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => {
    t.style.display = "none";
  }, 4000);
}

window.PymeBoost = { API_BASE, Session, api, formatMoney, matchClass, statusBadge, showToast };
