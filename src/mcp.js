import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addCaseNote,
  createCase,
  demoOverview,
  findCaseMatches,
  getCase,
  getCases,
  getLatestNotes,
  reviewReadiness,
  summarizeCase,
  updateComplianceCheck,
  updateCaseStatus,
  updateDocumentReview,
} from "./data.js";
import {
  addWelfareCaseNote,
  getWelfareCase,
  getWelfareCases,
  getWelfareOverview,
  getWelfareSystems,
  runWelfareAgent,
  updateWelfareCaseStatus,
} from "./welfareData.js";

const statusValues = [
  "Nytt arende",
  "Vantar pa komplettering",
  "Under granskning",
  "Grannhorande/remiss",
  "Startbesked kravs",
  "Beviljat med villkor",
  "Godkand",
  "Beviljat",
  "Avslag",
  "Avskrivet/atertaget",
  "Slutbesked",
];

const documentReviewStatuses = ["Ej granskad", "Inkommen", "Godkand", "Saknas", "Behover kompletteras", "Ej relevant"];
const complianceStatuses = ["Ej granskad", "Godkand", "Avvikelse", "Behover granskas", "Ej relevant"];
const welfareStatuses = ["Ny risk", "AI-granskad", "Under utredning", "Kontroll klar", "Avskriven", "Polisanmälan"];

export function createMcpServer() {
  const server = new McpServer({
    name: "bygglov-arendesystem-demo",
    version: "1.0.0",
  });

  server.registerTool(
    "bygglov_demo_overview",
    {
      title: "Demooversikt",
      description: "Beskriver demoarendesystemet, SharePoint-kallan och forslag pa agentfragor.",
    },
    async () => jsonResult(demoOverview()),
  );

  server.registerTool(
    "bygglov_list_cases",
    {
      title: "Lista bygglovsarenden",
      description: "Hamta bygglovsarenden fran demoarendesystemet. Filtrera pa status eller fritext.",
      inputSchema: {
        status: z.string().optional(),
        query: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ status, query, limit }) => jsonResult(getCases({ status, query }).slice(0, limit)),
  );

  server.registerTool(
    "bygglov_get_case",
    {
      title: "Hamta bygglovsarende",
      description:
        "Hamta alla detaljer for ett specifikt arende. Accepterar komplett arendenummer eller unik del av arendenumret, t.ex. 082958.",
      inputSchema: {
        caseNumber: z.string().describe("Komplett eller ofullstandigt arendenummer, exempelvis BYGG-2026-0001 eller 082958."),
      },
    },
    async ({ caseNumber }) => {
      const found = getCase(caseNumber);
      if (found) {
        return jsonResult(found);
      }

      const matches = findCaseMatches(caseNumber, 20);
      if (matches.length > 1) {
        return errorResult(
          `Flera arenden matchar "${caseNumber}". Be anvandaren precisera arendenummer. Traffar: ${matches
            .map((item) => item.caseNumber)
            .join(", ")}.`,
        );
      }

      return errorResult(`Hittar inte arende ${caseNumber}.`);
    },
  );

  server.registerTool(
    "bygglov_find_cases",
    {
      title: "Sok bygglovsarenden",
      description:
        "Soker arenden med komplett eller ofullstandigt arendenummer. Anvand nar anvandaren anger en kort del som 082958 eller om flera traffar kan finnas.",
      inputSchema: {
        query: z.string().describe("Komplett eller ofullstandigt arendenummer eller annan soktext."),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({ query, limit }) => jsonResult(findCaseMatches(query, limit)),
  );

  server.registerTool(
    "bygglov_summarize_case",
    {
      title: "Sammanfatta bygglovsarende",
      description: "Returnerar en kort agentsammanfattning med status, kompletteringsbehov och nasta steg.",
      inputSchema: {
        caseNumber: z.string(),
      },
    },
    async ({ caseNumber }) => withErrorHandling(() => summarizeCase(caseNumber)),
  );

  server.registerTool(
    "bygglov_missing_documents",
    {
      title: "Visa saknade handlingar",
      description: "Returnerar saknade handlingar och forklaring for ett arende.",
      inputSchema: {
        caseNumber: z.string(),
      },
    },
    async ({ caseNumber }) =>
      withErrorHandling(() => {
        const found = getCase(caseNumber);
        if (!found) {
          throw new Error(`Hittar inte arende ${caseNumber}.`);
        }
        return {
          caseNumber: found.caseNumber,
          missingInformation: found.missingInformation,
          guidance:
            found.missingInformation.length > 0
              ? "Begär komplettering innan fortsatt handläggning."
              : "Inga saknade handlingar ar registrerade i demoarendesystemet.",
        };
      }),
  );

  server.registerTool(
    "bygglov_review_checklist",
    {
      title: "Visa handlaggningskontroller",
      description: "Returnerar handlingars granskningsstatus och regelverkskontroller for ett arende.",
      inputSchema: {
        caseNumber: z.string(),
      },
    },
    async ({ caseNumber }) =>
      withErrorHandling(() => {
        const found = getCase(caseNumber);
        if (!found) {
          throw new Error(`Hittar inte arende ${caseNumber}.`);
        }

        return {
          caseNumber: found.caseNumber,
          documents: found.documents,
          complianceChecks: found.complianceChecks,
        };
      }),
  );

  server.registerTool(
    "bygglov_review_readiness",
    {
      title: "Kontrollera om arendet kan godkannas",
      description:
        "Kontrollerar om alla handlingar och regelverkskontroller ar Godkand eller Ej relevant innan arendet kan markeras som godkant/beviljat.",
      inputSchema: {
        caseNumber: z.string(),
      },
    },
    async ({ caseNumber }) => withErrorHandling(() => reviewReadiness(caseNumber)),
  );

  server.registerTool(
    "bygglov_update_status",
    {
      title: "Uppdatera arendestatus",
      description: "Andrar status pa ett bygglovsarende och kan samtidigt lagga till en intern notering.",
      inputSchema: {
        caseNumber: z.string(),
        status: z.enum(statusValues),
        note: z.string().optional(),
      },
    },
    async ({ caseNumber, status, note }) => withErrorHandling(() => updateCaseStatus(caseNumber, status, note)),
  );

  server.registerTool(
    "bygglov_update_document_review",
    {
      title: "Uppdatera handlingsgranskning",
      description: "Markerar en handling som exempelvis Godkand, Saknas, Behover kompletteras eller Ej relevant.",
      inputSchema: {
        caseNumber: z.string(),
        documentName: z.string(),
        reviewStatus: z.enum(documentReviewStatuses),
        comment: z.string().optional(),
      },
    },
    async ({ caseNumber, documentName, reviewStatus, comment }) =>
      withErrorHandling(() => updateDocumentReview(caseNumber, documentName, reviewStatus, comment)),
  );

  server.registerTool(
    "bygglov_update_compliance_check",
    {
      title: "Uppdatera regelverkskontroll",
      description: "Markerar en regelverks- eller handlaggningskontroll som Godkand, Avvikelse, Behover granskas eller Ej relevant.",
      inputSchema: {
        caseNumber: z.string(),
        checkId: z.string().describe("Kontrollpunktens id, exempelvis pbl, detaljplan eller grannhorande."),
        status: z.enum(complianceStatuses),
        comment: z.string().optional(),
      },
    },
    async ({ caseNumber, checkId, status, comment }) =>
      withErrorHandling(() => updateComplianceCheck(caseNumber, checkId, status, comment)),
  );

  server.registerTool(
    "bygglov_add_note",
    {
      title: "Lagg till arendenotering",
      description: "Lagger till en intern notering pa ett arende.",
      inputSchema: {
        caseNumber: z.string(),
        text: z.string().min(1),
        author: z.string().default("Andreas Adolfsson via Bygglov 2.0"),
      },
    },
    async ({ caseNumber, text, author }) => withErrorHandling(() => addCaseNote(caseNumber, text, author)),
  );

  server.registerTool(
    "bygglov_latest_notes",
    {
      title: "Hamta senaste noteringar",
      description: "Returnerar de senaste arendenoteringarna for ett bygglovsarende.",
      inputSchema: {
        caseNumber: z.string(),
        limit: z.number().int().min(1).max(20).default(5),
      },
    },
    async ({ caseNumber, limit }) => withErrorHandling(() => getLatestNotes(caseNumber, limit)),
  );

  server.registerTool(
    "bygglov_create_case",
    {
      title: "Skapa bygglovsarende",
      description: "Skapar ett nytt demoarende enligt Bygglov 2.0-formatet.",
      inputSchema: {
        caseNumber: z.string().optional(),
        applicant: z.string(),
        from: z.string().email().optional(),
        subject: z.string().optional(),
        propertyDesignation: z.string(),
        propertyAddress: z.string().optional(),
        measure: z.string(),
        status: z.enum(statusValues).default("Nytt arende"),
        attachments: z.array(z.string()).default([]),
        missingInformation: z.array(z.string()).default([]),
      },
    },
    async (input) => withErrorHandling(() => createCase(input)),
  );

  server.registerTool(
    "valfardsbrott_demo_overview",
    {
      title: "Välfärdsbrott demoöversikt",
      description: "Beskriver välfärdsbrotts-demon, underliggande system, risklägen och exempel på agentfrågor.",
    },
    async () => jsonResult(getWelfareOverview()),
  );

  server.registerTool(
    "valfardsbrott_list_systems",
    {
      title: "Lista underliggande välfärdssystem",
      description: "Visar demodata från socialtjänst, ekonomi, folkbokföring, leverantörskontroll, tidloggar och kontrolljournal.",
    },
    async () => jsonResult(getWelfareSystems()),
  );

  server.registerTool(
    "valfardsbrott_list_cases",
    {
      title: "Lista välfärdsbrottsärenden",
      description: "Hämtar riskärenden. Filtrera på domän, status, fritext eller minsta riskpoäng.",
      inputSchema: {
        domain: z.string().optional(),
        status: z.string().optional(),
        query: z.string().optional(),
        minimumRisk: z.number().int().min(0).max(100).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ domain, status, query, minimumRisk, limit }) =>
      jsonResult(getWelfareCases({ domain, status, query, minimumRisk }).slice(0, limit)),
  );

  server.registerTool(
    "valfardsbrott_get_case",
    {
      title: "Hämta välfärdsbrottsärende",
      description: "Hämtar komplett riskärende med indikatorer, systemfynd, rekommenderade åtgärder och noteringar.",
      inputSchema: {
        caseNumber: z.string().describe("Ärendenummer, exempelvis VFB-2026-1001."),
      },
    },
    async ({ caseNumber }) =>
      withErrorHandling(() => {
        const found = getWelfareCase(caseNumber);
        if (!found) {
          throw new Error(`Hittar inte välfärdsärende ${caseNumber}.`);
        }
        return found;
      }),
  );

  server.registerTool(
    "valfardsbrott_run_agent_analysis",
    {
      title: "Kör välfärdsbrottsagent",
      description: "Simulerar agentens riskanalys, prioriterar kontrollåtgärder och uppdaterar ärendet med en intern notering.",
      inputSchema: {
        caseNumber: z.string(),
      },
    },
    async ({ caseNumber }) => withErrorHandling(() => runWelfareAgent(caseNumber)),
  );

  server.registerTool(
    "valfardsbrott_update_status",
    {
      title: "Uppdatera välfärdsärendestatus",
      description: "Ändrar status på ett välfärdsbrottsärende och kan lägga till en intern notering.",
      inputSchema: {
        caseNumber: z.string(),
        status: z.enum(welfareStatuses),
        note: z.string().optional(),
      },
    },
    async ({ caseNumber, status, note }) => withErrorHandling(() => updateWelfareCaseStatus(caseNumber, status, note)),
  );

  server.registerTool(
    "valfardsbrott_add_note",
    {
      title: "Lägg till välfärdsnotering",
      description: "Lägger till en intern notering på ett välfärdsbrottsärende.",
      inputSchema: {
        caseNumber: z.string(),
        text: z.string().min(1),
        author: z.string().default("Demo-handläggare"),
      },
    },
    async ({ caseNumber, text, author }) => withErrorHandling(() => addWelfareCaseNote(caseNumber, text, author)),
  );

  return server;
}

function withErrorHandling(callback) {
  try {
    return jsonResult(callback());
  } catch (error) {
    return errorResult(error.message);
  }
}

function jsonResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(message) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  };
}
