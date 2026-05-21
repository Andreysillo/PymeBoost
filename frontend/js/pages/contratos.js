(async function () {
  const { Session, api, statusBadge, showToast } = window.PymeBoost;
  const role = Session.getRole() || "pyme";
  const userId = Session.getUserId();
  if (!localStorage.getItem("pymeboost_role")) {
    location.href = "Ingresar.html";
    return;
  }
  let currentFilter = "todos";
  let contracts = [];

  const listEl = document.getElementById("contracts-list") || document.querySelector("main");

  async function load(status = "todos") {
    const data = await api(`/contracts?role=${role}&userId=${userId}&status=${status}`);
    contracts = data.contracts;
    render(data.contracts, data.counts);
    document.querySelectorAll(".filter-tab").forEach((tab, i) => {
      const keys = ["todos", "activo", "pendiente", "completado"];
      if (keys[i]) tab.textContent = `${tab.textContent.split(" (")[0]} (${data.counts[keys[i]] || 0})`;
    });
  }

  function render(items, counts) {
    const container = document.getElementById("contracts-list");
    if (!container) return;
    container.innerHTML = items
      .map((c) => {
        const counterparty = role === "pyme" ? c.advisorName : c.smeName;
        const canSign =
          (role === "pyme" && !c.signedSme) || (role === "advisor" && !c.signedAdvisor);
        return `
      <div class="glass contract-card" data-status="${c.status}" data-id="${c.id}" style="padding:20px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:15px;font-weight:700;">${counterparty}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px;">${c.area} · ${c.startDate} → ${c.endDate}</div>
          </div>
          ${statusBadge(c.status)}
        </div>
        ${c.status === "activo" ? `<div style="margin-bottom:14px;"><div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:6px;">Progreso del Proyecto — ${c.progressPercent}%</div><div class="progress-bar"><div class="progress-fill" style="width:${c.progressPercent}%;"></div></div></div>` : ""}
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:12px;margin-bottom:14px;">
          <div><div style="color:rgba(255,255,255,0.35);font-size:10px;">Retainer</div><div style="font-weight:600;">$${c.retainer.toLocaleString("es-MX")}/mes</div></div>
          <div><div style="color:rgba(255,255,255,0.35);font-size:10px;">Bono</div><div style="font-weight:600;">${c.bonusPercent}%</div></div>
          <div><div style="color:rgba(255,255,255,0.35);font-size:10px;">${c.status === "completado" ? "Resultado" : "Próximo hito"}</div><div style="font-weight:600;color:#a78bfa;">${c.status === "completado" ? "KPIs cumplidos" : c.nextMilestone || "—"}</div></div>
          <div><div style="color:rgba(255,255,255,0.35);font-size:10px;">Firmas</div><div style="font-weight:600;">PYME ${c.signedSme ? "✓" : "○"} · Asesor ${c.signedAdvisor ? "✓" : "○"}</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn-secondary btn-view" data-id="${c.id}">Ver Contrato</button>
          ${canSign && c.status === "pendiente" ? `<button class="btn-primary btn-sign" data-id="${c.id}">Revisar y Firmar</button>` : ""}
          ${c.status === "activo" ? `<button class="btn-dispute" data-id="${c.id}" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#f87171;border-radius:9px;padding:5px 12px;font-size:11px;cursor:pointer;">Reportar Problema</button>` : ""}
          ${c.status === "completado" && role === "pyme" ? `<button class="btn-additional" data-id="${c.id}" style="padding:8px 16px;border-radius:11px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);color:#a78bfa;font-size:12px;cursor:pointer;">+ Solicitar contrato adicional</button>` : ""}
        </div>
      </div>`;
      })
      .join("");

    bindActions();
    const params = new URLSearchParams(location.search);
    const highlight = params.get("contract");
    if (highlight) {
      const el = container.querySelector(`[data-id="${highlight}"]`);
      el?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function bindActions() {
    document.querySelectorAll(".btn-sign").forEach((btn) => {
      btn.onclick = async () => {
        await api(`/contracts/${btn.dataset.id}/sign`, { method: "POST", body: { role } });
        showToast("¡Contrato firmado!");
        load(currentFilter);
      };
    });
    document.querySelectorAll(".btn-view").forEach((btn) => {
      btn.onclick = async () => {
        const { contract } = await api(`/contracts/${btn.dataset.id}`);
        const body = contract.contractBody?.sections
          ?.map((s) => `<h4 style="color:#a78bfa;margin:12px 0 6px;">${s.title}</h4><p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">${s.content}</p>`)
          .join("");
        document.getElementById("modal-ver-body").innerHTML =
          body || "<p>Contrato no disponible</p>";
        document.getElementById("modal-ver").style.display = "flex";
      };
    });
    document.querySelectorAll(".btn-dispute").forEach((btn) => {
      btn.onclick = () => {
        window._disputeContractId = btn.dataset.id;
        document.getElementById("modal-disputa").style.display = "flex";
      };
    });
    document.querySelectorAll(".btn-additional").forEach((btn) => {
      btn.onclick = () => {
        window._additionalContractId = btn.dataset.id;
        document.getElementById("modal-adicional").style.display = "flex";
      };
    });
  }

  window.filterContracts = function (status, btn) {
    currentFilter = status;
    document.querySelectorAll(".filter-tab").forEach((b) => b.classList.remove("active"));
    btn?.classList.add("active");
    load(status === "todos" ? "todos" : status);
  };

  const origShowToast = window.showToast;
  window.showToast = showToast;

  document.querySelector("#modal-firmar .btn-primary")?.addEventListener("click", async function () {
    const first = contracts.find((c) => c.status === "pendiente");
    if (first) {
      await api(`/contracts/${first.id}/sign`, { method: "POST", body: { role } });
      document.getElementById("modal-firmar").style.display = "none";
      showToast("¡Contrato firmado!");
      load(currentFilter);
    }
  });

  const disputeBtn = document.querySelector("#modal-disputa button[style*='flex:1'][style*='Reportar']");
  if (disputeBtn) {
    disputeBtn.onclick = async () => {
      const desc = document.querySelector("#modal-disputa textarea")?.value || "Sin descripción";
      await api(`/contracts/${window._disputeContractId}/dispute`, {
        method: "POST",
        body: { reportedBy: role, description: desc },
      });
      document.getElementById("modal-disputa").style.display = "none";
      showToast("Disputa iniciada. Te contactaremos en 1-2 días hábiles.");
    };
  }

  const addBtn = document.querySelector("#modal-adicional .btn-primary");
  if (addBtn) {
    addBtn.onclick = async () => {
      const desc = document.querySelector("#modal-adicional textarea")?.value;
      const duration = document.querySelector("#modal-adicional input")?.value;
      const objectives = document.querySelectorAll("#modal-adicional textarea")[1]?.value;
      await api(`/contracts/${window._additionalContractId}/additional`, {
        method: "POST",
        body: { description: desc, duration, objectives },
      });
      document.getElementById("modal-adicional").style.display = "none";
      showToast("Solicitud enviada. Revisaremos en 2-3 días hábiles.");
    };
  }

  try {
    await load();
  } catch (e) {
    console.error(e);
    showToast("Error cargando contratos");
  }
})();
