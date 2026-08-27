import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const dataFile = path.join(dataDir, "welfare.json");

const welfareStatuses = ["Ny risk", "AI-granskad", "Under utredning", "Kontroll klar", "Avskriven", "Polisanmälan"];
const welfareDomains = ["Ekonomiskt bistånd", "Hemtjänst", "Personlig assistans", "Föreningsbidrag", "Leverantör/upphandling"];

let welfareStore = { cases: [], systems: [], payments: [], suppliers: [], controls: [] };

export function loadWelfareStore() {
  fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(dataFile)) {
    welfareStore = normalizeStore(JSON.parse(fs.readFileSync(dataFile, "utf8")));
    persist();
    return welfareStore;
  }

  welfareStore = normalizeStore(seedWelfareStore());
  persist();
  return welfareStore;
}

export function getWelfareOverview() {
  const cases = getWelfareCases();
  const highRiskCases = cases.filter((item) => item.riskScore >= 80);
  const openCases = cases.filter((item) => !["Kontroll klar", "Avskriven"].includes(item.status));
  const preventedAmount = cases
    .filter((item) => ["Kontroll klar", "Under utredning", "AI-granskad"].includes(item.status))
    .reduce((sum, item) => sum + item.amountAtRisk, 0);

  return {
    name: "Välfärdsbrott - demomiljö",
    purpose: "Visa hur en AI-agent kan förebygga och förhindra välfärdsbrott i kommunala processer.",
    totalCases: cases.length,
    openCases: openCases.length,
    highRiskCases: highRiskCases.length,
    preventedAmount,
    systems: welfareStore.systems,
    byDomain: groupCount(cases, "domain"),
    byStatus: groupCount(cases, "status"),
    exampleQuestions: [
      "Visa högriskärenden inom ekonomiskt bistånd.",
      "Kör agentanalys på VFB-2026-1001.",
      "Vilka kontrollåtgärder föreslås för föreningsbidrag?",
      "Sammanfatta riskerna per underliggande system.",
    ],
  };
}

export function getWelfareSystems() {
  return welfareStore.systems.map((system) => ({
    ...system,
    records: recordsForSystem(system.id),
  }));
}

export function getWelfareCases(filters = {}) {
  let result = [...welfareStore.cases];

  if (filters.domain) {
    result = result.filter((item) => item.domain.toLowerCase() === String(filters.domain).toLowerCase());
  }

  if (filters.status) {
    result = result.filter((item) => item.status.toLowerCase() === String(filters.status).toLowerCase());
  }

  if (filters.minimumRisk) {
    result = result.filter((item) => item.riskScore >= Number(filters.minimumRisk));
  }

  if (filters.query) {
    const query = String(filters.query).toLowerCase();
    result = result.filter((item) =>
      [item.caseNumber, item.domain, item.subject, item.counterparty, item.summary, item.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  return result.sort((a, b) => b.riskScore - a.riskScore || b.updatedAt.localeCompare(a.updatedAt));
}

export function getWelfareCase(caseNumber) {
  return welfareStore.cases.find((item) => item.caseNumber.toLowerCase() === String(caseNumber).toLowerCase());
}

export function runWelfareAgent(caseNumber) {
  const found = getWelfareCase(caseNumber);

  if (!found) {
    throw new Error(`Hittar inte välfärdsärende ${caseNumber}.`);
  }

  const analysis = buildAgentAnalysis(found);
  found.agentAnalysis = analysis;
  found.status = found.status === "Ny risk" ? "AI-granskad" : found.status;
  found.updatedAt = new Date().toISOString();
  found.notes.unshift(makeNote(`AI-agenten körde riskanalys: ${analysis.riskLevel}. ${analysis.summary}`, "Välfärdsagenten"));
  persist();
  return found;
}

export function updateWelfareCaseStatus(caseNumber, status, note) {
  if (!welfareStatuses.includes(status)) {
    throw new Error(`Ogiltig välfärdsstatus: ${status}.`);
  }

  const found = getWelfareCase(caseNumber);

  if (!found) {
    throw new Error(`Hittar inte välfärdsärende ${caseNumber}.`);
  }

  found.status = status;
  found.updatedAt = new Date().toISOString();

  if (note) {
    found.notes.unshift(makeNote(note, "Demo-handläggare"));
  }

  persist();
  return found;
}

export function addWelfareCaseNote(caseNumber, text, author = "Demo-handläggare") {
  const found = getWelfareCase(caseNumber);

  if (!found) {
    throw new Error(`Hittar inte välfärdsärende ${caseNumber}.`);
  }

  const note = makeNote(text, author);
  found.notes.unshift(note);
  found.updatedAt = note.createdAt;
  persist();
  return found;
}

export function getWelfareStatuses() {
  return welfareStatuses;
}

export function getWelfareDomains() {
  return welfareDomains;
}

function buildAgentAnalysis(caseItem) {
  const riskLevel = caseItem.riskScore >= 85 ? "Hög risk" : caseItem.riskScore >= 65 ? "Medelhög risk" : "Låg risk";
  const strongestIndicators = [...caseItem.indicators].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const recommendedActions = [...caseItem.recommendedActions];

  return {
    riskLevel,
    confidence: caseItem.riskScore >= 85 ? 0.91 : caseItem.riskScore >= 65 ? 0.78 : 0.62,
    summary: `${caseItem.domain}: ${strongestIndicators.map((item) => item.label).join(", ")}.`,
    reasoning: strongestIndicators.map((item) => item.description),
    recommendedActions,
    evidenceMap: caseItem.evidenceSystems.map((id) => {
      const system = welfareStore.systems.find((item) => item.id === id);
      return {
        system: system?.name || id,
        finding: evidenceFinding(caseItem, id),
      };
    }),
    decisionBoundary:
      "Agenten prioriterar kontroll och föreslår åtgärder. Slutlig bedömning och myndighetsbeslut görs av handläggare.",
    generatedAt: new Date().toISOString(),
  };
}

function evidenceFinding(caseItem, systemId) {
  const finding = caseItem.systemFindings?.[systemId];
  if (finding) {
    return finding;
  }

  return "Systemet innehåller uppgifter som bör verifieras mot ärendet innan beslut.";
}

function recordsForSystem(systemId) {
  if (systemId === "payments") {
    return welfareStore.payments;
  }

  if (systemId === "suppliers") {
    return welfareStore.suppliers;
  }

  if (systemId === "controls") {
    return welfareStore.controls;
  }

  return welfareStore.cases
    .filter((item) => item.evidenceSystems.includes(systemId))
    .map((item) => ({
      caseNumber: item.caseNumber,
      subject: item.subject,
      counterparty: item.counterparty,
      riskScore: item.riskScore,
      status: item.status,
    }));
}

function normalizeStore(input) {
  return {
    cases: (input.cases || []).map(normalizeCase),
    systems: input.systems || [],
    payments: input.payments || [],
    suppliers: input.suppliers || [],
    controls: input.controls || [],
  };
}

function normalizeCase(input) {
  return {
    caseNumber: input.caseNumber,
    domain: input.domain,
    subject: input.subject,
    counterparty: input.counterparty,
    status: input.status || "Ny risk",
    riskScore: Number(input.riskScore || 0),
    amountAtRisk: Number(input.amountAtRisk || 0),
    summary: input.summary || "",
    indicators: input.indicators || [],
    evidenceSystems: input.evidenceSystems || [],
    systemFindings: input.systemFindings || {},
    recommendedActions: input.recommendedActions || [],
    timeline: input.timeline || [],
    agentAnalysis: input.agentAnalysis || null,
    notes: input.notes || [],
    assignedTo: input.assignedTo || "Kontrollfunktionen",
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

function groupCount(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function persist() {
  fs.writeFileSync(dataFile, JSON.stringify(welfareStore, null, 2));
}

function makeNote(text, author) {
  return {
    id: `welfare-note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author,
    text,
    createdAt: new Date().toISOString(),
  };
}

function seedWelfareStore() {
  return {
    systems: [
      {
        id: "social",
        name: "Socialtjänstens verksamhetssystem",
        owner: "IFO",
        description: "Ansökningar, biståndsbeslut, hushållsbild och handläggningsnoteringar.",
        dataQuality: "Hög",
      },
      {
        id: "payments",
        name: "Ekonomisystem och utbetalningar",
        owner: "Ekonomi",
        description: "Utbetalningar, fakturor, attestkedjor och bankgiro/plusgiro.",
        dataQuality: "Hög",
      },
      {
        id: "population",
        name: "Folkbokförings- och adresskontroll",
        owner: "Kontaktcenter",
        description: "Adress, hushåll, flyttdatum och relationer från tillåtna kontrollkällor.",
        dataQuality: "Medel",
      },
      {
        id: "suppliers",
        name: "Leverantörs- och bolagskontroll",
        owner: "Upphandling",
        description: "Företrädare, ägarrelationer, F-skatt, bankkonto och tidigare avvikelser.",
        dataQuality: "Medel",
      },
      {
        id: "time",
        name: "Tidrapportering och utförarloggar",
        owner: "Vård och omsorg",
        description: "Utförd tid, scheman, geostämplar, brukarkoppling och fakturerad tid.",
        dataQuality: "Medel",
      },
      {
        id: "controls",
        name: "Kontroll- och utredningsjournal",
        owner: "Intern kontroll",
        description: "Riskpoäng, kontrollresultat, återkrav, polisanmälan och beslut om rutinförändring.",
        dataQuality: "Hög",
      },
    ],
    cases: [
      {
        caseNumber: "VFB-2026-1001",
        domain: "Ekonomiskt bistånd",
        subject: "Återkommande bistånd trots registrerad arbetsinkomst",
        counterparty: "Demo Person A",
        status: "Ny risk",
        riskScore: 92,
        amountAtRisk: 148500,
        summary:
          "Ansökan om ekonomiskt bistånd matchar flera månader med preliminär arbetsinkomst och ändrad hushållsbild.",
        evidenceSystems: ["social", "payments", "population", "controls"],
        systemFindings: {
          social: "Tre ansökningar saknar uppdaterad hushållsförsäkran.",
          payments: "Utbetalningar har fortsatt trots inkomstrapport i två perioder.",
          population: "Ny vuxen person på adressen sammanfaller med ansökningsperiod.",
          controls: "Liknande mönster gav återkrav i tidigare kontrollinsats.",
        },
        indicators: [
          {
            label: "Inkomstmatchning",
            weight: 38,
            description: "Registrerad arbetsinkomst över tröskelvärde under två ansökningsperioder.",
          },
          {
            label: "Hushållsändring",
            weight: 29,
            description: "Folkbokföringsuppgift tyder på ändrad hushållsbild som inte finns i ansökan.",
          },
          {
            label: "Återkommande kompletteringar",
            weight: 18,
            description: "Samma kompletteringsbrist förekommer i flera månader.",
          },
        ],
        recommendedActions: [
          "Begär inkomstspecifikation och kontoutdrag för aktuell period.",
          "Verifiera hushållsbild innan ny utbetalning.",
          "Pausa automatisk utbetalning tills handläggare har granskat underlag.",
        ],
        timeline: [
          "2026-08-05: Ansökan registrerad.",
          "2026-08-06: Utbetalning preliminärt planerad.",
          "2026-08-07: Agenten flaggade inkomst- och adressavvikelse.",
        ],
        assignedTo: "Kontrollteam IFO",
        createdAt: "2026-08-07T08:14:00+02:00",
        updatedAt: "2026-08-07T08:14:00+02:00",
        notes: [makeNote("Ärendet skapat från nattlig riskkörning med dumidata.", "System")],
      },
      {
        caseNumber: "VFB-2026-1002",
        domain: "Hemtjänst",
        subject: "Fakturerad tid överstiger beviljad och utförd tid",
        counterparty: "Omsorgspartner Demo AB",
        status: "AI-granskad",
        riskScore: 88,
        amountAtRisk: 236000,
        summary:
          "Utförare fakturerar återkommande mer tid än beviljat bistånd och loggad närvaro hos brukare.",
        evidenceSystems: ["time", "payments", "suppliers", "controls"],
        systemFindings: {
          time: "Geostämplar saknas för 21 procent av rapporterade besök.",
          payments: "Fakturor ligger 14-19 procent över jämförbara utförare.",
          suppliers: "Samma företrädare har två aktiva utförarbolag i kommunen.",
          controls: "Tidigare kontrollnotering om bristande signeringsrutiner.",
        },
        indicators: [
          {
            label: "Faktureringsavvikelse",
            weight: 34,
            description: "Fakturerad tid överstiger beviljad tid i flera ärenden.",
          },
          {
            label: "Saknade utförarloggar",
            weight: 31,
            description: "Besök saknar komplett tid- och platsverifiering.",
          },
          {
            label: "Bolagskoppling",
            weight: 14,
            description: "Koppling till närstående utförare bör granskas.",
          },
        ],
        recommendedActions: [
          "Jämför beviljad, utförd och fakturerad tid per brukare.",
          "Begär stickprov på signeringsunderlag.",
          "Skicka ärendet till avtalscontroller för leverantörsdialog.",
        ],
        timeline: ["2026-08-03: Faktura importerad.", "2026-08-04: Tidloggar matchade.", "2026-08-04: Agentanalys skapad."],
        assignedTo: "Avtalscontroller vård och omsorg",
        createdAt: "2026-08-04T06:30:00+02:00",
        updatedAt: "2026-08-04T06:30:00+02:00",
        notes: [makeNote("Agenten rekommenderar stickprov innan eventuell återbetalningsprocess.", "Välfärdsagenten")],
      },
      {
        caseNumber: "VFB-2026-1003",
        domain: "Föreningsbidrag",
        subject: "Samma aktivitetsunderlag används i flera ansökningar",
        counterparty: "Demo IF Ungdom",
        status: "Under utredning",
        riskScore: 76,
        amountAtRisk: 84500,
        summary:
          "Aktivitetslistor och medlemsantal avviker mot tidigare år och liknar underlag från annan förening.",
        evidenceSystems: ["payments", "population", "controls"],
        systemFindings: {
          payments: "Två bidragsutbetalningar avser överlappande aktivitetsperiod.",
          population: "Flera deltagare saknar kommunanknytning i urvalet.",
          controls: "Tidigare begäran om komplettering av närvarolistor.",
        },
        indicators: [
          {
            label: "Dubblettmönster",
            weight: 28,
            description: "Aktivitetsrader matchar annan ansökan med små textvariationer.",
          },
          {
            label: "Medlemsavvikelse",
            weight: 23,
            description: "Medlemsantalet ökar kraftigt utan motsvarande historik.",
          },
          {
            label: "Överlappande period",
            weight: 12,
            description: "Ansökan överlappar tidigare utbetalad period.",
          },
        ],
        recommendedActions: [
          "Begär originalunderlag för aktiviteter och medlemsregister.",
          "Kontrollera dubbelfinansiering mot kultur- och fritidsnämndens regler.",
          "Dokumentera bedömning i kontrolljournalen.",
        ],
        timeline: ["2026-07-28: Ansökan inkommen.", "2026-07-30: Dubblettkontroll körd.", "2026-08-01: Handläggare tog över."],
        assignedTo: "Kultur- och fritidsförvaltningen",
        createdAt: "2026-08-01T10:00:00+02:00",
        updatedAt: "2026-08-15T15:30:00+02:00",
        notes: [makeNote("Underlag begärt från föreningen i demoärendet.", "Handläggare")],
      },
      {
        caseNumber: "VFB-2026-1004",
        domain: "Leverantör/upphandling",
        subject: "Onormalt pris och möjlig koppling mellan anbudsgivare",
        counterparty: "Stadstjänst Demo AB",
        status: "Ny risk",
        riskScore: 83,
        amountAtRisk: 412000,
        summary:
          "Anbudsmönster, adresskoppling och återkommande direktupphandlingar ger förhöjd risk för otillbörlig påverkan.",
        evidenceSystems: ["suppliers", "payments", "controls"],
        systemFindings: {
          suppliers: "Två anbudsgivare delar historisk adress och tidigare styrelsesuppleant.",
          payments: "Flera direktupphandlingar ligger strax under beloppsgräns.",
          controls: "Intern kontroll har markerat behov av jävsgenomgång.",
        },
        indicators: [
          {
            label: "Närståendekoppling",
            weight: 30,
            description: "Bolagsföreträdare har historiska kopplingar mellan anbudsgivare.",
          },
          {
            label: "Tröskelvärdesmönster",
            weight: 27,
            description: "Fakturor och beställningar återkommer strax under intern kontrollgräns.",
          },
          {
            label: "Prisavvikelse",
            weight: 16,
            description: "Vinnande pris avviker från marknadsjämförelse och tidigare ramavtal.",
          },
        ],
        recommendedActions: [
          "Starta fördjupad leverantörskontroll.",
          "Kontrollera jäv och attestkedja.",
          "Samla fakturor och beställningar för stickprov.",
        ],
        timeline: ["2026-08-10: Upphandlingsdata importerad.", "2026-08-11: Bolagskoppling hittad."],
        assignedTo: "Upphandling och intern kontroll",
        createdAt: "2026-08-11T09:45:00+02:00",
        updatedAt: "2026-08-11T09:45:00+02:00",
        notes: [makeNote("Riskflagga gäller endast demo och ska inte tolkas som faktisk misstanke.", "System")],
      },
      {
        caseNumber: "VFB-2026-1005",
        domain: "Personlig assistans",
        subject: "Dubbelrapportering av assistanstimmar",
        counterparty: "Assistans Demo Ekonomisk förening",
        status: "Kontroll klar",
        riskScore: 69,
        amountAtRisk: 97500,
        summary:
          "Rapporterade pass överlappar för två assistenter och samma brukare under flera helger.",
        evidenceSystems: ["time", "payments", "suppliers", "controls"],
        systemFindings: {
          time: "Överlappande pass hittades i schemaimport.",
          payments: "Kreditfaktura skapad i demo efter kontroll.",
          suppliers: "Leverantören saknar andra riskmarkeringar.",
          controls: "Kontroll avslutad med rutinförbättring.",
        },
        indicators: [
          {
            label: "Överlappande pass",
            weight: 24,
            description: "Två assistenter är rapporterade samtidigt där bara en insats var beslutad.",
          },
          {
            label: "Helgmönster",
            weight: 16,
            description: "Avvikelsen återkommer främst under helger.",
          },
        ],
        recommendedActions: [
          "Följ upp att korrigerad faktura är bokförd.",
          "Lägg regel för automatisk dubbelpasskontroll i kommande körningar.",
        ],
        timeline: ["2026-07-12: Avvikelse flaggad.", "2026-07-15: Leverantör kontaktad.", "2026-07-25: Kontroll klar."],
        assignedTo: "Omsorgsförvaltningen",
        createdAt: "2026-07-12T11:20:00+02:00",
        updatedAt: "2026-07-25T13:10:00+02:00",
        notes: [makeNote("Demo visar hur förebyggande kontroll kan leda till korrigerad faktura.", "Välfärdsagenten")],
      },
    ],
    payments: [
      { id: "PAY-9101", domain: "Ekonomiskt bistånd", recipient: "Demo Person A", amount: 18500, period: "2026-08", status: "Pausad för kontroll" },
      { id: "PAY-9102", domain: "Hemtjänst", recipient: "Omsorgspartner Demo AB", amount: 236000, period: "2026-07", status: "Stickprov krävs" },
      { id: "PAY-9103", domain: "Föreningsbidrag", recipient: "Demo IF Ungdom", amount: 84500, period: "2026 H2", status: "Komplettering begärd" },
      { id: "PAY-9104", domain: "Upphandling", recipient: "Stadstjänst Demo AB", amount: 412000, period: "2026 Q3", status: "Attestgranskning" },
    ],
    suppliers: [
      { id: "ORG-501", name: "Omsorgspartner Demo AB", risk: "Hög", finding: "Avvikande fakturerad tid och saknade loggar." },
      { id: "ORG-502", name: "Stadstjänst Demo AB", risk: "Hög", finding: "Historisk adresskoppling till annan anbudsgivare." },
      { id: "ORG-503", name: "Assistans Demo Ekonomisk förening", risk: "Medel", finding: "Dubbelpass hittat men korrigerad faktura finns." },
    ],
    controls: [
      { id: "CTRL-01", name: "Inkomstmatchning före utbetalning", coverage: "Ekonomiskt bistånd", status: "Aktiv" },
      { id: "CTRL-02", name: "Beviljad/utförd/fakturerad tid", coverage: "Hemtjänst och assistans", status: "Aktiv" },
      { id: "CTRL-03", name: "Dubblettkontroll av bidragsunderlag", coverage: "Föreningsbidrag", status: "Pilot" },
      { id: "CTRL-04", name: "Leverantörskoppling och tröskelvärden", coverage: "Upphandling", status: "Pilot" },
    ],
  };
}
