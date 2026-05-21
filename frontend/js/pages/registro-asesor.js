window.submitForm = async function () {
  try {
    const body = {
      name: document.getElementById("f1-nombre")?.value,
      email: document.querySelector("#step-1 input[type=email]")?.value,
      phone: document.querySelector("#step-1 input[type=tel]")?.value,
      location: document.querySelector("#step-1 input[placeholder*='Ciudad']")?.value || "CDMX",
      yearsExperience: parseInt(document.querySelector("#step-2 select, #step-2 input")?.value, 10) || 5,
      specialization: document.querySelector("#step-2 input[placeholder*='especialización']")?.value || "Marketing Digital",
      compensation: document.querySelector("#step-3 input, #step-3 textarea")?.value || "$35000 retainer + 15% bono",
      portfolio: document.querySelector("#step-2 textarea")?.value,
      methodology: document.querySelectorAll("#step-2 textarea")[1]?.value,
    };
    const { advisor } = await window.PymeBoost.api("/advisors", { method: "POST", body });
    window.PymeBoost.Session.asAdvisor(advisor.id);
    if (typeof goTo === "function") {
      document.querySelectorAll(".step-panel").forEach((p) => p.classList.remove("active"));
      const success = document.getElementById("step-success");
      if (success) success.classList.add("active");
    }
    window.PymeBoost.showToast("¡Cuenta de asesor creada!");
    setTimeout(() => (window.location.href = "Dashboard Asesor.html"), 1200);
  } catch (e) {
    window.PymeBoost.showToast(e.message || "Error al registrar asesor");
  }
};
