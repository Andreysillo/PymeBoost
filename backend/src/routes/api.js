const express = require("express");
const { getDatabase } = require("../config/database");
const { calculateMatch, parseJson, matchVisibility } = require("../lib/matching");
const {
  generateContractBody,
  timelineToMonths,
  temporalProgress,
  netRetainer,
} = require("../lib/contracts");

const router = express.Router();

function getSme(db, id) {
  return db.prepare("SELECT * FROM pymes WHERE id = ?").get(id);
}

function getAdvisor(db, id) {
  return db.prepare("SELECT * FROM advisors WHERE id = ?").get(id);
}

function advisorPublic(row, match) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    location: row.location,
    yearsExperience: row.years_experience,
    specialization: row.specialization,
    industries: parseJson(row.industries),
    retainer: row.retainer,
    bonusPercent: row.bonus_percent,
    projectsCompleted: row.projects_completed,
    portfolio: row.portfolio,
    methodology: row.methodology,
    bio: row.bio,
    matchScore: match?.score,
    matchBreakdown: match?.breakdown,
    matchVisibility: match ? matchVisibility(match.score) : undefined,
  };
}

function contractPublic(row, sme, advisor) {
  const body = row.contract_body ? JSON.parse(row.contract_body) : null;
  const progress = temporalProgress(row.months_elapsed, row.duration_months);
  return {
    id: row.id,
    smeId: row.sme_id,
    advisorId: row.advisor_id,
    smeName: sme?.business_name,
    advisorName: advisor?.name,
    area: row.area,
    status: row.status,
    durationMonths: row.duration_months,
    monthsElapsed: row.months_elapsed,
    progressPercent: progress.percent,
    progressLabel: progress.label,
    retainer: row.retainer,
    bonusPercent: row.bonus_percent,
    kpis: row.kpis,
    startDate: row.start_date,
    endDate: row.end_date,
    signedSme: !!row.signed_sme,
    signedAdvisor: !!row.signed_advisor,
    milestonesCompleted: row.milestones_completed,
    milestonesTotal: row.milestones_total,
    nextMilestone: row.next_milestone,
    guaranteeFund: row.guarantee_fund,
    contractBody: body,
    payments: netRetainer(row.retainer),
  };
}

// ─── PYMEs ───────────────────────────────────────────────────

router.post("/pymes", (req, res, next) => {
  try {
    const db = getDatabase();
    const {
      businessName,
      rfc,
      industry,
      size,
      email,
      phone,
      city,
      annualRevenue,
      areas,
      objectives,
      timeline,
    } = req.body;

    const employees = size?.includes("51") ? 100 : size?.includes("11") ? 30 : 8;
    const areasArr = Array.isArray(areas) ? areas : [];
    const primaryArea = areasArr[0] || "Marketing Digital";

    const result = db
      .prepare(
        `INSERT INTO pymes (business_name, rfc, industry, size, employees, email, phone, city, annual_revenue, areas, objectives, timeline, primary_area)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        businessName || "Nueva PYME",
        rfc,
        industry,
        size,
        employees,
        email,
        phone,
        city || "CDMX",
        annualRevenue,
        JSON.stringify(areasArr),
        objectives,
        timeline,
        primaryArea
      );

    const pyme = getSme(db, result.lastInsertRowid);
    res.status(201).json({ pyme: { id: pyme.id, businessName: pyme.business_name } });
  } catch (e) {
    next(e);
  }
});

router.get("/pymes/:id", (req, res, next) => {
  try {
    const db = getDatabase();
    const pyme = getSme(db, req.params.id);
    if (!pyme) return res.status(404).json({ error: "PYME no encontrada" });
    res.json({
      pyme: {
        id: pyme.id,
        businessName: pyme.business_name,
        rfc: pyme.rfc,
        industry: pyme.industry,
        size: pyme.size,
        employees: pyme.employees,
        email: pyme.email,
        city: pyme.city,
        areas: parseJson(pyme.areas),
        objectives: pyme.objectives,
        timeline: pyme.timeline,
        primaryArea: pyme.primary_area,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get("/pymes/:id/dashboard", (req, res, next) => {
  try {
    const db = getDatabase();
    const smeId = Number(req.params.id);
    const pyme = getSme(db, smeId);
    if (!pyme) return res.status(404).json({ error: "PYME no encontrada" });

    const contracts = db
      .prepare("SELECT * FROM contracts WHERE sme_id = ? ORDER BY id DESC")
      .all(smeId);

    const active = contracts.filter((c) => c.status === "activo");
    const activeContract = active[0];
    let stats = {
      activeContracts: active.length,
      temporalProgress: 0,
      temporalLabel: "—",
      totalInvestment: 0,
      milestonesCompleted: 0,
      milestonesTotal: 0,
    };

    if (activeContract) {
      const p = temporalProgress(activeContract.months_elapsed, activeContract.duration_months);
      stats.temporalProgress = p.percent;
      stats.temporalLabel = p.label;
      stats.totalInvestment = active.reduce(
        (sum, c) => sum + c.retainer * c.months_elapsed,
        0
      );
      stats.milestonesCompleted = active.reduce((s, c) => s + c.milestones_completed, 0);
      stats.milestonesTotal = active.reduce((s, c) => s + c.milestones_total, 0);
    }

    const applications = db
      .prepare(
        `SELECT a.*, ad.name as advisor_name, ad.specialization, ad.years_experience, ad.projects_completed, ad.retainer, ad.bonus_percent
         FROM applications a JOIN advisors ad ON ad.id = a.advisor_id
         WHERE a.sme_id = ? AND a.status = 'pending' ORDER BY a.match_score DESC`
      )
      .all(smeId);

    const advisors = db.prepare("SELECT * FROM advisors WHERE status = 'approved'").all();
    const recommended = advisors
      .map((ad) => {
        const match = calculateMatch(pyme, ad);
        return advisorPublic(ad, match);
      })
      .filter((a) => a.matchScore >= 60)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);

    const activeList = active.map((c) => {
      const adv = getAdvisor(db, c.advisor_id);
      const prog = temporalProgress(c.months_elapsed, c.duration_months);
      return {
        id: c.id,
        advisorName: adv.name,
        advisorInitials: adv.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2),
        area: c.area,
        status: c.status,
        progressPercent: prog.percent,
        progressLabel: prog.label,
        retainer: c.retainer,
        nextMilestone: c.next_milestone,
        signedSme: !!c.signed_sme,
        signedAdvisor: !!c.signed_advisor,
      };
    });

    res.json({
      pyme: { id: pyme.id, businessName: pyme.business_name, industry: pyme.industry, employees: pyme.employees, city: pyme.city, primaryArea: pyme.primary_area },
      stats,
      activeContracts: activeList,
      applications: applications.map((a) => ({
        id: a.id,
        advisorId: a.advisor_id,
        advisorName: a.advisor_name,
        specialization: a.specialization,
        yearsExperience: a.years_experience,
        projectsCompleted: a.projects_completed,
        retainer: a.retainer,
        bonusPercent: a.bonus_percent,
        matchScore: a.match_score,
        message: a.message,
        createdAt: a.created_at,
        initials: a.advisor_name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2),
      })),
      recommendedAdvisors: recommended,
      pendingApplications: applications.length,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/pymes/:id/advisors", (req, res, next) => {
  try {
    const db = getDatabase();
    const pyme = getSme(db, req.params.id);
    if (!pyme) return res.status(404).json({ error: "PYME no encontrada" });

    const minMatch = Number(req.query.minMatch || 0);
    const area = req.query.area;

    const list = db
      .prepare("SELECT * FROM advisors WHERE status = 'approved'")
      .all()
      .map((ad) => advisorPublic(ad, calculateMatch(pyme, ad)))
      .filter((a) => a.matchScore >= minMatch)
      .filter((a) => !area || a.specialization === area || parseJson(pyme.areas).includes(area))
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json({ advisors: list });
  } catch (e) {
    next(e);
  }
});

// ─── Advisors ───────────────────────────────────────────────

router.post("/advisors", (req, res, next) => {
  try {
    const db = getDatabase();
    const b = req.body;
    const retainerMatch = (b.compensation || "").match(/\$?([\d,]+)/);
    const bonusMatch = (b.compensation || "").match(/(\d+)%/);
    const retainer = retainerMatch ? parseInt(retainerMatch[1].replace(/,/g, ""), 10) : 35000;
    const bonusPercent = bonusMatch ? parseInt(bonusMatch[1], 10) : 15;

    const result = db
      .prepare(
        `INSERT INTO advisors (name, email, phone, location, years_experience, specialization, industries, company_sizes, retainer, bonus_percent, portfolio, methodology, bio, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`
      )
      .run(
        b.name || "Nuevo Asesor",
        b.email,
        b.phone,
        b.location || "CDMX",
        b.yearsExperience || 5,
        b.specialization || "Marketing Digital",
        JSON.stringify(b.industries || []),
        JSON.stringify(b.companySizes || ["11 – 50 empleados"]),
        retainer,
        bonusPercent,
        b.portfolio,
        b.methodology,
        b.bio || b.portfolio
      );

    res.status(201).json({ advisor: { id: result.lastInsertRowid, name: b.name } });
  } catch (e) {
    next(e);
  }
});

router.get("/advisors", (req, res, next) => {
  try {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM advisors WHERE status = 'approved'").all();
    res.json({ advisors: rows.map((ad) => advisorPublic(ad)) });
  } catch (e) {
    next(e);
  }
});

router.get("/advisors/:id", (req, res, next) => {
  try {
    const db = getDatabase();
    const advisor = getAdvisor(db, req.params.id);
    if (!advisor) return res.status(404).json({ error: "Asesor no encontrado" });
    const smeId = req.query.smeId;
    let match;
    if (smeId) {
      const pyme = getSme(db, smeId);
      if (pyme) match = calculateMatch(pyme, advisor);
    }
    res.json({ advisor: advisorPublic(advisor, match) });
  } catch (e) {
    next(e);
  }
});

router.get("/advisors/:id/dashboard", (req, res, next) => {
  try {
    const db = getDatabase();
    const advisorId = Number(req.params.id);
    const advisor = getAdvisor(db, advisorId);
    if (!advisor) return res.status(404).json({ error: "Asesor no encontrado" });

    const contracts = db
      .prepare("SELECT * FROM contracts WHERE advisor_id = ?")
      .all(advisorId);
    const active = contracts.filter((c) => c.status === "activo");
    const monthlyNet = active.reduce((s, c) => s + netRetainer(c.retainer).net, 0);

    const pymes = db.prepare("SELECT * FROM pymes").all();
    const opportunities = pymes
      .map((p) => {
        const match = calculateMatch(p, advisor);
        return {
          id: p.id,
          businessName: p.business_name,
          industry: p.industry,
          primaryArea: p.primary_area,
          employees: p.employees,
          city: p.city,
          timeline: p.timeline,
          objectives: p.objectives,
          matchScore: match.score,
          matchBreakdown: match.breakdown,
          budgetHint: `$${Math.round(advisor.retainer * 0.9 / 1000)}–${Math.round(advisor.retainer * 1.1 / 1000)}k/mes + ${advisor.bonus_percent}% bono`,
        };
      })
      .filter((o) => o.matchScore >= 25)
      .sort((a, b) => b.matchScore - a.matchScore);

    const appliedSmeIds = new Set(
      db.prepare("SELECT sme_id FROM applications WHERE advisor_id = ?").all(advisorId).map((r) => r.sme_id)
    );
    const withFlags = opportunities.map((o) => ({
      ...o,
      alreadyApplied: appliedSmeIds.has(o.id),
    }));

    const featured = withFlags.filter((o) => o.matchScore >= 50).slice(0, 4);
    const allOpportunities = withFlags.slice(0, 12);

    const myApplications = db
      .prepare(
        `SELECT a.*, p.business_name, p.primary_area, p.industry
         FROM applications a JOIN pymes p ON p.id = a.sme_id
         WHERE a.advisor_id = ? ORDER BY a.created_at DESC`
      )
      .all(advisorId)
      .map((a) => ({
        id: a.id,
        smeId: a.sme_id,
        businessName: a.business_name,
        primaryArea: a.primary_area,
        industry: a.industry,
        message: a.message,
        status: a.status,
        matchScore: a.match_score,
        createdAt: a.created_at,
      }));

    const pendingSignatures = contracts
      .filter((c) => c.status === "pendiente" && !c.signed_advisor)
      .map((c) => {
        const sme = getSme(db, c.sme_id);
        return {
          id: c.id,
          smeName: sme?.business_name,
          area: c.area,
          retainer: c.retainer,
        };
      });

    const unreadRow = db
      .prepare(
        `SELECT COUNT(*) as n FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.advisor_id = ? AND m.sender_role = 'pyme'`
      )
      .get(advisorId);

    const activeProjects = active.map((c) => {
      const sme = getSme(db, c.sme_id);
      const prog = temporalProgress(c.months_elapsed, c.duration_months);
      return {
        id: c.id,
        smeName: sme.business_name,
        smeInitials: sme.business_name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2),
        area: c.area,
        durationMonths: c.duration_months,
        progressPercent: prog.percent,
        progressLabel: prog.label,
        nextMilestone: c.next_milestone,
        endDate: c.end_date,
      };
    });

    res.json({
      advisor: advisorPublic(advisor),
      stats: {
        activeProjects: active.length,
        monthlyIncome: monthlyNet,
        opportunitiesCount: opportunities.length,
        completedProjects: advisor.projects_completed,
        applicationsPending: myApplications.filter((a) => a.status === "pending").length,
        unreadMessages: unreadRow?.n || 0,
      },
      featuredOpportunities: featured,
      allOpportunities,
      myApplications,
      pendingSignatures,
      activeProjects,
    });
  } catch (e) {
    next(e);
  }
});

// ─── Applications ───────────────────────────────────────────

router.post("/applications", (req, res, next) => {
  try {
    const db = getDatabase();
    const { advisorId, smeId, message } = req.body;
    const pyme = getSme(db, smeId);
    const advisor = getAdvisor(db, advisorId);
    if (!pyme || !advisor) return res.status(404).json({ error: "PYME o asesor no encontrado" });

    const existing = db
      .prepare("SELECT id FROM applications WHERE sme_id = ? AND advisor_id = ? AND status = 'pending'")
      .get(smeId, advisorId);
    if (existing) return res.status(400).json({ error: "Ya aplicaste a esta oportunidad" });

    const match = calculateMatch(pyme, advisor);
    const result = db
      .prepare(
        "INSERT INTO applications (sme_id, advisor_id, message, match_score) VALUES (?, ?, ?, ?)"
      )
      .run(smeId, advisorId, message, match.score);

    res.status(201).json({ applicationId: result.lastInsertRowid, matchScore: match.score });
  } catch (e) {
    next(e);
  }
});

router.patch("/applications/:id", (req, res, next) => {
  try {
    const db = getDatabase();
    const { action } = req.body;
    const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ error: "Aplicación no encontrada" });

    if (action === "reject") {
      db.prepare("UPDATE applications SET status = 'rejected' WHERE id = ?").run(app.id);
      return res.json({ ok: true, status: "rejected" });
    }

    if (action === "accept") {
      const pyme = getSme(db, app.sme_id);
      const advisor = getAdvisor(db, app.advisor_id);
      const months = timelineToMonths(pyme.timeline);
      const body = generateContractBody({
        sme: pyme,
        advisor,
        area: pyme.primary_area,
        durationMonths: months,
        retainer: advisor.retainer,
        bonusPercent: advisor.bonus_percent,
        kpis: pyme.objectives || "KPIs definidos en contrato estándar",
      });

      const contract = db
        .prepare(
          `INSERT INTO contracts (sme_id, advisor_id, application_id, area, status, duration_months, retainer, bonus_percent, kpis, start_date, end_date, signed_advisor, next_milestone, contract_body)
           VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?, 1, 'Firma PYME', ?)`
        )
        .run(
          app.sme_id,
          app.advisor_id,
          app.id,
          pyme.primary_area,
          months,
          advisor.retainer,
          advisor.bonus_percent,
          pyme.objectives,
          body.startDate,
          body.endDate,
          JSON.stringify(body)
        );

      db.prepare("UPDATE applications SET status = 'accepted' WHERE id = ?").run(app.id);
      return res.json({ ok: true, contractId: contract.lastInsertRowid });
    }

    res.status(400).json({ error: "Acción inválida. Use accept o reject." });
  } catch (e) {
    next(e);
  }
});

// ─── Contracts ────────────────────────────────────────────────

router.get("/contracts", (req, res, next) => {
  try {
    const db = getDatabase();
    const { role, userId, status } = req.query;
    if (!role || !userId) {
      return res.status(400).json({ error: "role y userId requeridos" });
    }

    const col = role === "pyme" ? "sme_id" : "advisor_id";
    let sql = `SELECT * FROM contracts WHERE ${col} = ?`;
    const params = [userId];
    if (status && status !== "todos") {
      sql += " AND status = ?";
      params.push(status);
    }
    sql += " ORDER BY id DESC";

    const rows = db.prepare(sql).all(...params);
    const list = rows.map((c) => {
      const sme = getSme(db, c.sme_id);
      const advisor = getAdvisor(db, c.advisor_id);
      return contractPublic(c, sme, advisor);
    });

    res.json({ contracts: list, counts: countByStatus(rows) });
  } catch (e) {
    next(e);
  }
});

function countByStatus(rows) {
  return {
    todos: rows.length,
    activo: rows.filter((r) => r.status === "activo").length,
    pendiente: rows.filter((r) => r.status === "pendiente").length,
    completado: rows.filter((r) => r.status === "completado").length,
  };
}

router.get("/contracts/:id", (req, res, next) => {
  try {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM contracts WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Contrato no encontrado" });
    res.json({
      contract: contractPublic(row, getSme(db, row.sme_id), getAdvisor(db, row.advisor_id)),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/contracts/:id/sign", (req, res, next) => {
  try {
    const db = getDatabase();
    const { role } = req.body;
    const row = db.prepare("SELECT * FROM contracts WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Contrato no encontrado" });

    if (role === "pyme") {
      db.prepare("UPDATE contracts SET signed_sme = 1 WHERE id = ?").run(row.id);
    } else if (role === "advisor") {
      db.prepare("UPDATE contracts SET signed_advisor = 1 WHERE id = ?").run(row.id);
    } else {
      return res.status(400).json({ error: "role debe ser pyme o advisor" });
    }

    const updated = db.prepare("SELECT * FROM contracts WHERE id = ?").get(row.id);
    if (updated.signed_sme && updated.signed_advisor) {
      db.prepare("UPDATE contracts SET status = 'activo', next_milestone = 'Diagnóstico Inicial' WHERE id = ?").run(
        row.id
      );
      const conv = db
        .prepare("SELECT id FROM conversations WHERE contract_id = ?")
        .get(row.id);
      if (!conv) {
        const sme = getSme(db, row.sme_id);
        const adv = getAdvisor(db, row.advisor_id);
        db.prepare(
          "INSERT INTO conversations (sme_id, advisor_id, contract_id, project_name) VALUES (?, ?, ?, ?)"
        ).run(row.sme_id, row.advisor_id, row.id, `${row.area} — ${sme.business_name}`);
      }
    }

    const final = db.prepare("SELECT * FROM contracts WHERE id = ?").get(row.id);
    res.json({
      contract: contractPublic(final, getSme(db, final.sme_id), getAdvisor(db, final.advisor_id)),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/contracts/:id/dispute", (req, res, next) => {
  try {
    const db = getDatabase();
    const { reportedBy, description } = req.body;
    db.prepare(
      "INSERT INTO disputes (contract_id, reported_by, description) VALUES (?, ?, ?)"
    ).run(req.params.id, reportedBy, description);
    res.status(201).json({ ok: true, message: "Disputa registrada. Mediación en 10-15 días hábiles." });
  } catch (e) {
    next(e);
  }
});

router.post("/contracts/:id/additional", (req, res, next) => {
  try {
    const db = getDatabase();
    const { description, duration, objectives } = req.body;
    db.prepare(
      "INSERT INTO additional_requests (contract_id, description, duration, objectives) VALUES (?, ?, ?, ?)"
    ).run(req.params.id, description, duration, objectives);
    res.status(201).json({ ok: true, message: "Solicitud enviada. Revisión en 2-3 días hábiles." });
  } catch (e) {
    next(e);
  }
});

// ─── Messages ─────────────────────────────────────────────────

function formatMessageTime(iso) {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + "Z");
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) {
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 172800000) return "Ayer";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

router.get("/conversations", (req, res, next) => {
  try {
    const db = getDatabase();
    const { role, userId } = req.query;
    const col = role === "pyme" ? "sme_id" : "advisor_id";
    const convs = db
      .prepare(
        `SELECT c.*, (SELECT MAX(id) FROM messages m WHERE m.conversation_id = c.id) as last_msg_id
         FROM conversations c WHERE c.${col} = ? ORDER BY last_msg_id DESC, c.id DESC`
      )
      .all(userId);

    const list = convs.map((c) => {
      const last = db
        .prepare(
          "SELECT body, created_at, sender_role FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1"
        )
        .get(c.id);
      const unread = db
        .prepare(
          `SELECT COUNT(*) as n FROM messages WHERE conversation_id = ? AND sender_role != ?`
        )
        .get(c.id, role);
      const counterparty =
        role === "pyme"
          ? getAdvisor(db, c.advisor_id)
          : getSme(db, c.sme_id);
      const name = role === "pyme" ? counterparty?.name : counterparty?.business_name;
      return {
        id: c.id,
        name,
        projectName: c.project_name,
        contractId: c.contract_id,
        lastMessage: last?.body,
        lastAt: formatMessageTime(last?.created_at),
        lastAtRaw: last?.created_at,
        unread: unread?.n || 0,
        initials: (name || "?")
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      };
    });

    res.json({ conversations: list, totalUnread: list.reduce((s, c) => s + c.unread, 0) });
  } catch (e) {
    next(e);
  }
});

router.get("/conversations/:id/messages", (req, res, next) => {
  try {
    const db = getDatabase();
    const msgs = db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC")
      .all(req.params.id);
    res.json({
      messages: msgs.map((m) => ({
        id: m.id,
        senderRole: m.sender_role,
        senderId: m.sender_id,
        body: m.body,
        createdAt: m.created_at,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/conversations/:id/messages", (req, res, next) => {
  try {
    const db = getDatabase();
    const { senderRole, senderId, body } = req.body;
    const result = db
      .prepare(
        "INSERT INTO messages (conversation_id, sender_role, sender_id, body) VALUES (?, ?, ?, ?)"
      )
      .run(req.params.id, senderRole, senderId, body);
    res.status(201).json({ messageId: result.lastInsertRowid });
  } catch (e) {
    next(e);
  }
});

router.post("/dev/reset", (req, res, next) => {
  try {
    const db = getDatabase();
    const { clearDatabase, seedAll, SEED_VERSION } = require("../db/seed");
    clearDatabase(db);
    seedAll(db);
    db.prepare("INSERT OR REPLACE INTO app_metadata (key, value, updated_at) VALUES ('seed_version', ?, datetime('now'))").run(SEED_VERSION);
    res.json({ ok: true, message: "Base de datos reiniciada con datos demo ampliados" });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
