# Bygglov 2.0 - demoarendesystem med MCP

Det här är ett lokalt demoärendesystem för att visa hur en Copilot Studio-agent kan arbeta mot tredjepartssystem via MCP.

Webbgränssnittet har två klickbara demoflikar:

- **Bygglov 2.0** - bygglovsärenden med handlingar, regelverkskontroller och statusuppdatering.
- **Välfärdsbrott** - dumidata för kommunala riskärenden, underliggande system och en simulerad AI-agent som föreslår kontrollåtgärder.

## Starta

```powershell
cd "C:\Users\anadolf\OneDrive - Microsoft\Dokument\Microsoft Scout\arendesystem-mcp-demo"
npm start
```

Webbgränssnitt: `http://localhost:3978`  
MCP-endpoint: `http://localhost:3978/mcp`  
Hälsokontroll: `http://localhost:3978/health`

## Datakälla

Första gången appen startar seedas `data/cases.json` från den lokala Bygglov-demomiljön:

- `bygglov_sharepoint_cases`
- `bygglov_status_cases`
- `bygglov_approved_cases`
- `Bygglov 2.0\Bygglov_2_0_demo\output\sharepoint_cases`
- `Bygglov 2.0\Bygglov_2_0_demo\sample_incoming_case.json`

SharePoint-källan som demon motsvarar:

`https://m365cpi70484186.sharepoint.com/sites/Almedalen/Delade%20dokument/Forms/AllItems.aspx?web=1&FolderCTID=0x0120009AA01829982188468E2F1A4CC2D5DFB6&id=%2Fsites%2FAlmedalen%2FDelade%20dokument%2FBygglov`

Om du vill seeda om från källmapparna: stoppa servern, ta bort `data\cases.json` och starta igen.

Välfärdsbrottsfliken seedas första gången till `data\welfare.json`. Ta bort den filen om du vill återställa välfärdsbrotts-demon till ursprunglig dumidata.

## MCP-verktyg

Servern exponerar dessa verktyg:

- `bygglov_demo_overview`
- `bygglov_list_cases`
- `bygglov_get_case`
- `bygglov_summarize_case`
- `bygglov_missing_documents`
- `bygglov_update_status`
- `bygglov_add_note`
- `bygglov_create_case`
- `valfardsbrott_demo_overview`
- `valfardsbrott_list_systems`
- `valfardsbrott_list_cases`
- `valfardsbrott_get_case`
- `valfardsbrott_run_agent_analysis`
- `valfardsbrott_update_status`
- `valfardsbrott_add_note`

## Koppla till Copilot Studio

För lokal demo behöver MCP-endpointen vara nåbar från Copilot Studio, exempelvis via Microsoft Dev Tunnels eller motsvarande säker tunnel.

Exempel:

```powershell
devtunnel host -p 3978 --allow-anonymous
```

Använd sedan tunnelns publika HTTPS-adress med `/mcp`, exempelvis:

`https://<din-tunnel>.devtunnels.ms/mcp`

## Demoidéer för agenten

- "Visa status för BYGG-2026-0001."
- "Vilka ärenden väntar på komplettering?"
- "Sammanfatta BYGG-2026-20260616-19001 och föreslå nästa steg."
- "Lägg en intern notering på BYGG-2026-20260616-19001."
- "Ändra status till Grannhörande/remiss."
- "Visa högriskärenden inom välfärdsbrott."
- "Kör agentanalys på VFB-2026-1001."
- "Vilka underliggande system används i välfärdsbrotts-demon?"
