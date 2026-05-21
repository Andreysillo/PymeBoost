(async function () {
  const { Session, api, formatMoney, matchClass, statusBadge, showToast } = window.PymeBoost;
  if (!localStorage.getItem("pymeboost_role")) {
    location.href = "Ingresar.html";
    return;
  }
  if (Session.getRole() !== "pyme") {
    location.href = "Dashboard Asesor.html";
    return;
  }
  Session.asPyme(Session.getUserId());

  try {
    const data = await api(`/pymes/${Session.getUserId()}/dashboard`);

    document.querySelector("header h1 + p")?.replaceWith(
      Object.assign(document.createElement("p"), {
        style: "font-size:11px;color:rgba(255,255,255,0.35);margin:1px 0 0;",
        textContent: `Bienvenida, ${data.pyme.businessName}`,
      })
    );

    const stats = document.querySelectorAll(".stat-card");
    if (stats[0]) stats[0].querySelector("div[style*='font-size:26px']")?.replaceChildren(document.createTextNode(String(data.stats.activeContracts)));
    if (stats[1]) {
      stats[1].querySelector("div[style*='font-size:26px']")?.replaceChildren(document.createTextNode(`${data.stats.temporalProgress}%`));
      stats[1].querySelector("div[style*='margin-top:4px']")?.replaceChildren(document.createTextNode(data.stats.temporalLabel));
    }
    if (stats[2]) stats[2].querySelector("div[style*='font-size:26px']")?.replaceChildren(document.createTextNode(formatMoney(data.stats.totalInvestment)));
    if (stats[3]) stats[3].querySelector("div[style*='font-size:26px']")?.replaceChildren(document.createTextNode(`${data.stats.milestonesCompleted}/${data.stats.milestonesTotal}`));

    const contractsBox = document.querySelector(".glass:nth-of-type(1)") || document.querySelectorAll(".glass")[1];
    const activeSection = document.querySelectorAll(".glass")[1];
    if (activeSection) {
      const container = activeSection.querySelectorAll("[style*='margin-bottom:10px']")[0]?.parentElement;
      const parent = activeSection;
      const oldCards = parent.querySelectorAll("[style*='background:rgba(255,255,255,0.03)']");
      oldCards.forEach((el) => el.remove());

      const insertPoint = parent.querySelector("a[href='Contratos.html']")?.closest("div")?.nextElementSibling || parent.children[2];

      data.activeContracts.forEach((c) => {
        const div = document.createElement("div");
        div.style.cssText = "background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px;margin-bottom:10px;";
        div.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:9px;">
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${c.advisorInitials}</div>
              <div><div style="font-size:13px;font-weight:600;">${c.advisorName}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);">${c.area}</div></div>
            </div>
            ${statusBadge(c.status)}
          </div>
          ${c.status === "activo" ? `<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:5px;"><span>Progreso temporal</span><span>${c.progressLabel} — ${c.progressPercent}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${c.progressPercent}%;"></div></div></div>` : ""}
          <div style="font-size:11px;color:rgba(255,255,255,0.4);">$${c.retainer.toLocaleString("es-MX")} MXN/mes${!c.signedSme && c.signedAdvisor ? " · Esperando tu firma" : ""}</div>
          ${!c.signedSme && c.signedAdvisor ? `<a href="Contratos.html" class="btn-primary" style="margin-top:10px;font-size:11px;padding:7px 14px;display:inline-flex;">Revisar y Firmar</a>` : ""}
        `;
        parent.appendChild(div);
      });
    }

    const appsSection = document.querySelectorAll(".glass")[2];
    if (appsSection && data.applications) {
      const badge = appsSection.querySelector("span[style*='background:#7c3aed']");
      if (badge) badge.textContent = `${data.pendingApplications} nuevos`;
      appsSection.querySelectorAll("[style*='margin-bottom:10px']").forEach((el, i) => {
        if (i > 0 && el.closest(".glass") === appsSection) el.remove();
      });
      const cards = appsSection.querySelectorAll("[style*='background:rgba(255,255,255,0.03)']");
      cards.forEach((c) => c.remove());

      data.applications.forEach((a) => {
        const div = document.createElement("div");
        div.style.cssText = "background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px;margin-bottom:10px;";
        div.innerHTML = `
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:9px;">
              <div style="width:34px;height:34px;border-radius:50%;background:rgba(16,185,129,0.2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#34d399;">${a.initials}</div>
              <div><div style="font-size:13px;font-weight:600;">${a.advisorName}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);">${a.specialization} · ${a.yearsExperience} años</div></div>
            </div>
            <span class="pill ${matchClass(a.matchScore)}" style="font-size:10px;padding:3px 8px;">${a.matchScore}% match</span>
          </div>
          <p style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;margin-bottom:12px;">"${a.message}"</p>
          <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-bottom:10px;">$${a.retainer.toLocaleString("es-MX")}/mes + ${a.bonusPercent}% bono</div>
          <div style="display:flex;gap:6px;">
            <button class="btn-secondary btn-reject" data-id="${a.id}" style="font-size:11px;padding:6px 12px;flex:1;">Rechazar</button>
            <button class="btn-primary btn-accept" data-id="${a.id}" style="font-size:11px;padding:6px 12px;flex:1;">Contratar</button>
          </div>
        `;
        appsSection.appendChild(div);
      });

      appsSection.querySelectorAll(".btn-reject").forEach((btn) => {
        btn.addEventListener("click", async () => {
          await api(`/applications/${btn.dataset.id}`, { method: "PATCH", body: { action: "reject" } });
          showToast("Aplicación rechazada");
          location.reload();
        });
      });
      appsSection.querySelectorAll(".btn-accept").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const r = await api(`/applications/${btn.dataset.id}`, { method: "PATCH", body: { action: "accept" } });
          showToast("Contrato creado. Revisa en Mis Contratos.");
          setTimeout(() => (window.location.href = `Contratos.html?contract=${r.contractId}`), 800);
        });
      });
    }

    const recSection = document.querySelectorAll(".glass")[3];
    if (recSection) {
      const grid = recSection.querySelector("[style*='grid-template-columns:repeat(3']");
      if (grid) {
        grid.innerHTML = data.recommendedAdvisors
          .map(
            (a) => `
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${a.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
              <div><div style="font-size:13px;font-weight:700;">${a.name}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);">${a.specialization}</div></div>
            </div>
            <span class="pill ${matchClass(a.matchScore)}" style="font-size:10px;padding:3px 8px;margin-bottom:8px;display:inline-flex;">${a.matchScore}% match</span>
            <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-bottom:10px;">${a.yearsExperience} años · ${a.location} · ${a.projectsCompleted} proyectos</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-bottom:12px;">$${a.retainer.toLocaleString("es-MX")}/mes + ${a.bonusPercent}% bono</div>
            <a href="Asesores.html" class="btn-primary" style="width:100%;justify-content:center;font-size:11px;padding:7px 12px;display:inline-flex;">Ver Perfil</a>
          </div>`
          )
          .join("");
      }
      const subtitle = recSection.querySelector("p");
      if (subtitle)
        subtitle.textContent = `Basado en ${data.pyme.primaryArea} · ${data.pyme.industry} · ${data.pyme.city} · ${data.pyme.employees} empleados`;
    }

    const sidebarName = document.querySelector("aside div[style*='font-size:12px;font-weight:600']");
    if (sidebarName) sidebarName.textContent = data.pyme.businessName;
  } catch (e) {
    console.error("Dashboard PYME:", e);
    showToast("Error al cargar datos. ¿Backend en http://localhost:5000?");
  }
})();
