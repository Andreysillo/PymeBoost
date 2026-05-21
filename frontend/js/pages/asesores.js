(async function () {
  const { Session, api, matchClass } = window.PymeBoost;
  if (!localStorage.getItem("pymeboost_role")) {
    location.href = "Ingresar.html";
    return;
  }
  if (Session.getRole() !== "pyme") {
    location.href = "Dashboard Asesor.html";
    return;
  }
  Session.asPyme(Session.getUserId());

  const grid = document.getElementById("advisors-grid");
  if (!grid) return;

  try {
    const { advisors } = await api(`/pymes/${Session.getUserId()}/advisors?minMatch=40`);
    grid.innerHTML = advisors
      .map(
        (a) => `
      <div class="glass" style="padding:20px;border-radius:16px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);display:flex;align-items:center;justify-content:center;font-weight:700;">${a.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
          <div><div style="font-size:15px;font-weight:700;">${a.name}</div><div style="font-size:12px;color:rgba(255,255,255,0.4);">${a.specialization}</div></div>
          <span class="pill ${matchClass(a.matchScore)}" style="margin-left:auto;font-size:11px;">${a.matchScore}% match</span>
        </div>
        <p style="font-size:12px;color:rgba(255,255,255,0.5);line-height:1.6;margin-bottom:12px;">${a.bio || a.portfolio} · Proyectos de 5-7 meses</p>
        <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-bottom:14px;">${a.projectsCompleted} proyectos · $${a.retainer.toLocaleString("es-MX")}/mes</div>
        <button class="btn-primary" style="width:100%;justify-content:center;font-size:12px;" onclick="alert('Perfil: ${a.name}\\n${a.methodology || ""}')">Ver Perfil</button>
      </div>`
      )
      .join("");
  } catch (e) {
    grid.innerHTML = `<p style="color:rgba(255,255,255,0.5);">Error al cargar asesores. Inicia el backend.</p>`;
  }
})();
