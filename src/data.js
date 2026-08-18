import fs from "node:fs";
import path from "node:path";

export const SHAREPOINT_SOURCE_URL =
  "https://m365cpi70484186.sharepoint.com/sites/Almedalen/Delade%20dokument/Forms/AllItems.aspx?web=1&FolderCTID=0x0120009AA01829982188468E2F1A4CC2D5DFB6&id=%2Fsites%2FAlmedalen%2FDelade%20dokument%2FBygglov";

const workspaceRoot = path.resolve(process.cwd(), "..");
const dataDir = path.resolve(process.cwd(), "data");
const dataFile = path.join(dataDir, "cases.json");

const sourceDirectories = [
  path.join(workspaceRoot, "bygglov_sharepoint_cases"),
  path.join(workspaceRoot, "bygglov_status_cases"),
  path.join(workspaceRoot, "bygglov_approved_cases"),
  path.join(workspaceRoot, "Bygglov 2.0", "Bygglov_2_0_demo", "output", "sharepoint_cases"),
];

const sampleIncomingCasePath = path.join(
  workspaceRoot,
  "Bygglov 2.0",
  "Bygglov_2_0_demo",
  "sample_incoming_case.json",
);

const statusByPrefix = [
  ["Kompletteringsbrev", "Vantar pa komplettering"],
  ["Under_granskning", "Under granskning"],
  ["Grannhorande_remiss", "Grannhorande/remiss"],
  ["Startbesked_kravs", "Startbesked kravs"],
  ["Beviljat_med_villkor", "Beviljat med villkor"],
  ["Avslag", "Avslag"],
  ["Avskrivet_atertaget", "Avskrivet/atertaget"],
  ["Slutbesked", "Slutbesked"],
  ["Beslut", "Beviljat"],
];

const statusNextStep = {
  "Nytt arende": "Kontrollera inkomna handlingar och begar komplettering vid behov.",
  "Vantar pa komplettering": "Skicka eller folj upp kompletteringsbrev till sokanden.",
  "Under granskning": "Granska planenlighet, ritningar och tekniska krav.",
  "Grannhorande/remiss": "Invanta synpunkter fran berorda grannar eller remissinstanser.",
  "Startbesked kravs": "Forbered tekniskt samrad och underlag for startbesked.",
  "Beviljat med villkor": "Kontrollera villkor och informera om startbesked.",
  Godkand: "Arkivera beslut och bevaka laga kraft/startbesked.",
  Beviljat: "Arkivera beslut och bevaka laga kraft/startbesked.",
  Avslag: "Sakerstall beslutsmotivering och overklagandeinformation.",
  "Avskrivet/atertaget": "Avsluta arendet och arkivera inkomna handlingar.",
  Slutbesked: "Avsluta byggprocessen och markera arendet som fardigt.",
};

const fallbackMissingInformation = [
  "Sektionsritning saknas.",
  "Teknisk beskrivning saknas.",
  "Uppgift om kontrollansvarig saknas eller behover fortydligas.",
];

const documentReviewStatuses = ["Ej granskad", "Inkommen", "Godkand", "Saknas", "Behover kompletteras", "Ej relevant"];
const complianceStatuses = ["Ej granskad", "Godkand", "Avvikelse", "Behover granskas", "Ej relevant"];
const approvalStatuses = ["Godkand", "Beviljat", "Beviljat med villkor", "Slutbesked"];

const defaultComplianceChecks = [
  {
    id: "pbl",
    area: "Bygglovsprövning",
    title: "Plan- och bygglagen (PBL)",
    source: "Plan- och bygglagen (2010:900)",
    status: "Ej granskad",
    comment: "Kontrollera lovplikt, prövningsgrunder, beslut, startbesked, slutbesked och tillsyn.",
  },
  {
    id: "pbf",
    area: "Föreskrifter till PBL",
    title: "Plan- och byggförordningen (PBF)",
    source: "Plan- och byggförordningen (2011:338)",
    status: "Ej granskad",
    comment: "Kontrollera lovplikt, anmälningsplikt, tekniska egenskapskrav och kontrollansvarig.",
  },
  {
    id: "detaljplan",
    area: "Planunderlag",
    title: "Detaljplan och områdesbestämmelser",
    source: "Kommunens gällande planer",
    status: "Ej granskad",
    comment: "Kontrollera byggrätt, användning, placering, höjd, prickmark, utformning och skydd.",
  },
  {
    id: "oversiktsplan",
    area: "Planunderlag",
    title: "Översiktsplan och lokala riktlinjer",
    source: "Kommunens översiktsplan, planprogram och riktlinjer",
    status: "Ej granskad",
    comment: "Används som stöd utanför detaljplan och vid lokaliseringsprövning.",
  },
  {
    id: "boverket",
    area: "Tekniska krav",
    title: "Boverkets regler och vägledning",
    source: "BBR/nya byggregler, EKS och PBL-kunskapsbanken",
    status: "Ej granskad",
    comment: "Kontrollera tekniska egenskapskrav, tillgänglighet, brandskydd, bärförmåga och energi.",
  },
  {
    id: "miljobalken",
    area: "Miljö och hälsa",
    title: "Miljöbalken",
    source: "Miljöbalken (1998:808)",
    status: "Ej granskad",
    comment: "Kontrollera strandskydd, naturmiljö, riksintressen, hälsa och säkerhet.",
  },
  {
    id: "kulturmiljo",
    area: "Kulturmiljö",
    title: "Kulturmiljö och varsamhet",
    source: "Kulturmiljölagen samt PBL:s varsamhets- och förvanskningsregler",
    status: "Ej granskad",
    comment: "Kontrollera skyddade eller kulturhistoriskt värdefulla byggnader och miljöer.",
  },
  {
    id: "trafik",
    area: "Trafik och tillgänglighet",
    title: "Vägar, utfarter, parkering och angöring",
    source: "Väglagen, trafikregler och kommunala riktlinjer",
    status: "Ej granskad",
    comment: "Kontrollera utfart, sikt, parkering, angöring och påverkan på gata eller allmän plats.",
  },
  {
    id: "fastighetsratt",
    area: "Fastighetsrätt",
    title: "Fastighetsrättsliga förutsättningar",
    source: "Fastighetsbildningslagen, jordabalken, servitut och gemensamhetsanläggningar",
    status: "Ej granskad",
    comment: "Kontrollera fastighetsgränser, rättigheter, lov på annans mark och lantmäterifrågor.",
  },
  {
    id: "forvaltningsratt",
    area: "Handläggning",
    title: "Förvaltningsrätt och kommunal beslutsgång",
    source: "Förvaltningslagen och kommunallagen",
    status: "Ej granskad",
    comment: "Kontrollera kommunikation, jäv, motivering, dokumentation, service och beslutsgång.",
  },
  {
    id: "offentlighet",
    area: "Informationshantering",
    title: "Offentlighet, sekretess och arkiv",
    source: "OSL, tryckfrihetsförordningen och arkivlagen",
    status: "Ej granskad",
    comment: "Kontrollera diarieföring, utlämnande, sekretessprövning och arkivering.",
  },
  {
    id: "dataskydd",
    area: "Informationshantering",
    title: "Dataskydd",
    source: "GDPR och dataskyddslagstiftning",
    status: "Ej granskad",
    comment: "Kontrollera hantering av personuppgifter i ärendet.",
  },
  {
    id: "grannhorande",
    area: "Remisser",
    title: "Grannhörande och remisser",
    source: "PBL, förvaltningslagen och lokala rutiner",
    status: "Ej granskad",
    comment: "Bedöm om sakägare, grannar, remissinstanser eller interna funktioner ska höras.",
  },
  {
    id: "praxis",
    area: "Rättspraxis",
    title: "Domstolspraxis",
    source: "MÖD, mark- och miljödomstolar och HFD vid behov",
    status: "Ej granskad",
    comment: "Kontrollera praxis vid exempelvis liten avvikelse, olägenhet, planenlighet och lovplikt.",
  },
];

let cases = [];

export function loadStore() {
  fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(dataFile)) {
    cases = JSON.parse(fs.readFileSync(dataFile, "utf8")).map(normalizeCase);
    persist();
    return cases;
  }

  cases = seedCasesFromBygglovDemo();
  persist();
  return cases;
}

export function getCases(filters = {}) {
  let result = [...cases];

  if (filters.status) {
    result = result.filter((item) => item.status.toLowerCase() === filters.status.toLowerCase());
  }

  if (filters.query) {
    const query = filters.query.toLowerCase();
    result = result.filter((item) =>
      [
        item.caseNumber,
        item.status,
        item.applicant,
        item.propertyDesignation,
        item.measure,
        item.summary,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }

  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCase(caseNumber) {
  const exact = cases.find((item) => item.caseNumber.toLowerCase() === caseNumber.toLowerCase());
  if (exact) {
    return exact;
  }

  const matches = findCaseMatches(caseNumber);
  return matches.length === 1 ? matches[0] : undefined;
}

export function findCaseMatches(query, limit = 10) {
  const normalizedQuery = normalizeCaseSearch(query);
  if (!normalizedQuery) {
    return [];
  }

  return cases
    .filter((item) => {
      const normalizedCaseNumber = normalizeCaseSearch(item.caseNumber);
      return item.caseNumber.toLowerCase().includes(String(query).trim().toLowerCase()) || normalizedCaseNumber.includes(normalizedQuery);
    })
    .sort((a, b) => a.caseNumber.localeCompare(b.caseNumber))
    .slice(0, limit);
}

export function createCase(input) {
  const now = new Date().toISOString();
  const caseNumber = input.caseNumber || nextCaseNumber();

  if (getCase(caseNumber)) {
    throw new Error(`Arendenummer ${caseNumber} finns redan.`);
  }

  const created = normalizeCase({
    caseNumber,
    received: input.received || now,
    status: input.status || "Nytt arende",
    applicant: input.applicant || "Okand sokande",
    from: input.from || "",
    subject: input.subject || "Ny bygglovsansokan",
    propertyDesignation: input.propertyDesignation || "Ej angiven",
    propertyAddress: input.propertyAddress || "",
    measure: input.measure || "Ej angiven atgard",
    attachments: input.attachments || [],
    missingInformation: input.missingInformation || [],
    documents: input.documents || [],
    complianceChecks: input.complianceChecks || [],
    notes: input.notes || [],
    source: input.source || "Skapat i demoarendesystemet",
    createdAt: now,
    updatedAt: now,
  });

  cases.push(created);
  persist();
  return created;
}

export function updateCaseStatus(caseNumber, status, note) {
  const found = getCase(caseNumber);

  if (!found) {
    throw new Error(`Hittar inte arende ${caseNumber}.`);
  }

  if (approvalStatuses.includes(status) && !isCaseReadyForApproval(found)) {
    const blockingItems = approvalBlockingItems(found);
    throw new Error(
      `Arendet kan inte markeras som ${status} eftersom alla handlingar och kontroller inte ar Godkand eller Ej relevant. Kvar: ${blockingItems.join(", ")}.`,
    );
  }

  found.status = status;
  found.nextStep = statusNextStep[status] || "Handlaggare granskar nasta steg.";
  found.updatedAt = new Date().toISOString();

  if (note) {
    found.notes.unshift(makeNote(note, "Andreas Adolfsson via Bygglov 2.0"));
  }

  persist();
  return found;
}

export function reviewReadiness(caseNumber) {
  const found = getCase(caseNumber);

  if (!found) {
    throw new Error(`Hittar inte arende ${caseNumber}.`);
  }

  return {
    caseNumber: found.caseNumber,
    readyForApproval: isCaseReadyForApproval(found),
    blockingItems: approvalBlockingItems(found),
    documentSummary: summarizeStatuses(found.documents, "reviewStatus"),
    complianceSummary: summarizeStatuses(found.complianceChecks, "status"),
  };
}

export function updateDocumentReview(caseNumber, documentName, reviewStatus, comment) {
  if (!documentReviewStatuses.includes(reviewStatus)) {
    throw new Error(`Ogiltig handlingsstatus: ${reviewStatus}.`);
  }

  const found = getCase(caseNumber);

  if (!found) {
    throw new Error(`Hittar inte arende ${caseNumber}.`);
  }

  const document = found.documents.find((item) => item.name.toLowerCase() === documentName.toLowerCase());

  if (!document) {
    throw new Error(`Hittar inte handlingen ${documentName} i arende ${caseNumber}.`);
  }

  document.reviewStatus = reviewStatus;
  document.status = reviewStatus;
  document.approved = reviewStatus === "Godkand";
  if (comment !== undefined) {
    document.comment = comment;
  }
  found.updatedAt = new Date().toISOString();
  found.notes.unshift(makeNote(`Handlingen "${document.name}" markerades som ${reviewStatus}.`, "Andreas Adolfsson via Bygglov 2.0"));
  persist();
  return found;
}

export function updateComplianceCheck(caseNumber, checkId, status, comment) {
  if (!complianceStatuses.includes(status)) {
    throw new Error(`Ogiltig kontrollstatus: ${status}.`);
  }

  const found = getCase(caseNumber);

  if (!found) {
    throw new Error(`Hittar inte arende ${caseNumber}.`);
  }

  const check = found.complianceChecks.find((item) => item.id.toLowerCase() === checkId.toLowerCase());

  if (!check) {
    throw new Error(`Hittar inte kontrollpunkten ${checkId} i arende ${caseNumber}.`);
  }

  check.status = status;
  if (comment !== undefined) {
    check.comment = comment;
  }
  found.updatedAt = new Date().toISOString();
  found.notes.unshift(makeNote(`Kontrollpunkten "${check.title}" markerades som ${status}.`, "Andreas Adolfsson via Bygglov 2.0"));
  persist();
  return found;
}

export function addCaseNote(caseNumber, text, author = "Andreas Adolfsson via Bygglov 2.0") {
  const found = getCase(caseNumber);

  if (!found) {
    throw new Error(`Hittar inte arende ${caseNumber}.`);
  }

  const note = makeNote(text, author);
  found.notes.unshift(note);
  found.updatedAt = note.createdAt;
  persist();
  console.log(`[cases] note added`, { caseNumber: found.caseNumber, author: note.author, createdAt: note.createdAt });
  return found;
}

export function getLatestNotes(caseNumber, limit = 5) {
  const found = getCase(caseNumber);

  if (!found) {
    throw new Error(`Hittar inte arende ${caseNumber}.`);
  }

  return {
    caseNumber: found.caseNumber,
    status: found.status,
    notes: [...found.notes]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, limit),
  };
}

export function summarizeCase(caseNumber) {
  const found = getCase(caseNumber);

  if (!found) {
    throw new Error(`Hittar inte arende ${caseNumber}.`);
  }

  return {
    caseNumber: found.caseNumber,
    status: found.status,
    applicant: found.applicant,
    propertyDesignation: found.propertyDesignation,
    measure: found.measure,
    missingInformation: found.missingInformation,
    documents: found.documents,
    complianceChecks: found.complianceChecks,
    nextStep: found.nextStep,
    summary: found.summary,
    source: found.source,
  };
}

export function demoOverview() {
  const byStatus = cases.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  return {
    name: "Bygglov 2.0 demoarendesystem",
    purpose: "Visa hur en Copilot Studio-agent kan lasa och uppdatera ett tredje parts arendesystem via MCP.",
    sharePointSource: SHAREPOINT_SOURCE_URL,
    totalCases: cases.length,
    byStatus,
    exampleQuestions: [
      "Visa arende BYGG-2026-0001",
      "Vilka arenden vantar pa komplettering?",
      "Lagg en notering pa BYGG-2026-20260616-19001",
      "Andra status for BYGG-2026-20260616-19001 till Grannhorande/remiss",
    ],
  };
}

function seedCasesFromBygglovDemo() {
  const seeded = new Map();

  seedIncomingCase(seeded);

  for (const directory of sourceDirectories) {
    if (!fs.existsSync(directory)) {
      continue;
    }

    for (const fileName of fs.readdirSync(directory)) {
      if (!fileName.toLowerCase().endsWith(".doc")) {
        continue;
      }

      const filePath = path.join(directory, fileName);
      const parsed = parseCaseDocument(filePath, fileName);
      seeded.set(parsed.caseNumber, parsed);
    }
  }

  return [...seeded.values()].sort((a, b) => a.caseNumber.localeCompare(b.caseNumber));
}

function seedIncomingCase(seeded) {
  if (!fs.existsSync(sampleIncomingCasePath)) {
    return;
  }

  const sample = JSON.parse(fs.readFileSync(sampleIncomingCasePath, "utf8"));
  seeded.set(
    sample.caseNumber,
    normalizeCase({
      ...sample,
      status: "Vantar pa komplettering",
      propertyAddress: "",
      documents: sample.attachments.map((name) => ({
        name,
        status: "Inkommen",
        comment: "Bilaga fran inkommande ansokan.",
      })),
      summary:
        "Inkommen ansokan om tillbyggnad. Agenten har identifierat kompletteringsbehov innan fortsatt handlaggning.",
      nextStep: statusNextStep["Vantar pa komplettering"],
      source: "Bygglov 2.0 sample_incoming_case.json och demo-mail",
      notes: [makeNote("Kompletteringsbrev och beslutsunderlag finns som demo-Wordutkast i Bygglov 2.0-output.", "Bygglov 2.0")],
      createdAt: sample.received,
      updatedAt: sample.received,
    }),
  );
}

function parseCaseDocument(filePath, fileName) {
  const html = fs.readFileSync(filePath, "utf8");
  const text = toText(html);
  const caseNumber = matchText(text, /BYGG-\d{4}-[\d-]+/i) || caseNumberFromFile(fileName);
  const status = statusFromFileName(fileName, text);
  const title = matchText(text, /<h1[^>]*>(.*?)<\/h1>/i, html) || status;
  const applicant = tableValue(html, "Sokande") || tableValue(html, "Sökande") || "Demo Sokande";
  const propertyDesignation =
    tableValue(html, "Fastighet") || tableValue(html, "Fastighetsbeteckning") || "Ej angiven";
  const propertyAddress = tableValue(html, "Fastighetsadress") || "";
  const measure = tableValue(html, "Atgard") || tableValue(html, "Åtgärd") || "Bygglovsatgard";
  const received = `${tableValue(html, "Datum") || "2026-06-16"}T09:00:00+02:00`;
  const documents = documentRows(html);
  const missingInformation = status === "Vantar pa komplettering" ? fallbackMissingInformation : [];

  return normalizeCase({
    caseNumber,
    received,
    status,
    applicant,
    subject: title,
    propertyDesignation,
    propertyAddress,
    measure,
    attachments: documents.map((item) => item.name),
    missingInformation,
    documents,
    summary: summaryFromStatus(status, applicant, propertyDesignation, measure),
    nextStep: statusNextStep[status] || "Foresla nasta handlaggningssteg.",
    source: filePath,
    notes: [makeNote(`Importerat fran Bygglov-demo: ${fileName}`, "Systemimport")],
    createdAt: received,
    updatedAt: received,
  });
}

function normalizeCase(input) {
  return {
    id: input.caseNumber,
    caseNumber: input.caseNumber,
    received: input.received,
    status: input.status,
    applicant: input.applicant,
    applicantEmail: input.applicantEmail || "",
    applicantPhone: input.applicantPhone || "",
    applicantAddress: input.applicantAddress || "",
    from: input.from || "",
    subject: input.subject || "",
    propertyDesignation: input.propertyDesignation,
    propertyAddress: input.propertyAddress || "",
    measure: input.measure,
    attachments: input.attachments || [],
    missingInformation: input.missingInformation || [],
    documents: normalizeDocuments(input.documents || [], input.attachments || []),
    complianceChecks: normalizeComplianceChecks(input.complianceChecks || []),
    summary: input.summary || summaryFromStatus(input.status, input.applicant, input.propertyDesignation, input.measure),
    nextStep: input.nextStep || statusNextStep[input.status] || "Handlaggare granskar nasta steg.",
    source: input.source || "Bygglov-demo",
    notes: input.notes || [],
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

function normalizeDocuments(documents, attachments = []) {
  const sourceDocuments =
    documents.length > 0
      ? documents
      : attachments.map((name) => ({
          name,
          status: "Inkommen",
          comment: "",
        }));

  return sourceDocuments.map((document) => {
    const reviewStatus = normalizeDocumentStatus(document.reviewStatus || document.status);
    return {
      name: document.name,
      status: reviewStatus,
      reviewStatus,
      approved: document.approved === true || reviewStatus === "Godkand",
      comment: document.comment || aiReviewCommentForDocument(reviewStatus),
      reviewedBy: document.reviewedBy || (reviewStatus !== "Ej granskad" ? "AI Agent Bygglov 2.0" : ""),
    };
  });
}

function normalizeDocumentStatus(status) {
  if (status === "Godkänd") {
    return "Godkand";
  }

  if (status === "Behöver kompletteras") {
    return "Behover kompletteras";
  }

  return documentReviewStatuses.includes(status) ? status : "Ej granskad";
}

function normalizeComplianceChecks(inputChecks) {
  const byId = new Map(inputChecks.map((check) => [check.id, check]));

  return defaultComplianceChecks.map((defaultCheck) => {
    const existing = byId.get(defaultCheck.id) || {};
    const status = normalizeComplianceStatus(existing.status || defaultCheck.status);
    return {
      ...defaultCheck,
      ...existing,
      status,
      comment: existing.comment || defaultCheck.comment,
      reviewedBy: existing.reviewedBy || (status !== "Ej granskad" ? "AI Agent Bygglov 2.0" : ""),
    };
  });
}

function aiReviewCommentForDocument(status) {
  if (status === "Godkand") {
    return "Granskad och godkänd av AI Agent Bygglov 2.0.";
  }

  if (status === "Saknas" || status === "Behover kompletteras") {
    return "AI Agent Bygglov 2.0 har identifierat att handlingen behöver kompletteras.";
  }

  if (status === "Ej relevant") {
    return "AI Agent Bygglov 2.0 har bedömt handlingen som ej relevant för detta ärende.";
  }

  if (status === "Inkommen") {
    return "AI Agent Bygglov 2.0 har registrerat handlingen som inkommen.";
  }

  return "";
}

function normalizeComplianceStatus(status) {
  if (status === "Godkänd") {
    return "Godkand";
  }

  if (status === "Behöver granskas") {
    return "Behover granskas";
  }

  return complianceStatuses.includes(status) ? status : "Ej granskad";
}

function isCaseReadyForApproval(caseItem) {
  return approvalBlockingItems(caseItem).length === 0;
}

function approvalBlockingItems(caseItem) {
  const documentBlocks = (caseItem.documents || [])
    .filter((document) => !["Godkand", "Ej relevant"].includes(document.reviewStatus || document.status))
    .map((document) => `Handling: ${document.name} (${document.reviewStatus || document.status || "Ej granskad"})`);

  const complianceBlocks = (caseItem.complianceChecks || [])
    .filter((check) => !["Godkand", "Ej relevant"].includes(check.status))
    .map((check) => `Kontroll: ${check.title} (${check.status || "Ej granskad"})`);

  return [...documentBlocks, ...complianceBlocks];
}

function summarizeStatuses(items, statusKey) {
  return (items || []).reduce((acc, item) => {
    const status = item[statusKey] || "Ej granskad";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

function normalizeCaseSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function nextCaseNumber() {
  const max = cases.reduce((highest, item) => {
    const match = item.caseNumber.match(/^BYGG-2026-(\d{4})$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 1);

  return `BYGG-2026-${String(max + 1).padStart(4, "0")}`;
}

function persist() {
  fs.writeFileSync(dataFile, JSON.stringify(cases, null, 2));
}

function makeNote(text, author) {
  return {
    id: `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author,
    text,
    createdAt: new Date().toISOString(),
  };
}

function statusFromFileName(fileName, text) {
  const known = statusByPrefix.find(([prefix]) => fileName.startsWith(prefix));
  if (known) {
    return known[1];
  }

  const matched = matchText(text, /Status:\s*([^\n]+)/i);
  return matched || "Under granskning";
}

function caseNumberFromFile(fileName) {
  return matchText(fileName, /BYGG-\d{4}-[\d-]+/i) || `BYGG-2026-${Date.now()}`;
}

function summaryFromStatus(status, applicant, propertyDesignation, measure) {
  return `${status}: ${applicant} - ${measure} pa fastigheten ${propertyDesignation}.`;
}

function tableValue(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<td[^>]*class=['"]label['"][^>]*>\\s*${escaped}\\s*<\\/td>\\s*<td[^>]*>(.*?)<\\/td>`, "i");
  const match = html.match(regex);
  return match ? toText(match[1]) : "";
}

function documentRows(html) {
  const rows = [...html.matchAll(/<tr><td>(.*?)<\/td><td[^>]*>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gi)];

  return rows
    .map(([, name, status, comment]) => ({
      name: toText(name),
      status: toText(status),
      comment: toText(comment),
    }))
    .filter((row) => row.name && row.name !== "Handling");
}

function matchText(text, regex, input = text) {
  const match = input.match(regex);
  return match ? toText(match[1] || match[0]) : "";
}

function toText(value) {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&aring;/g, "a")
    .replace(/&auml;/g, "a")
    .replace(/&ouml;/g, "o")
    .replace(/&Aring;/g, "A")
    .replace(/&Auml;/g, "A")
    .replace(/&Ouml;/g, "O")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
