import cors from "cors";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  addCaseNote,
  createCase,
  demoOverview,
  getCase,
  getCases,
  loadStore,
  summarizeCase,
  updateComplianceCheck,
  updateCaseStatus,
  updateDocumentReview,
} from "./data.js";
import { createMcpServer } from "./mcp.js";
import {
  addWelfareCaseNote,
  getWelfareCase,
  getWelfareCases,
  getWelfareDomains,
  getWelfareOverview,
  getWelfareStatuses,
  getWelfareSystems,
  loadWelfareStore,
  runWelfareAgent,
  updateWelfareCaseStatus,
} from "./welfareData.js";

const app = express();
const port = Number(process.env.PORT || 3978);

loadStore();
loadWelfareStore();

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization", "mcp-session-id", "mcp-protocol-version"],
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "bygglov-arendesystem-demo", port });
});

app.get("/api/overview", (_req, res) => {
  res.json(demoOverview());
});

app.get("/api/cases", (req, res) => {
  res.json(getCases({ status: req.query.status, query: req.query.query }));
});

app.post("/api/cases", (req, res, next) => {
  try {
    res.status(201).json(createCase(req.body));
  } catch (error) {
    next(error);
  }
});

app.get("/api/cases/:caseNumber", (req, res) => {
  const found = getCase(req.params.caseNumber);
  if (!found) {
    res.status(404).json({ error: `Hittar inte arende ${req.params.caseNumber}.` });
    return;
  }
  res.json(found);
});

app.get("/api/cases/:caseNumber/summary", (req, res, next) => {
  try {
    res.json(summarizeCase(req.params.caseNumber));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/cases/:caseNumber/status", (req, res, next) => {
  try {
    res.json(updateCaseStatus(req.params.caseNumber, req.body.status, req.body.note));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/cases/:caseNumber/documents/:documentName", (req, res, next) => {
  try {
    res.json(
      updateDocumentReview(
        req.params.caseNumber,
        decodeURIComponent(req.params.documentName),
        req.body.reviewStatus,
        req.body.comment,
      ),
    );
  } catch (error) {
    next(error);
  }
});

app.patch("/api/cases/:caseNumber/compliance/:checkId", (req, res, next) => {
  try {
    res.json(updateComplianceCheck(req.params.caseNumber, req.params.checkId, req.body.status, req.body.comment));
  } catch (error) {
    next(error);
  }
});

app.post("/api/cases/:caseNumber/notes", (req, res, next) => {
  try {
    res.status(201).json(addCaseNote(req.params.caseNumber, req.body.text, req.body.author || "Andreas Adolfsson via Bygglov 2.0"));
  } catch (error) {
    next(error);
  }
});

app.get("/api/welfare/overview", (_req, res) => {
  res.json(getWelfareOverview());
});

app.get("/api/welfare/systems", (_req, res) => {
  res.json(getWelfareSystems());
});

app.get("/api/welfare/meta", (_req, res) => {
  res.json({
    statuses: getWelfareStatuses(),
    domains: getWelfareDomains(),
  });
});

app.get("/api/welfare/cases", (req, res) => {
  res.json(
    getWelfareCases({
      domain: req.query.domain,
      status: req.query.status,
      query: req.query.query,
      minimumRisk: req.query.minimumRisk,
    }),
  );
});

app.get("/api/welfare/cases/:caseNumber", (req, res) => {
  const found = getWelfareCase(req.params.caseNumber);
  if (!found) {
    res.status(404).json({ error: `Hittar inte välfärdsärende ${req.params.caseNumber}.` });
    return;
  }
  res.json(found);
});

app.post("/api/welfare/cases/:caseNumber/analyze", (req, res, next) => {
  try {
    res.json(runWelfareAgent(req.params.caseNumber));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/welfare/cases/:caseNumber/status", (req, res, next) => {
  try {
    res.json(updateWelfareCaseStatus(req.params.caseNumber, req.body.status, req.body.note));
  } catch (error) {
    next(error);
  }
});

app.post("/api/welfare/cases/:caseNumber/notes", (req, res, next) => {
  try {
    res.status(201).json(addWelfareCaseNote(req.params.caseNumber, req.body.text, req.body.author || "Demo-handläggare"));
  } catch (error) {
    next(error);
  }
});

async function handleMcpRequest(req, res) {
  const mcpServer = createMcpServer();
  const mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableDnsRebindingProtection: false,
  });

  try {
    await mcpServer.connect(mcpTransport);
    await mcpTransport.handleRequest(req, res, req.body);
    res.on("close", () => {
      mcpTransport.close();
      mcpServer.close();
    });
  } catch (error) {
    console.error("MCP request failed:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
}

app.post("/mcp", handleMcpRequest);
app.get("/mcp", handleMcpRequest);
app.delete("/mcp", handleMcpRequest);

app.use((error, _req, res, _next) => {
  res.status(400).json({ error: error.message });
});

app.listen(port, () => {
  console.log(`Bygglov arendesystem: http://localhost:${port}`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
});
