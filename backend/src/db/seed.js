const { calculateMatch } = require("../lib/matching");
const { generateContractBody, timelineToMonths } = require("../lib/contracts");

const SEED_VERSION = "4";

function clearDatabase(db) {
  db.exec(`
    DELETE FROM messages;
    DELETE FROM conversations;
    DELETE FROM disputes;
    DELETE FROM additional_requests;
    DELETE FROM contracts;
    DELETE FROM applications;
    DELETE FROM advisors;
    DELETE FROM pymes;
    DELETE FROM sqlite_sequence WHERE name IN (
      'messages','conversations','disputes','additional_requests',
      'contracts','applications','advisors','pymes'
    );
  `);
  db.prepare("DELETE FROM app_metadata").run();
}

function insertContract(db, { smeId, advisorId, area, status, months, elapsed, signedSme, signedAdvisor, milestone, kpis, retainer, bonus }) {
  const sme = db.prepare("SELECT * FROM pymes WHERE id = ?").get(smeId);
  const advisor = db.prepare("SELECT * FROM advisors WHERE id = ?").get(advisorId);
  const body = generateContractBody({
    sme,
    advisor,
    area,
    durationMonths: months,
    retainer: retainer || advisor.retainer,
    bonusPercent: bonus || advisor.bonus_percent,
    kpis,
  });
  return db
    .prepare(
      `INSERT INTO contracts (sme_id, advisor_id, area, status, duration_months, months_elapsed, retainer, bonus_percent, kpis, start_date, end_date, signed_sme, signed_advisor, milestones_completed, milestones_total, next_milestone, contract_body, guarantee_fund)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, ?, ?, ?)`
    )
    .run(
      smeId,
      advisorId,
      area,
      status,
      months,
      elapsed,
      retainer || advisor.retainer,
      bonus || advisor.bonus_percent,
      kpis,
      body.startDate,
      body.endDate,
      signedSme ? 1 : 0,
      signedAdvisor ? 1 : 0,
      Math.min(elapsed, 4),
      milestone || "Diagnóstico Inicial",
      JSON.stringify(body),
      status === "activo" ? Math.round((retainer || advisor.retainer) * 0.1 * elapsed) : 0
    ).lastInsertRowid;
}

function insertConversation(db, smeId, advisorId, contractId, projectName, messages) {
  const convId = db
    .prepare(
      "INSERT INTO conversations (sme_id, advisor_id, contract_id, project_name) VALUES (?, ?, ?, ?)"
    )
    .run(smeId, advisorId, contractId, projectName).lastInsertRowid;

  const insertMsg = db.prepare(`
    INSERT INTO messages (conversation_id, sender_role, sender_id, body, created_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))
  `);

  for (const m of messages) {
    insertMsg.run(convId, m.role, m.role === "pyme" ? smeId : advisorId, m.body, m.offset);
  }
  return convId;
}

function seedAll(db) {
  const insertPyme = db.prepare(`
    INSERT INTO pymes (business_name, rfc, industry, size, employees, email, phone, city, annual_revenue, areas, objectives, timeline, primary_area)
    VALUES (@business_name, @rfc, @industry, @size, @employees, @email, @phone, @city, @annual_revenue, @areas, @objectives, @timeline, @primary_area)
  `);

  const pymes = [
    { business_name: "Retail Fashion MX", rfc: "RFM900101ABC", industry: "Retail / Comercio", size: "11 – 50 empleados", employees: 45, email: "contacto@retailfashion.mx", phone: "+52 55 1234 5678", city: "CDMX", annual_revenue: "$2M - $5M MXN", areas: JSON.stringify(["Marketing Digital", "Optimización de Ventas"]), objectives: "Incrementar ventas online 50% en 6 meses.", timeline: "3 – 6 meses", primary_area: "Marketing Digital" },
    { business_name: "Distribuidora Norte", rfc: "DN850202XYZ", industry: "Manufactura", size: "51 – 200 empleados", employees: 120, email: "ops@distribuidoranorte.mx", phone: "+52 81 5555 1234", city: "Monterrey", annual_revenue: "$10M+ MXN", areas: JSON.stringify(["Eficiencia Operacional", "Logística y Cadena de Suministro"]), objectives: "Reducir costos operativos del 35% al 25%.", timeline: "6 – 9 meses", primary_area: "Eficiencia Operacional" },
    { business_name: "Tech Solutions SA", rfc: "TSS920303DEF", industry: "Tecnología", size: "11 – 50 empleados", employees: 30, email: "ceo@techsolutions.mx", phone: "+52 81 4444 9999", city: "Monterrey", annual_revenue: "$1M - $2M MXN", areas: JSON.stringify(["Transformación Digital"]), objectives: "Modernizar CRM y procesos en 6 meses.", timeline: "3 – 6 meses", primary_area: "Transformación Digital" },
    { business_name: "Constructora JML", rfc: "CJL880404GHI", industry: "Construcción", size: "51 – 200 empleados", employees: 80, email: "dir@constructorajml.mx", phone: "+52 55 8888 7777", city: "CDMX", annual_revenue: "$5M - $10M MXN", areas: JSON.stringify(["Estrategia de Expansión"]), objectives: "Expansión regional con KPIs de ingresos.", timeline: "9 – 12 meses", primary_area: "Estrategia de Expansión" },
    { business_name: "Café Origen", rfc: "COR910505JKL", industry: "Alimentación", size: "1 – 10 empleados", employees: 8, email: "hola@cafeorigen.mx", phone: "+52 33 2222 3333", city: "Guadalajara", annual_revenue: "$500K - $1M MXN", areas: JSON.stringify(["Marketing Digital", "Optimización de Ventas"]), objectives: "Duplicar pedidos delivery en 4 meses.", timeline: "3 – 6 meses", primary_area: "Marketing Digital" },
    { business_name: "Logística Express Bajío", rfc: "LEB870606MNO", industry: "Servicios", size: "11 – 50 empleados", employees: 55, email: "ops@logexpress.mx", phone: "+52 477 555 1212", city: "León", annual_revenue: "$3M - $5M MXN", areas: JSON.stringify(["Logística y Cadena de Suministro", "Eficiencia Operacional"]), objectives: "Reducir tiempos de entrega 30%.", timeline: "6 – 9 meses", primary_area: "Logística y Cadena de Suministro" },
    { business_name: "Clínica Salud Integral", rfc: "CSI940707PQR", industry: "Salud", size: "11 – 50 empleados", employees: 28, email: "admin@saludintegral.mx", phone: "+52 55 7777 8888", city: "CDMX", annual_revenue: "$2M - $3M MXN", areas: JSON.stringify(["Recursos Humanos", "Gestión Financiera"]), objectives: "Optimizar nómina y flujo de caja.", timeline: "3 – 6 meses", primary_area: "Gestión Financiera" },
    { business_name: "Moda Urbana Studio", rfc: "MUS960808STU", industry: "Retail / Comercio", size: "1 – 10 empleados", employees: 12, email: "studio@modaurbana.mx", phone: "+52 55 3333 4444", city: "CDMX", annual_revenue: "$800K - $1.5M MXN", areas: JSON.stringify(["Marketing Digital", "Transformación Digital"]), objectives: "Lanzar tienda online y redes con ROI positivo.", timeline: "3 – 6 meses", primary_area: "Marketing Digital" },
  ];
  for (const p of pymes) insertPyme.run(p);

  const insertAdvisor = db.prepare(`
    INSERT INTO advisors (name, email, phone, location, years_experience, specialization, industries, company_sizes, retainer, bonus_percent, projects_completed, portfolio, methodology, bio)
    VALUES (@name, @email, @phone, @location, @years_experience, @specialization, @industries, @company_sizes, @retainer, @bonus_percent, @projects_completed, @portfolio, @methodology, @bio)
  `);

  const advisors = [
    { name: "María González", email: "maria@asesora.mx", phone: "+52 55 1111 2222", location: "CDMX", years_experience: 12, specialization: "Marketing Digital", industries: JSON.stringify(["Retail / Comercio", "Servicios"]), company_sizes: JSON.stringify(["11 – 50 empleados", "1 – 10 empleados"]), retainer: 38000, bonus_percent: 15, projects_completed: 18, portfolio: "+42% ventas promedio en retail.", methodology: "Diagnóstico → Estrategia → Implementación → Medición.", bio: "Ecommerce y paid media para retail." },
    { name: "Jorge Méndez", email: "jorge@leanops.mx", phone: "+52 81 3333 4444", location: "Monterrey", years_experience: 14, specialization: "Eficiencia Operacional", industries: JSON.stringify(["Manufactura", "Logística"]), company_sizes: JSON.stringify(["51 – 200 empleados", "11 – 50 empleados"]), retainer: 48000, bonus_percent: 18, projects_completed: 24, portfolio: "Lean Manufacturing, -32% costos.", methodology: "Lean por fases con KPIs operativos.", bio: "Consultor Lean manufactura." },
    { name: "Carlos Ruiz", email: "carlos@digital.mx", phone: "+52 55 5555 6666", location: "CDMX", years_experience: 9, specialization: "Transformación Digital", industries: JSON.stringify(["Retail / Comercio", "Tecnología"]), company_sizes: JSON.stringify(["11 – 50 empleados"]), retainer: 42000, bonus_percent: 15, projects_completed: 12, portfolio: "12 implementaciones ERP/CRM.", methodology: "4 fases con KPIs medibles.", bio: "Transformación digital PYMEs." },
    { name: "Ana Herrera", email: "ana@finanzas.mx", phone: "+52 33 7777 8888", location: "Guadalajara", years_experience: 11, specialization: "Gestión Financiera", industries: JSON.stringify(["Retail / Comercio", "Servicios", "Salud"]), company_sizes: JSON.stringify(["11 – 50 empleados", "51 – 200 empleados"]), retainer: 36000, bonus_percent: 12, projects_completed: 15, portfolio: "Reestructura, -22% a -31% costos.", methodology: "Diagnóstico financiero → Control.", bio: "Optimización financiera PYMEs." },
    { name: "Laura Vega", email: "laura@ventas.mx", phone: "+52 55 9999 0000", location: "CDMX", years_experience: 8, specialization: "Optimización de Ventas", industries: JSON.stringify(["Tecnología", "Servicios"]), company_sizes: JSON.stringify(["11 – 50 empleados"]), retainer: 35000, bonus_percent: 14, projects_completed: 10, portfolio: "Pipeline B2B, +35% cierre.", methodology: "Sales playbook 5-7 meses.", bio: "Ventas B2B para tech." },
    { name: "Roberto Sánchez", email: "roberto@logistica.mx", phone: "+52 477 1111 2222", location: "León", years_experience: 13, specialization: "Logística y Cadena de Suministro", industries: JSON.stringify(["Manufactura", "Servicios"]), company_sizes: JSON.stringify(["11 – 50 empleados", "51 – 200 empleados"]), retainer: 44000, bonus_percent: 16, projects_completed: 20, portfolio: "-28% tiempos de entrega promedio.", methodology: "Mapeo → Optimización → Control.", bio: "Cadena de suministro regional." },
    { name: "Patricia Morales", email: "patricia@rh.mx", phone: "+52 55 4444 5555", location: "CDMX", years_experience: 10, specialization: "Recursos Humanos", industries: JSON.stringify(["Salud", "Servicios", "Retail / Comercio"]), company_sizes: JSON.stringify(["11 – 50 empleados"]), retainer: 32000, bonus_percent: 10, projects_completed: 14, portfolio: "Estructuras ágiles, -18% rotación.", methodology: "Diagnóstico cultural → Implementación.", bio: "RH estratégico para PYMEs." },
    { name: "Diego Fernández", email: "diego@expansion.mx", phone: "+52 55 6666 7777", location: "CDMX", years_experience: 15, specialization: "Estrategia de Expansión", industries: JSON.stringify(["Construcción", "Retail / Comercio"]), company_sizes: JSON.stringify(["51 – 200 empleados", "11 – 50 empleados"]), retainer: 52000, bonus_percent: 20, projects_completed: 22, portfolio: "3 expansiones regionales exitosas.", methodology: "Análisis → Plan → Ejecución.", bio: "Expansión y crecimiento regional." },
  ];
  for (const a of advisors) insertAdvisor.run(a);

  const insertApp = db.prepare(`
    INSERT INTO applications (sme_id, advisor_id, message, status, match_score, created_at)
    VALUES (@sme_id, @advisor_id, @message, @status, @match_score, datetime('now', @created_at))
  `);

  const appPairs = [
    [1, 3, "He implementado soluciones digitales para 12 retailers en CDMX.", "pending", "-1 day"],
    [1, 4, "Especializada en reestructura financiera para retail.", "pending", "-3 days"],
    [1, 5, "Puedo ayudarles a escalar el canal B2B este trimestre.", "pending", "-2 days"],
    [2, 2, "Último proyecto Lean redujo costos 32% en manufactura similar.", "pending", "-1 day"],
    [3, 3, "Modernicé el stack de 4 PYMEs tech en Monterrey.", "pending", "-4 hours"],
    [3, 5, "Mi playbook de ventas encaja con su etapa de crecimiento.", "accepted", "-5 days"],
    [4, 8, "Lideré expansión de constructora mediana en el Bajío.", "pending", "-2 days"],
    [5, 1, "Trabajé con 3 cafeterías: +60% pedidos delivery.", "pending", "-6 hours"],
    [6, 6, "Reduje lead times 28% en operador logístico similar.", "pending", "-1 day"],
    [7, 4, "Reestructuré finanzas de 2 clínicas en CDMX.", "pending", "-2 days"],
    [7, 7, "Bajé rotación 18% en equipo de salud de 30 personas.", "pending", "-3 days"],
    [8, 1, "Lancé ecommerce para 5 marcas de moda emergente.", "pending", "-12 hours"],
    [8, 3, "Integración Shopify + CRM en 8 semanas.", "pending", "-1 day"],
    [1, 5, "Puedo apoyar con playbook comercial para retail.", "pending", "-2 days"],
    [4, 1, "Experiencia en retail y construcción para plan de marketing.", "pending", "-1 day"],
    [3, 1, "He digitalizado funnels de venta B2B en tech.", "accepted", "-4 days"],
    [2, 1, "Apoyo en campaña de posicionamiento para manufactura.", "rejected", "-10 days"],
    [5, 2, "Lean aplicado a operaciones de cafeterías.", "pending", "-1 day"],
    [6, 2, "Reduje inventario 20% en distribuidoras similares.", "pending", "-2 days"],
    [7, 3, "Automatización de facturación y CRM en salud.", "pending", "-1 day"],
    [1, 3, "Implementación CRM y analytics para retail.", "pending", "-3 days"],
    [2, 6, "Optimización de rutas en zona norte.", "accepted", "-6 days"],
    [4, 8, "Plan de expansión a 3 ciudades en 12 meses.", "pending", "-2 days"],
  ];

  for (const [smeId, advId, msg, status, offset] of appPairs) {
    const sme = db.prepare("SELECT * FROM pymes WHERE id = ?").get(smeId);
    const adv = db.prepare("SELECT * FROM advisors WHERE id = ?").get(advId);
    if (!sme || !adv) {
      throw new Error(`Seed: PYME ${smeId} o asesor ${advId} no encontrado`);
    }
    insertApp.run({ sme_id: smeId, advisor_id: advId, message: msg, status, match_score: calculateMatch(sme, adv).score, created_at: offset });
  }

  // Contratos
  const c1 = insertContract(db, { smeId: 1, advisorId: 1, area: "Marketing Digital", status: "activo", months: 6, elapsed: 2, signedSme: 1, signedAdvisor: 1, milestone: "Reporte Q2", kpis: "Ventas +45%, CAC -25%" });
  insertContract(db, { smeId: 1, advisorId: 2, area: "Eficiencia Operacional", status: "pendiente", months: 8, elapsed: 0, signedSme: 0, signedAdvisor: 1, milestone: "Firma PYME", kpis: "Costos ≤ 26%" });
  insertContract(db, { smeId: 2, advisorId: 2, area: "Eficiencia Operacional", status: "activo", months: 8, elapsed: 4, signedSme: 1, signedAdvisor: 1, milestone: "Capacitación Equipo", kpis: "Costos ≤ 25%" });
  insertContract(db, { smeId: 3, advisorId: 3, area: "Transformación Digital", status: "activo", months: 6, elapsed: 1, signedSme: 1, signedAdvisor: 1, milestone: "Diagnóstico CRM", kpis: "CRM adoptado 80%" });
  insertContract(db, { smeId: 4, advisorId: 8, area: "Estrategia de Expansión", status: "pendiente", months: 12, elapsed: 0, signedSme: 1, signedAdvisor: 0, milestone: "Firma Asesor", kpis: "2 nuevas regiones" });
  insertContract(db, { smeId: 5, advisorId: 1, area: "Marketing Digital", status: "activo", months: 6, elapsed: 3, signedSme: 1, signedAdvisor: 1, milestone: "Campaña Meta Ads", kpis: "Delivery +50%" });
  insertContract(db, { smeId: 6, advisorId: 6, area: "Logística y Cadena de Suministro", status: "activo", months: 9, elapsed: 2, signedSme: 1, signedAdvisor: 1, milestone: "Mapa de rutas", kpis: "Entrega -30%" });
  insertContract(db, { smeId: 1, advisorId: 1, area: "Marketing Digital", status: "completado", months: 6, elapsed: 6, signedSme: 1, signedAdvisor: 1, milestone: "Cierre", kpis: "Piloto +40% ventas", retainer: 35000, bonus: 12 });
  insertContract(db, { smeId: 7, advisorId: 4, area: "Gestión Financiera", status: "completado", months: 6, elapsed: 6, signedSme: 1, signedAdvisor: 1, milestone: "Cierre", kpis: "Flujo de caja +20%" });
  const cMariaSign = insertContract(db, { smeId: 8, advisorId: 1, area: "Marketing Digital", status: "pendiente", months: 6, elapsed: 0, signedSme: 1, signedAdvisor: 0, milestone: "Firma Asesor", kpis: "Tienda online +30% tráfico" });
  insertContract(db, { smeId: 3, advisorId: 1, area: "Marketing Digital", status: "activo", months: 6, elapsed: 1, signedSme: 1, signedAdvisor: 1, milestone: "Estrategia de contenido", kpis: "Leads +35%" });
  insertContract(db, { smeId: 2, advisorId: 1, area: "Optimización de Ventas", status: "activo", months: 6, elapsed: 3, signedSme: 1, signedAdvisor: 1, milestone: "Pipeline Q2", kpis: "Cierre +25%" });
  insertContract(db, { smeId: 7, advisorId: 7, area: "Recursos Humanos", status: "activo", months: 6, elapsed: 2, signedSme: 1, signedAdvisor: 1, milestone: "Evaluación desempeño", kpis: "Rotación -15%" });
  insertContract(db, { smeId: 4, advisorId: 2, area: "Eficiencia Operacional", status: "pendiente", months: 9, elapsed: 0, signedSme: 1, signedAdvisor: 0, milestone: "Firma Asesor", kpis: "Costos -20%" });
  insertContract(db, { smeId: 1, advisorId: 3, area: "Transformación Digital", status: "pendiente", months: 6, elapsed: 0, signedSme: 0, signedAdvisor: 1, milestone: "Firma PYME", kpis: "Automatización ventas" });
  insertContract(db, { smeId: 6, advisorId: 2, area: "Eficiencia Operacional", status: "completado", months: 8, elapsed: 8, signedSme: 1, signedAdvisor: 1, milestone: "Cierre", kpis: "Lead time -28%" });
  insertContract(db, { smeId: 5, advisorId: 5, area: "Optimización de Ventas", status: "activo", months: 6, elapsed: 2, signedSme: 1, signedAdvisor: 1, milestone: "CRM ventas", kpis: "Conversión +20%" });

  // Conversaciones con historial
  insertConversation(db, 1, 1, c1, "Marketing Digital — Retail Fashion MX", [
    { role: "advisor", body: "Buenos días. Revisé el funnel y los números de esta semana se ven muy bien.", offset: "-2 days" },
    { role: "pyme", body: "¡Qué buena noticia! ¿Puedes compartirme un resumen antes de la reunión de mañana?", offset: "-2 days" },
    { role: "advisor", body: "Claro, te mando el reporte. Las ventas subieron 18% vs la semana anterior.", offset: "-1 days" },
    { role: "pyme", body: "Excelente. ¿El reporte del Q2 completo para cuándo lo tenemos?", offset: "-1 days" },
    { role: "advisor", body: "El viernes estará listo, con análisis por canal y proyecciones para el mes 3.", offset: "-20 hours" },
    { role: "pyme", body: "Perfecto, agendemos revisión el viernes a las 10am.", offset: "-18 hours" },
    { role: "advisor", body: "Listo, invitación enviada. Cualquier duda me escribes por aquí.", offset: "-2 hours" },
  ]);

  insertConversation(db, 1, 2, 2, "Ops. Eficiencia — Retail Fashion MX", [
    { role: "advisor", body: "Hola, ya tengo el borrador del contrato de eficiencia operacional.", offset: "-3 days" },
    { role: "pyme", body: "Gracias Jorge. Lo revisamos esta semana para firmar.", offset: "-2 days" },
    { role: "advisor", body: "Quedo atento. El diagnóstico inicial tomaría 3 semanas post-firma.", offset: "-1 days" },
  ]);

  insertConversation(db, 2, 2, 3, "Eficiencia Operacional — Distribuidora Norte", [
    { role: "advisor", body: "Adjunté el análisis de la semana 4 del proyecto Lean.", offset: "-1 days" },
    { role: "pyme", body: "Recibido. El equipo de planta ya está aplicando las recomendaciones.", offset: "-20 hours" },
    { role: "advisor", body: "Excelente avance. Próximo hito: capacitación del equipo operativo.", offset: "-5 hours" },
    { role: "pyme", body: "¿Podemos agendar la capacitación para el martes?", offset: "-3 hours" },
    { role: "advisor", body: "Sí, preparo la agenda y material hoy.", offset: "-1 hours" },
  ]);

  insertConversation(db, 3, 3, 4, "Transformación Digital — Tech Solutions", [
    { role: "pyme", body: "¿Tienen estimado de cuándo queda integrado el CRM?", offset: "-2 days" },
    { role: "advisor", body: "Fase 1 termina en 10 días. Les comparto el checklist mañana.", offset: "-1 days" },
    { role: "pyme", body: "Perfecto, necesitamos acceso para el equipo de ventas.", offset: "-8 hours" },
  ]);

  insertConversation(db, 5, 1, 6, "Marketing Digital — Café Origen", [
    { role: "advisor", body: "La campaña de delivery ya tiene ROAS positivo en la zona centro.", offset: "-1 days" },
    { role: "pyme", body: "¡Genial! ¿Subimos presupuesto para la siguiente semana?", offset: "-12 hours" },
    { role: "advisor", body: "Recomiendo +15% en Meta y probar creativos nuevos.", offset: "-6 hours" },
  ]);

  insertConversation(db, 6, 6, 7, "Logística — Express Bajío", [
    { role: "advisor", body: "El mapa de rutas optimizado reduce 22% km recorridos.", offset: "-2 days" },
    { role: "pyme", body: "Impresionante. ¿Cuándo piloteamos en ruta norte?", offset: "-1 days" },
    { role: "advisor", body: "Propongo piloto el lunes con 3 unidades.", offset: "-4 hours" },
  ]);

  insertConversation(db, 8, 1, cMariaSign, "Marketing Digital — Moda Urbana Studio", [
    { role: "pyme", body: "Hola María, nos interesa tu perfil para lanzar tienda online.", offset: "-2 days" },
    { role: "advisor", body: "Con gusto. ¿Ya tienen catálogo y fotos de producto listas?", offset: "-1 days" },
    { role: "pyme", body: "Sí, tenemos 120 SKUs documentados.", offset: "-10 hours" },
    { role: "advisor", body: "Perfecto. El contrato está listo para tu firma cuando quieran avanzar.", offset: "-5 hours" },
  ]);

  insertConversation(db, 3, 1, null, "Marketing — Tech Solutions", [
    { role: "advisor", body: "Hola, revisé sus objetivos de leads B2B.", offset: "-1 days" },
    { role: "pyme", body: "Gracias María, ¿cuándo podemos tener la propuesta de contenido?", offset: "-12 hours" },
  ]);

  insertConversation(db, 2, 1, null, "Ventas — Distribuidora Norte", [
    { role: "advisor", body: "Pipeline actualizado con 12 oportunidades calificadas.", offset: "-2 days" },
    { role: "pyme", body: "Excelente, compártelo en la junta del jueves.", offset: "-1 days" },
  ]);

  insertConversation(db, 5, 2, null, "Ops — Café Origen", [
    { role: "advisor", body: "Diagnóstico Lean de cocina y punto de venta listo.", offset: "-1 days" },
    { role: "pyme", body: "¿Podemos priorizar turno matutino?", offset: "-8 hours" },
  ]);

  insertConversation(db, 7, 4, null, "Finanzas — Clínica Salud", [
    { role: "advisor", body: "Flujo de caja proyectado a 90 días adjunto.", offset: "-3 days" },
    { role: "pyme", body: "Lo revisa el director general esta semana.", offset: "-2 days" },
  ]);

  // ── Contratos adicionales ─────────────────────────────────────────────────
  // Patricia (7) — historial completado con Clínica Salud
  insertContract(db, { smeId: 7, advisorId: 7, area: "Recursos Humanos", status: "completado", months: 6, elapsed: 6, signedSme: 1, signedAdvisor: 1, milestone: "Cierre", kpis: "Rotación -18%, estructura HR rediseñada" });

  // Diego (8) — contrato activo con Constructora JML
  const c19 = insertContract(db, { smeId: 4, advisorId: 8, area: "Estrategia de Expansión", status: "activo", months: 12, elapsed: 5, signedSme: 1, signedAdvisor: 1, milestone: "Plan de mercado zona norte", kpis: "2 nuevas regiones, ingresos +40%" });

  // Roberto (6) — contrato activo con Distribuidora Norte
  const c20 = insertContract(db, { smeId: 2, advisorId: 6, area: "Logística y Cadena de Suministro", status: "activo", months: 9, elapsed: 6, signedSme: 1, signedAdvisor: 1, milestone: "Implementación rutas inteligentes", kpis: "Lead time -30%, costo flete -15%" });

  // Ana (4) — contrato completado con Café Origen
  insertContract(db, { smeId: 5, advisorId: 4, area: "Gestión Financiera", status: "completado", months: 6, elapsed: 6, signedSme: 1, signedAdvisor: 1, milestone: "Cierre", kpis: "Flujo de caja positivo, margen +8%", retainer: 34000, bonus: 10 });

  // Carlos (3) — contrato activo con Moda Urbana Studio
  const c22 = insertContract(db, { smeId: 8, advisorId: 3, area: "Transformación Digital", status: "activo", months: 6, elapsed: 2, signedSme: 1, signedAdvisor: 1, milestone: "Configuración Shopify + CRM", kpis: "Tienda online activa, conversión 3%" });

  // Patricia (7) — pendiente con Retail Fashion MX
  const c23 = insertContract(db, { smeId: 1, advisorId: 7, area: "Recursos Humanos", status: "pendiente", months: 6, elapsed: 0, signedSme: 0, signedAdvisor: 1, milestone: "Firma PYME", kpis: "Rotación -10%, proceso de onboarding ágil" });

  // Ana (4) — activo con Logística Express Bajío
  const c24 = insertContract(db, { smeId: 6, advisorId: 4, area: "Gestión Financiera", status: "activo", months: 6, elapsed: 3, signedSme: 1, signedAdvisor: 1, milestone: "Control de costos operativos", kpis: "Margen neto +5%, deuda -20%" });

  // Laura (5) — activo con Tech Solutions
  const c25 = insertContract(db, { smeId: 3, advisorId: 5, area: "Optimización de Ventas", status: "activo", months: 6, elapsed: 4, signedSme: 1, signedAdvisor: 1, milestone: "Cierre de pipeline Q3", kpis: "Cierre +35%, ciclo de venta -20%" });

  // Roberto (6) — pendiente con Constructora JML
  insertContract(db, { smeId: 4, advisorId: 6, area: "Logística y Cadena de Suministro", status: "pendiente", months: 9, elapsed: 0, signedSme: 1, signedAdvisor: 0, milestone: "Firma Asesor", kpis: "Rutas de obra optimizadas, -25% costos" });

  // Jorge (2) — completado con Café Origen (Lean aplicado)
  insertContract(db, { smeId: 5, advisorId: 2, area: "Eficiencia Operacional", status: "completado", months: 4, elapsed: 4, signedSme: 1, signedAdvisor: 1, milestone: "Cierre", kpis: "Merma -22%, productividad cocina +30%", retainer: 40000, bonus: 14 });

  // Diego (8) — completado con Retail Fashion MX
  insertContract(db, { smeId: 1, advisorId: 8, area: "Estrategia de Expansión", status: "completado", months: 9, elapsed: 9, signedSme: 1, signedAdvisor: 1, milestone: "Cierre", kpis: "Apertura 2 tiendas, ingresos +35%", retainer: 50000, bonus: 18 });

  // ── Aplicaciones adicionales ──────────────────────────────────────────────
  const moreAppPairs = [
    [4, 4, "Asesoría financiera para optimizar capital de trabajo en proyectos de construcción.", "pending", "-1 day"],
    [4, 6, "Optimización de flota y logística de materiales para obra civil.", "pending", "-3 days"],
    [6, 4, "Diagnóstico financiero para empresa logística en proceso de expansión.", "pending", "-2 days"],
    [8, 7, "Estructura y políticas de RH para equipo creativo en crecimiento.", "pending", "-1 day"],
    [5, 3, "Digitalización de punto de venta y sistema de pedidos online para cafetería.", "accepted", "-7 days"],
    [3, 8, "Estrategia de expansión a LATAM para empresa tech.", "pending", "-2 days"],
    [1, 8, "Plan de expansión con nuevas sucursales retail en zona metropolitana.", "pending", "-4 days"],
    [2, 4, "Control financiero y planificación de flujo de caja para manufactura.", "accepted", "-8 days"],
    [7, 5, "Optimización del embudo de ventas para servicios de salud.", "pending", "-1 day"],
    [8, 4, "Reestructura financiera para PYME de moda en etapa de escala.", "pending", "-2 days"],
  ];

  for (const [smeId, advId, msg, status, offset] of moreAppPairs) {
    const sme = db.prepare("SELECT * FROM pymes WHERE id = ?").get(smeId);
    const adv = db.prepare("SELECT * FROM advisors WHERE id = ?").get(advId);
    if (!sme || !adv) throw new Error(`Seed extra apps: PYME ${smeId} o asesor ${advId} no encontrado`);
    insertApp.run({ sme_id: smeId, advisor_id: advId, message: msg, status, match_score: calculateMatch(sme, adv).score, created_at: offset });
  }

  // ── Conversaciones adicionales ────────────────────────────────────────────
  // Diego (8) + Constructora JML — expansión activa
  insertConversation(db, 4, 8, c19, "Expansión Regional — Constructora JML", [
    { role: "advisor", body: "Hola, terminé el análisis de mercado para la zona norte. Hay 3 ciudades con demanda de obra habitacional alta.", offset: "-5 days" },
    { role: "pyme", body: "Muy bien Diego. ¿Cuáles son las ciudades?", offset: "-5 days" },
    { role: "advisor", body: "Querétaro, San Luis Potosí y Pachuca. Les comparto el estudio completo hoy.", offset: "-4 days" },
    { role: "pyme", body: "Recibido. El consejo directivo lo revisará el jueves.", offset: "-3 days" },
    { role: "advisor", body: "Perfecto. Mientras tanto avancé el plan de apertura para Querétaro: cronograma, inversión estimada y perfil de socios locales.", offset: "-2 days" },
    { role: "pyme", body: "Excelente trabajo. ¿Puedes estar en la junta del jueves para presentar?", offset: "-1 days" },
    { role: "advisor", body: "Confirmado. Preparo un deck ejecutivo de 10 slides.", offset: "-20 hours" },
    { role: "pyme", body: "Gracias. El consejo quiere ver ROI proyectado a 3 años.", offset: "-10 hours" },
    { role: "advisor", body: "Lo incluyo. Les adelanto: ROI estimado entre 28% y 34% en el escenario base.", offset: "-4 hours" },
  ]);

  // Roberto (6) + Distribuidora Norte — logística activa avanzada
  insertConversation(db, 2, 6, c20, "Logística — Distribuidora Norte", [
    { role: "advisor", body: "Buenos días. El sistema de ruteo inteligente ya está corriendo en producción con 18 rutas activas.", offset: "-6 days" },
    { role: "pyme", body: "Excelente Roberto. ¿Los tiempos de entrega ya muestran mejora?", offset: "-5 days" },
    { role: "advisor", body: "Sí. Semana 1 post-implementación: -19% en tiempo promedio por ruta. Vamos bien.", offset: "-4 days" },
    { role: "pyme", body: "Impresionante. ¿Cuándo cerramos el mes con datos completos?", offset: "-3 days" },
    { role: "advisor", body: "El reporte mensual lo cierro el viernes. Voy proyectando -27% al cierre del mes.", offset: "-2 days" },
    { role: "pyme", body: "Si llegamos al -27% superamos la meta del contrato. El equipo está motivado.", offset: "-1 days" },
    { role: "advisor", body: "Hay margen para llegar a -30% si activamos las rutas nocturnas que propuse en semana 3.", offset: "-18 hours" },
    { role: "pyme", body: "Autorizado. Actívalas a partir del lunes.", offset: "-8 hours" },
    { role: "advisor", body: "Perfecto, coordino con el jefe de flotilla hoy mismo.", offset: "-2 hours" },
  ]);

  // Carlos (3) + Moda Urbana Studio — transformación digital
  insertConversation(db, 8, 3, c22, "Transformación Digital — Moda Urbana Studio", [
    { role: "pyme", body: "Hola Carlos, ¿cómo vamos con la integración de Shopify y el CRM?", offset: "-4 days" },
    { role: "advisor", body: "La tienda está al 85%. Faltan 2 cosas: pasarela de pago y catálogo fotográfico.", offset: "-3 days" },
    { role: "pyme", body: "Las fotos las tenemos listas, ¿cómo te las enviamos?", offset: "-3 days" },
    { role: "advisor", body: "Súbanlas a este Google Drive compartido y yo las proceso para web.", offset: "-2 days" },
    { role: "pyme", body: "Listo, ya subimos 120 SKUs con sus fichas técnicas.", offset: "-1 days" },
    { role: "advisor", body: "Las recibí, gracias. Comienzo la carga hoy. La tienda puede quedar live el jueves.", offset: "-20 hours" },
    { role: "pyme", body: "¡Qué emoción! ¿Ya podemos empezar a poner el link en redes?", offset: "-10 hours" },
    { role: "advisor", body: "Esperen a que hagamos pruebas de pago primero. Hacemos un test mañana y si todo bien, publican el jueves.", offset: "-5 hours" },
    { role: "pyme", body: "Perfecto. Tenemos influencers en stand-by para el lanzamiento.", offset: "-2 hours" },
    { role: "advisor", body: "Entonces coordinamos para lanzar el jueves a las 10am. Máxima exposición.", offset: "-30 minutes" },
  ]);

  // Ana (4) + Logística Express Bajío — finanzas activa
  insertConversation(db, 6, 4, c24, "Gestión Financiera — Logística Express Bajío", [
    { role: "advisor", body: "Revisé los estados financieros del Q1. Tienen un capital de trabajo negativo de $180K MXN que hay que resolver.", offset: "-7 days" },
    { role: "pyme", body: "Lo sabíamos Ana. Por eso nos costaba tanto el crecimiento.", offset: "-6 days" },
    { role: "advisor", body: "El problema principal es el ciclo de cobranza: 60 días promedio vs 30 días en proveedores. Hay que reducirlo a 35 días.", offset: "-5 days" },
    { role: "pyme", body: "¿Cómo lo hacemos sin perder clientes?", offset: "-4 days" },
    { role: "advisor", body: "Con política de descuento por pronto pago (2/10 net 35) y facturación electrónica inmediata al entregable.", offset: "-3 days" },
    { role: "pyme", body: "Tiene sentido. ¿Puedes hacer la propuesta para presentar al equipo comercial?", offset: "-2 days" },
    { role: "advisor", body: "La presento el miércoles. También incluyo la reestructura de línea de crédito con BBVA que revisé.", offset: "-1 days" },
    { role: "pyme", body: "Perfecto. El director financiero confirma que puede el miércoles a las 11am.", offset: "-12 hours" },
    { role: "advisor", body: "Confirmado. Les adelanto: con estas medidas podemos liberar $120K de capital en 45 días.", offset: "-4 hours" },
  ]);

  // Laura (5) + Tech Solutions — ventas avanzada
  insertConversation(db, 3, 5, c25, "Optimización de Ventas — Tech Solutions", [
    { role: "advisor", body: "El pipeline B2B ya tiene 22 oportunidades calificadas con valor estimado de $3.2M MXN.", offset: "-8 days" },
    { role: "pyme", body: "Laura, eso es increíble. El mes pasado teníamos solo 8.", offset: "-7 days" },
    { role: "advisor", body: "El playbook de prospección está funcionando. El equipo de ventas ya lo domina.", offset: "-6 days" },
    { role: "pyme", body: "¿Cuántas de esas 22 podríamos cerrar este trimestre?", offset: "-5 days" },
    { role: "advisor", body: "Con ciclo de 45 días promedio, realista son 8-10 cierres en Q3. Eso representa $1.1M - $1.4M.", offset: "-4 days" },
    { role: "pyme", body: "Si cerramos eso superamos el KPI del contrato. ¿Qué necesitamos?", offset: "-3 days" },
    { role: "advisor", body: "Demos técnicos más rápidos. Hoy tardan 3 semanas en agendarse; necesitamos reducirlo a 5 días.", offset: "-2 days" },
    { role: "pyme", body: "Hablo hoy con el CTO para liberar a 2 ingenieros de soluciones para eso.", offset: "-1 days" },
    { role: "advisor", body: "Perfecto. Con eso el embudo fluye mucho mejor. Actualizo el forecast esta semana.", offset: "-20 hours" },
    { role: "pyme", body: "Excelente. ¿Podemos ver el forecast en la call del viernes?", offset: "-8 hours" },
    { role: "advisor", body: "Claro, lo llevo con escenario pesimista, base y optimista.", offset: "-3 hours" },
  ]);

  // Patricia (7) + Clínica Salud Integral — RH activo (contract 13)
  insertConversation(db, 7, 7, 13, "Recursos Humanos — Clínica Salud Integral", [
    { role: "advisor", body: "Hola, terminé la evaluación de clima organizacional. Participaron 26 de 28 colaboradores.", offset: "-9 days" },
    { role: "pyme", body: "Muy bien Patricia. ¿Qué encontraste?", offset: "-8 days" },
    { role: "advisor", body: "Tres áreas de mejora prioritarias: comunicación interna, reconocimiento y carga de trabajo en enfermería.", offset: "-7 days" },
    { role: "pyme", body: "La carga de enfermería ya la teníamos en el radar. ¿Qué propones?", offset: "-6 days" },
    { role: "advisor", body: "Redistribuir turnos con un modelo 4x3, incorporar 2 enfermeras eventuales y crear un sistema de guardias voluntarias con incentivo económico.", offset: "-5 days" },
    { role: "pyme", body: "El modelo 4x3 suena bien. ¿Cuánto tiempo para implementarlo?", offset: "-4 days" },
    { role: "advisor", body: "6 semanas. Empezaríamos con un piloto en el área de consulta externa.", offset: "-3 days" },
    { role: "pyme", body: "Aprobado. ¿Puedes coordinar directamente con la jefa de enfermería?", offset: "-2 days" },
    { role: "advisor", body: "Perfecto. La cito esta semana. También presento el plan completo a gerencia el próximo lunes.", offset: "-1 days" },
    { role: "pyme", body: "Gracias Patricia. El equipo ya preguntó si habrá cambios, están expectantes.", offset: "-10 hours" },
    { role: "advisor", body: "Les recomiendo comunicarlo como mejora, no como cambio impuesto. Redacto un comunicado interno para que lo revisen.", offset: "-4 hours" },
  ]);

  // Patricia (7) + Retail Fashion MX — pendiente de firma (c23)
  insertConversation(db, 1, 7, c23, "RH — Retail Fashion MX", [
    { role: "advisor", body: "Hola, revisé el organigrama que me compartieron. Hay oportunidades claras en el área de ventas y operaciones.", offset: "-3 days" },
    { role: "pyme", body: "Sí, la rotación en ventas es del 40% anual. Queremos bajarla.", offset: "-2 days" },
    { role: "advisor", body: "Con el programa que propongo podemos llegar a 28% en 4 meses. El contrato ya está listo para tu firma.", offset: "-1 days" },
    { role: "pyme", body: "Lo revisamos con el director esta semana y te confirmamos.", offset: "-12 hours" },
  ]);

  // Jorge (2) + Café Origen — post-proyecto completado
  insertConversation(db, 5, 2, null, "Seguimiento Lean — Café Origen", [
    { role: "pyme", body: "Jorge, desde que terminamos el proyecto la merma bajó a niveles históricos. ¡Muchas gracias!", offset: "-5 days" },
    { role: "advisor", body: "¡Qué gusto! El equipo adoptó muy bien las prácticas. ¿Están midiendo el indicador semanal?", offset: "-4 days" },
    { role: "pyme", body: "Sí, ya lo tenemos en el tablero de cocina. Esta semana cerramos en 4.2% de merma.", offset: "-3 days" },
    { role: "advisor", body: "Excelente, la meta era 5%. ¿Les interesaría extender el proyecto para incluir el nuevo local?", offset: "-2 days" },
    { role: "pyme", body: "Sería ideal. Abrimos el tercer local en septiembre.", offset: "-1 days" },
    { role: "advisor", body: "Perfecto, preparo una propuesta de extensión para el nuevo local.", offset: "-8 hours" },
  ]);

  // Diego (8) — conversación previa con Retail Fashion (sin contrato, aplicación pendiente)
  insertConversation(db, 1, 8, null, "Expansión — Retail Fashion MX", [
    { role: "pyme", body: "Hola Diego, nos interesa tu perfil para abrir tiendas en la zona norte.", offset: "-4 days" },
    { role: "advisor", body: "Con gusto. ¿Ya tienen identificadas las plazas o están en fase de análisis?", offset: "-3 days" },
    { role: "pyme", body: "Tenemos 3 opciones en Monterrey, Tijuana y Guadalajara.", offset: "-2 days" },
    { role: "advisor", body: "Muy bien. En mi experiencia Guadalajara tiene el menor riesgo de entrada para retail de moda. ¿Les envío un brief de diagnóstico?", offset: "-1 days" },
    { role: "pyme", body: "Sí, por favor. ¿En cuánto tiempo lo tendríamos?", offset: "-12 hours" },
    { role: "advisor", body: "Mañana en la mañana. Con eso podemos agendar una llamada de 30 min para alinearnos.", offset: "-6 hours" },
  ]);

  // ── Disputas ──────────────────────────────────────────────────────────────
  const insertDispute = db.prepare(
    "INSERT INTO disputes (contract_id, reported_by, description, status) VALUES (?, ?, ?, ?)"
  );
  // Disputa abierta: PYME reporta entregable incompleto en contrato Lean de Distribuidora Norte
  insertDispute.run(3, "pyme", "El diagnóstico Lean entregado no incluye el análisis de la línea de empaque, que estaba en el alcance original del contrato firmado.", "open");
  // Disputa resuelta: asesor reportó acceso tardío al sistema contable
  insertDispute.run(9, "advisor", "La PYME no proporcionó acceso al sistema contable SAT durante 3 semanas, retrasando el entregable final del diagnóstico financiero.", "resolved");
  // Disputa abierta: PYME de Tech Solutions objeta demora en integración CRM
  insertDispute.run(4, "pyme", "La fase 1 del CRM lleva 15 días de retraso sobre el calendario pactado. Se solicita plan de recuperación.", "open");

  // ── Solicitudes adicionales ───────────────────────────────────────────────
  const insertReq = db.prepare(
    "INSERT INTO additional_requests (contract_id, description, duration, objectives) VALUES (?, ?, ?, ?)"
  );
  // Extensión Lean para segunda planta de Distribuidora Norte
  insertReq.run(3, "Ampliar el proyecto Lean para incluir la planta de Saltillo, replicando el modelo implementado en Monterrey.", "3 meses adicionales", "Reducir costos -28% en planta Saltillo, estandarizar procesos entre ambas plantas.");
  // Expansión de alcance en Café Origen (delivery)
  insertReq.run(6, "Incluir estrategia de fidelización de clientes (programa de puntos) para el canal delivery.", "2 meses adicionales", "Aumentar retención de clientes delivery 20%, incrementar ticket promedio 12%.");
  // Última milla en Logística Express Bajío
  insertReq.run(7, "Agregar análisis de gestión de devoluciones y última milla al alcance actual del proyecto logístico.", "1 mes adicional", "Reducir devoluciones 15%, mejorar NPS logístico de 62 a 75.");
  // RH en Clínica Salud — extensión para segundo ciclo de evaluación
  insertReq.run(13, "Realizar segundo ciclo de evaluación de desempeño y ajuste del programa de reconocimientos tras los primeros 3 meses.", "2 meses adicionales", "Consolidar mejora en clima organizacional, reducir rotación adicional 5%.");
}

function seedIfEmpty(db) {
  const row = db.prepare("SELECT value FROM app_metadata WHERE key = 'seed_version'").get();
  if (row?.value === SEED_VERSION) return false;

  clearDatabase(db);
  seedAll(db);
  db.prepare("INSERT OR REPLACE INTO app_metadata (key, value, updated_at) VALUES ('seed_version', ?, datetime('now'))").run(SEED_VERSION);
  return true;
}

module.exports = { seedIfEmpty, clearDatabase, seedAll, SEED_VERSION };
