# Deploy av Bygglov 2.0 ärendesystem/MCP till Render

Det här sätter upp en **parallell hostad demo**. Den befintliga lokala/devtunnel-lösningen lämnas kvar tills den nya är provkörd och godkänd.

## Vad som deployas

- Webbgränssnitt: `/`
- Hälsokontroll: `/health`
- REST API: `/api/cases`, `/api/overview`, med flera
- MCP-endpoint: `/mcp`

## Viktigt om data

`data/cases.json` innehåller demoärenden och följer med i deployen.

På Render Free är filsystemet normalt inte permanent över redeploy/restart. Det betyder:

- noteringar/statusändringar fungerar under körning
- ändringar kan återställas vid redeploy/restart
- om permanens krävs senare bör vi lägga datan i Supabase/Neon/Turso eller annan gratis databas

Det här är okej för parallell demo/test.

## Förbered GitHub-repo

I mappen:

```powershell
cd "C:\Users\anadolf\OneDrive - Microsoft\Dokument\Microsoft Scout\arendesystem-mcp-demo"
```

Om mappen inte redan är ett repo:

```powershell
git init
git add .
git commit -m "Initial Bygglov MCP demo for Render"
```

Skapa ett privat eller publikt repo på GitHub och pusha:

```powershell
git branch -M main
git remote add origin https://github.com/<owner>/bygglov-arendesystem-mcp-demo.git
git push -u origin main
```

## Skapa tjänst i Render

1. Gå till `https://render.com`.
2. Skapa konto/logga in.
3. Välj **New +** → **Web Service**.
4. Koppla GitHub-repot.
5. Render bör läsa `render.yaml` automatiskt.

Om du sätter manuellt:

| Inställning | Värde |
|---|---|
| Runtime | Node |
| Plan | Free |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health check path | `/health` |
| Node version | `20` |

## Verifiera Render-URL

När deployen är klar får du en URL, till exempel:

```text
https://bygglov-arendesystem-mcp-demo.onrender.com
```

Testa:

```powershell
Invoke-RestMethod https://bygglov-arendesystem-mcp-demo.onrender.com/health
Invoke-RestMethod https://bygglov-arendesystem-mcp-demo.onrender.com/api/overview
```

MCP URL för Copilot Studio:

```text
https://bygglov-arendesystem-mcp-demo.onrender.com/mcp
```

## Testa MCP

PowerShell-test:

```powershell
$headers = @{ Accept = "application/json, text/event-stream" }
$body = @{
  jsonrpc = "2.0"
  id = 1
  method = "tools/list"
  params = @{}
} | ConvertTo-Json -Depth 10

Invoke-WebRequest `
  -Uri "https://bygglov-arendesystem-mcp-demo.onrender.com/mcp" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $body
```

Svaret ska innehålla verktyg som:

- `bygglov_get_case`
- `bygglov_find_cases`
- `bygglov_summarize_case`
- `bygglov_add_note`

## Koppla i Copilot Studio

Skapa helst en **ny MCP connector** för den hostade varianten, så den gamla devtunnel-connectorn kan ligga kvar under test.

Ny MCP-server-URL:

```text
https://<render-app>.onrender.com/mcp
```

Efter att connectorn är skapad:

1. Öppna agenten **Bygglov 2.0**.
2. Gå till **Tools**.
3. Lägg till den nya MCP-connectorn.
4. Kontrollera att `bygglov_add_note` och övriga verktyg visas.
5. Testa i testchatten:

```text
Kontrollera ärende BYGG-2026-20260617-082958 i ärendesystemet och sammanfatta status, saknade handlingar, noteringar och nästa steg.
```

Testa även skrivning:

```text
Lägg en intern notering i ärende BYGG-2026-20260617-082958: Test från Render MCP.
```

## Behåll den gamla lösningen tills vidare

Byt inte bort den gamla connectorn förrän den nya fungerar i demo.

Gammal lokal/devtunnel:

```text
https://49q5ct50-3978.euw.devtunnels.ms/mcp
```

Ny Render:

```text
https://<render-app>.onrender.com/mcp
```

När Render-varianten är godkänd kan den gamla connectorn tas bort eller inaktiveras.

