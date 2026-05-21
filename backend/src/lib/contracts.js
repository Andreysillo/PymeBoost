function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function generateContractBody({ sme, advisor, area, durationMonths, retainer, bonusPercent, kpis }) {
  const start = new Date().toISOString().slice(0, 10);
  const end = addMonths(start, durationMonths);

  return {
    sections: [
      {
        title: "1. Partes del Contrato",
        content: `PYME: ${sme.business_name} (RFC: ${sme.rfc || "N/D"}). Asesor: ${advisor.name}, especialización en ${advisor.specialization}.`,
      },
      {
        title: "2. Objeto del Contrato",
        content: `Asesoría estratégica en ${area}. Alcance: diagnóstico, diseño, implementación y medición. No incluye trabajo transaccional ni freelancing.`,
      },
      {
        title: "3. Duración y Fases",
        content: `Del ${start} al ${end} (${durationMonths} meses). Fase 1: Diagnóstico (Mes 1). Fase 2: Diseño (Mes 2). Fase 3: Implementación (Meses 3-${durationMonths - 1}). Fase 4: Medición (Mes ${durationMonths}).`,
      },
      {
        title: "4. Compensación",
        content: `Retainer mensual: $${retainer.toLocaleString("es-MX")} MXN. Bonificación: ${bonusPercent}% por cumplimiento de KPIs. KPIs: ${kpis}`,
      },
      {
        title: "5. Fondo de Garantía",
        content:
          "10% de retención por cada pago mensual, administrado por PymeBoost. Liberación al finalizar (98%) o por mediación neutral.",
      },
      {
        title: "6. Comisiones de Plataforma",
        content: "15% sobre retainer mensual. 10% sobre bonificaciones. Incluye verificación, legal, mediación y mantenimiento.",
      },
      {
        title: "7. Terminación y Disputas",
        content:
          "Mediación neutral como primer paso. Penalizaciones por terminación anticipada post-Fase 1 según contrato estándar PymeBoost.",
      },
    ],
    startDate: start,
    endDate: end,
    nonModifiable: true,
  };
}

function timelineToMonths(timeline) {
  if (!timeline) return 6;
  if (timeline.includes("9")) return 9;
  if (timeline.includes("12")) return 12;
  if (timeline.includes("3")) return 6;
  return 6;
}

function temporalProgress(monthsElapsed, durationMonths) {
  const pct = Math.min(100, Math.round((monthsElapsed / durationMonths) * 100));
  return { percent: pct, label: `${monthsElapsed} de ${durationMonths} meses` };
}

function netRetainer(retainer) {
  const platformFee = Math.round(retainer * 0.15);
  const gross = retainer - platformFee;
  const guarantee = Math.round(gross * 0.1);
  const net = gross - guarantee;
  return { platformFee, gross, guarantee, net };
}

module.exports = {
  generateContractBody,
  timelineToMonths,
  temporalProgress,
  netRetainer,
};
