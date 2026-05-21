(function () {
  const { Session, api, matchClass, showToast } = window.PymeBoost;
  if (!localStorage.getItem("pymeboost_role")) {
    location.href = "Ingresar.html";
    return;
  }
  Session.asAdvisor(Session.getUserId());

  window.openModal = (id) => {
    document.getElementById(id).style.display = "flex";
  };
  window.closeModal = (id) => {
    document.getElementById(id).style.display = "none";
  };
  window.scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  let dashboardData = null;
  window._oppsBySmeId = {};

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function contractSections(o) {
    return [
      { title: "1. Partes", desc: `${o.businessName} (PYME) · Asesor especializado` },
      { title: "2. Objeto", desc: `Asesoría en ${o.primaryArea}. Alcance según categoría estándar PymeBoost.` },
      { title: "3. Duración", desc: o.timeline || "6 meses" },
      { title: "4. Compensación", desc: `${o.budgetHint}` },
      { title: "5. Fondo de Garantía", desc: "10% retención mensual, cuenta neutral PymeBoost." },
      { title: "6. Comisiones", desc: "15% retainers · 10% bonificaciones." },
      { title: "7. Disputas", desc: "Mediación neutral certificada." },
    ];
  }

  function buildOppMap(opps) {
    window._oppsBySmeId = {};
    for (const o of opps) {
      window._oppsBySmeId[o.id] = {
        ...o,
        matchCls: matchClass(o.matchScore),
        sections: contractSections(o),
        contractType: o.primaryArea,
        rate: o.budgetHint,
        bonus: "según KPIs",
        need: o.objectives || "Objetivos definidos en perfil de la PYME.",
        size: `${o.employees} empleados`,
        city: o.city,
      };
    }
  }

  window.openDetail = function (smeId) {
    const o = window._oppsBySmeId[smeId];
    if (!o) return;
    document.getElementById("detail-title").textContent = o.businessName + " — Oportunidad";
    document.getElementById("detail-body").innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:44px;height:44px;border-radius:12px;background:rgba(124,58,237,0.2);display:flex;align-items:center;justify-content:center;font-weight:800;color:#a78bfa;">
          ${esc(o.businessName.split(" ").map((w) => w[0]).join("").slice(0, 2))}
        </div>
        <div>
          <div style="font-size:15px;font-weight:800;">${esc(o.businessName)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.45);">${esc(o.industry)} · ${esc(o.city)}</div>
          <span class="pill ${o.matchCls}" style="font-size:10px;margin-top:6px;display:inline-flex;">${o.matchScore}% match</span>
        </div>
      </div>
      <div style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.65;margin-bottom:16px;background:rgba(255,255,255,0.03);padding:12px;border-radius:10px;">${esc(o.need)}</div>
      <div style="display:flex;gap:10px;">
        <button onclick="closeModal('modal-detail')" class="btn-secondary" style="flex:1;">Cerrar</button>
        <button onclick="closeModal('modal-detail');openApply(${smeId})" class="btn-primary" style="flex:1;">Aplicar →</button>
      </div>`;
    openModal("modal-detail");
  };

  window.openApply = function (smeId) {
    const o = window._oppsBySmeId[smeId];
    if (!o) return;
    window._applySmeId = smeId;
    document.getElementById("apply-title").textContent = "Aplicar — " + o.businessName;
    document.getElementById("apply-contract-meta").innerHTML = `
      <strong>Tipo:</strong> ${esc(o.primaryArea)} · <strong>Duración:</strong> ${esc(o.timeline)}<br>
      <strong>Compensación:</strong> ${esc(o.budgetHint)}`;
    document.getElementById("apply-sections").innerHTML = o.sections
      .map(
        (s) =>
          `<div class="contract-section"><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);">${esc(s.title)}</div><div style="font-size:12px;color:rgba(255,255,255,0.55);margin-top:4px;">${esc(s.desc)}</div></div>`
      )
      .join("");
    document.getElementById("apply-msg").value =
      "Me interesa este proyecto por mi experiencia en " + o.primaryArea + " y resultados medibles en empresas similares.";
    openModal("modal-apply");
  };

  window.submitApply = async function () {
    const smeId = window._applySmeId;
    const msg = document.getElementById("apply-msg")?.value?.trim();
    if (!smeId || !msg) {
      showToast("Escribe un mensaje para la PYME");
      return;
    }
    try {
      await api("/applications", {
        method: "POST",
        body: { advisorId: Session.getUserId(), smeId, message: msg },
      });
      closeModal("modal-apply");
      showToast("¡Aplicación enviada! La PYME será notificada.");
      await init();
    } catch (e) {
      showToast(e.message);
    }
  };

  function renderOppCard(o, featured) {
    const initials = o.businessName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2);
    return `
      <div class="opp-card" ${featured ? 'style="position:relative;overflow:hidden"' : ""}>
        ${featured ? '<div class="top-bar"></div>' : ""}
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <div style="display:flex;gap:9px;align-items:center;">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(124,58,237,0.2);display:flex;align-items:center;justify-content:center;font-weight:800;color:#a78bfa;font-size:11px;">${initials}</div>
            <div><div style="font-weight:700;font-size:13px;">${esc(o.businessName)}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);">${esc(o.industry)}</div></div>
          </div>
        </div>
        <span class="pill ${matchClass(o.matchScore)}" style="font-size:11px;margin-bottom:8px;display:inline-flex;">${o.matchScore}% match</span>
        ${o.alreadyApplied ? '<span class="pill" style="font-size:10px;margin-left:6px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.55);">Ya aplicaste</span>' : ""}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin:8px 0 12px;">
          <div style="background:rgba(255,255,255,0.03);padding:7px;border-radius:8px;"><div style="color:rgba(255,255,255,0.35);font-size:10px;">Área</div><div style="font-weight:600;">${esc(o.primaryArea)}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:7px;border-radius:8px;"><div style="color:rgba(255,255,255,0.35);font-size:10px;">Timeline</div><div style="font-weight:600;">${esc(o.timeline || "6 meses")}</div></div>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-bottom:12px;">${esc(o.budgetHint)}</div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn-secondary" style="flex:1;font-size:11px;padding:7px;" onclick="openDetail(${o.id})">Ver Detalles</button>
          <button type="button" class="btn-primary" style="flex:1;font-size:11px;padding:7px;${o.alreadyApplied ? "opacity:0.5" : ""}" onclick="openApply(${o.id})" ${o.alreadyApplied ? 'title="Ya enviaste postulación"' : ""}>${o.alreadyApplied ? "Reaplicar" : "Aplicar →"}</button>
        </div>
      </div>`;
  }

  async function init() {
    const data = await api(`/advisors/${Session.getUserId()}/dashboard`);
    dashboardData = data;
    buildOppMap([...data.allOpportunities, ...data.featuredOpportunities]);

    const headerSub = document.querySelector("header p");
    if (headerSub) headerSub.textContent = `Bienvenida de vuelta, ${data.advisor.name}`;

    const stats = document.querySelectorAll(".stat-card");
    const s = data.stats;
    if (stats[0]) stats[0].querySelector("div[style*='font-size:28px']")?.replaceChildren(document.createTextNode(String(s.activeProjects)));
    if (stats[1]) stats[1].querySelector("div[style*='font-size:28px']")?.replaceChildren(document.createTextNode(`$${Math.round(s.monthlyIncome / 1000)}k`));
    if (stats[2]) stats[2].querySelector("div[style*='font-size:28px']")?.replaceChildren(document.createTextNode(String(s.opportunitiesCount)));
    if (stats[3]) stats[3].querySelector("div[style*='font-size:28px']")?.replaceChildren(document.createTextNode(String(s.completedProjects)));

    const oppBadge = document.querySelector('a[href="#opp-section"] span, a[onclick*="opp-section"] span');
    if (oppBadge) oppBadge.textContent = s.opportunitiesCount;

    const banner = document.getElementById("pending-banner");
    if (banner) {
      if (data.pendingSignatures?.length) {
        banner.innerHTML = `
          <div class="glass" style="padding:16px 20px;border-color:rgba(245,158,11,0.25);background:rgba(245,158,11,0.06);">
            <div style="font-size:13px;font-weight:700;color:#fbbf24;margin-bottom:8px;">⏳ Contratos pendientes de tu firma (${data.pendingSignatures.length})</div>
            ${data.pendingSignatures
              .map(
                (c) =>
                  `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:12px;color:rgba(255,255,255,0.6);">
                    <span>${esc(c.smeName)} — ${esc(c.area)} · $${c.retainer?.toLocaleString("es-MX")}/mes</span>
                    <a href="Contratos.html" class="btn-primary" style="font-size:11px;padding:6px 12px;">Firmar</a>
                  </div>`
              )
              .join("")}
          </div>`;
        banner.style.display = "block";
      } else {
        banner.innerHTML = "";
        banner.style.display = "none";
      }
    }

    const appSec = document.getElementById("applications-section");
    if (appSec && data.myApplications?.length) {
      appSec.style.display = "block";
      appSec.innerHTML = `
        <h2 style="font-size:14px;font-weight:700;margin:0 0 14px;">Mis postulaciones (${data.myApplications.length})</h2>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${data.myApplications
            .slice(0, 8)
            .map(
              (a) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
              <div>
                <div style="font-size:13px;font-weight:600;">${esc(a.businessName)}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.4);">${esc(a.primaryArea)} · ${a.matchScore}% match</div>
              </div>
              <span class="pill" style="font-size:10px;background:${a.status === "pending" ? "rgba(245,158,11,0.15)" : a.status === "accepted" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.08)"};color:${a.status === "pending" ? "#fbbf24" : a.status === "accepted" ? "#34d399" : "rgba(255,255,255,0.5)"};">${a.status}</span>
            </div>`
            )
            .join("")}
        </div>`;
    } else if (appSec) appSec.style.display = "none";

    const oppGrid = document.getElementById("opp-grid");
    if (oppGrid) {
      const featured = data.featuredOpportunities || [];
      const rest = (data.allOpportunities || []).filter((o) => !featured.some((f) => f.id === o.id)).slice(0, 6);
      oppGrid.innerHTML =
        featured.map((o) => renderOppCard(o, true)).join("") +
        (rest.length
          ? `<div style="grid-column:1/-1;font-size:12px;color:rgba(255,255,255,0.35);margin:8px 0 4px;">Más oportunidades</div>` +
            `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;grid-column:1/-1;">${rest.map((o) => renderOppCard(o, false)).join("")}</div>`
          : "");
    }

    const projectsList = document.getElementById("projects-list");
    if (projectsList) {
      if (!data.activeProjects?.length) {
        projectsList.innerHTML = `<p style="color:rgba(255,255,255,0.4);font-size:13px;">Sin proyectos activos. Aplica a una oportunidad para comenzar.</p>`;
      } else {
        projectsList.innerHTML = data.activeProjects
          .map(
            (p) => `
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
              <div style="display:flex;gap:10px;align-items:center;">
                <div style="width:38px;height:38px;border-radius:10px;background:rgba(124,58,237,0.2);display:flex;align-items:center;justify-content:center;font-weight:800;color:#a78bfa;font-size:11px;">${esc(p.smeInitials)}</div>
                <div><div style="font-weight:700;font-size:13px;">${esc(p.smeName)}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);">${esc(p.area)} · ${p.durationMonths} meses</div></div>
              </div>
              <a href="Contratos.html" class="btn-secondary" style="font-size:11px;padding:5px 12px;">Ver contrato</a>
            </div>
            <div class="progress-bar" style="margin-bottom:6px;"><div class="progress-fill" style="width:${p.progressPercent}%;"></div></div>
            <div style="font-size:11px;color:rgba(255,255,255,0.4);">${esc(p.progressLabel)} — ${p.progressPercent}% · Próx: ${esc(p.nextMilestone)}</div>
          </div>`
          )
          .join("");
      }
    }
  }

  init().catch((e) => {
    console.error(e);
    showToast("Error al cargar dashboard. Reinicia el backend o visita Ingresar.html");
  });
})();
