function collectPymeForm() {
  const panels = document.getElementById("step-1");
  const panels2 = document.getElementById("step-2");
  const inputs = document.querySelectorAll(".inp");
  const getVal = (el) => el?.value?.trim() || "";

  const chips = panels2?.querySelectorAll(".chip.active");
  const areas = [...(chips || [])].map((c) => c.textContent.trim());
  const timeline = panels2?.querySelector(".chip.active")?.textContent?.trim() || "3 – 6 meses";

  return {
    businessName: getVal(inputs[0]),
    rfc: getVal(inputs[1]),
    industry: inputs[2]?.value || inputs[2]?.selectedOptions?.[0]?.text,
    size: inputs[3]?.value || inputs[3]?.selectedOptions?.[0]?.text,
    email: getVal(inputs[4]),
    phone: getVal(inputs[5]),
    city: "CDMX",
    annualRevenue: getVal(inputs[6]) || undefined,
    areas,
    objectives: panels2?.querySelector("textarea")?.value,
    timeline,
  };
}

const origSubmit = window.submitForm;
window.submitForm = async function () {
  try {
    const body = collectPymeForm();
    const { pyme } = await window.PymeBoost.api("/pymes", { method: "POST", body });
    window.PymeBoost.Session.asPyme(pyme.id);
    document.getElementById("step-2")?.classList.remove("active");
    document.getElementById("step-success")?.classList.add("active");
    document.getElementById("step-label").textContent = "¡Registro completado!";
    document.getElementById("prog-1").style.width = "100%";
    document.getElementById("prog-2").style.width = "100%";
    const link = document.querySelector("#step-success a");
    if (link) link.href = "Dashboard PYME.html";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    window.PymeBoost.showToast(e.message || "Error al registrar");
  }
};
