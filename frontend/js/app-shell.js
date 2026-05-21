/** Navegación y sidebar según rol (pyme | advisor) */
(function () {
  const { Session, api } = window.PymeBoost || {};
  if (!Session) return;

  const role = Session.getRole();
  const isPyme = role === "pyme";
  const activePage = document.body.dataset.page || "";

  const nav = document.getElementById("app-nav");
  if (nav) {
    const dash = isPyme ? "Dashboard PYME.html" : "Dashboard Asesor.html";
    nav.innerHTML = `
      <a href="${dash}" class="nav-item ${activePage === "dashboard" ? "active" : ""}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Inicio
      </a>
      ${isPyme ? `<a href="Asesores.html" class="nav-item ${activePage === "asesores" ? "active" : ""}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Buscar Asesores</a>` : `<a href="${dash}#opp-section" class="nav-item"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Oportunidades</a>`}
      <a href="Contratos.html" class="nav-item ${activePage === "contratos" ? "active" : ""}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
        Mis Contratos
      </a>
      <a href="Mensajes.html" class="nav-item ${activePage === "mensajes" ? "active" : ""}" id="nav-mensajes">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Mensajes<span id="nav-msg-badge" style="display:none;margin-left:auto;background:#7c3aed;color:white;font-size:10px;font-weight:700;padding:1px 7px;border-radius:100px;"></span>
      </a>
      <div style="flex:1"></div>
      <a href="Ingresar.html" class="nav-item" style="font-size:12px;opacity:0.7;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Cambiar cuenta
      </a>
    `;
  }

  const panelLabel = document.getElementById("panel-label");
  if (panelLabel) panelLabel.textContent = isPyme ? "Panel PYME" : "Panel Asesor";

  async function loadUserChip() {
    try {
      const path = isPyme ? `/pymes/${Session.getUserId()}` : `/advisors/${Session.getUserId()}`;
      const data = await api(path);
      const name = isPyme ? data.pyme.businessName : data.advisor.name;
      const sub = isPyme
        ? `${data.pyme.industry} · ${data.pyme.employees} emp.`
        : data.advisor.specialization;
      const elName = document.getElementById("user-name");
      const elSub = document.getElementById("user-sub");
      const elInit = document.getElementById("user-initials");
      if (elName) elName.textContent = name;
      if (elSub) elSub.textContent = sub;
      if (elInit)
        elInit.textContent = name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
    } catch {
      /* ignore */
    }
  }

  async function loadMsgBadge() {
    try {
      const { totalUnread } = await api(
        `/conversations?role=${role}&userId=${Session.getUserId()}`
      );
      const badge = document.getElementById("nav-msg-badge");
      if (badge && totalUnread > 0) {
        badge.style.display = "inline";
        badge.textContent = totalUnread;
      }
    } catch {
      /* ignore */
    }
  }

  loadUserChip();
  loadMsgBadge();
})();
