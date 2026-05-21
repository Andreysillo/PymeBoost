const SPECIALIZATION_ALIASES = {
  "Optimización de Ventas": ["Ventas y Marketing", "Marketing Digital"],
  "Marketing Digital": ["Ventas y Marketing", "Optimización de Ventas"],
};

function parseJson(value, fallback = []) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function specializationScore(smeArea, advisorSpec) {
  if (!smeArea || !advisorSpec) return 0;
  if (smeArea === advisorSpec) return 40;
  const aliases = SPECIALIZATION_ALIASES[smeArea] || [];
  if (aliases.includes(advisorSpec)) return 25;
  if (advisorSpec.includes(smeArea) || smeArea.includes(advisorSpec)) return 25;
  return 0;
}

function industryScore(smeIndustry, advisorIndustries) {
  if (!smeIndustry || !advisorIndustries.length) return 0;
  const normalized = advisorIndustries.map((i) => i.toLowerCase());
  const sme = smeIndustry.toLowerCase();
  if (normalized.some((i) => sme.includes(i) || i.includes(sme.split("/")[0].trim()))) {
    return 30;
  }
  return 0;
}

function locationScore(smeCity, advisorLocation) {
  if (!smeCity || !advisorLocation) return 0;
  const a = smeCity.toLowerCase().trim();
  const b = advisorLocation.toLowerCase().trim();
  if (a === b || a.includes(b) || b.includes(a)) return 15;
  return 0;
}

function sizeScore(smeEmployees, advisorSizes) {
  if (!smeEmployees || !advisorSizes.length) return 0;
  const ranges = [
    { label: "1 – 10 empleados", min: 1, max: 10 },
    { label: "11 – 50 empleados", min: 11, max: 50 },
    { label: "51 – 200 empleados", min: 51, max: 200 },
  ];
  const smeRange = ranges.find((r) => smeEmployees >= r.min && smeEmployees <= r.max);
  if (!smeRange) return 0;
  if (advisorSizes.some((s) => s.includes(String(smeRange.min)) || s === smeRange.label)) {
    return 15;
  }
  return 0;
}

function calculateMatch(sme, advisor) {
  const areas = parseJson(sme.areas);
  const primaryArea = sme.primary_area || areas[0] || "";
  const advisorIndustries = parseJson(advisor.industries);
  const advisorSizes = parseJson(advisor.company_sizes);

  const spec = specializationScore(primaryArea, advisor.specialization);
  const ind = industryScore(sme.industry, advisorIndustries);
  const loc = locationScore(sme.city, advisor.location);
  const size = sizeScore(sme.employees, advisorSizes);

  const total = Math.min(100, spec + ind + loc + size);

  return {
    score: total,
    breakdown: {
      specialization: spec,
      industry: ind,
      location: loc,
      companySize: size,
    },
  };
}

function matchVisibility(score) {
  if (score > 80) return "featured";
  if (score >= 60) return "general";
  if (score >= 40) return "filtered";
  return "search_only";
}

module.exports = {
  calculateMatch,
  matchVisibility,
  parseJson,
};
