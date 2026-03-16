import { useState } from "react";
import axios from "axios";

type ExpertiseTier = "beginner" | "intermediate" | "expert";

type Stage = "stage1" | "stage2" | "stage3" | "stage5";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

async function postWebhook(eventType: string, payload: any) {
  const res = await axios.post(`${API_BASE}/webhook/vibesecure`, { eventType, payload });
  return res.data;
}

function App() {
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("idle");
  const [expertise, setExpertise] = useState<ExpertiseTier>("beginner");
  const [activeStage, setActiveStage] = useState<Stage>("stage1");

  const [contextForm, setContextForm] = useState({
    projectName: "Customer API",
    description: "Secure user profile service",
    language: "TypeScript",
    deployment: "AWS Lambda",
    compliance: "OWASP Top 10"
  });

  const [threats, setThreats] = useState<string[]>([]);
  const [selectedThreats, setSelectedThreats] = useState<string[]>([]);
  const [threatAnalysis, setThreatAnalysis] = useState<string[]>([]);
  const [codeOutput, setCodeOutput] = useState("// Generated code will appear here");
  const [codeAnalysis, setCodeAnalysis] = useState<string[]>([]);
  const [uncertaintyFlags, setUncertaintyFlags] = useState<string[]>([]);
  const [handoffSummary, setHandoffSummary] = useState<any>(null);

  const createSession = async () => {
    const id = `session-${Date.now()}`;
    try {
      await postWebhook("session:create", { sessionId: id, user: "dev", expertiseTier: expertise });
      setSessionId(id);
      setStatus("Session created");
    } catch {
      setStatus("Failed to create session");
    }
  };

  const saveContext = async () => {
    if (!sessionId) return setStatus("Create session first");
    await postWebhook("stage:update", { sessionId, stage: "context", data: contextForm });
    setStatus("Stage 1 context saved");

    const threatResult = await postWebhook("analyze:threat", { context: contextForm });
    const inferredThreats: string[] = Array.isArray(threatResult.analysis)
      ? threatResult.analysis.map((item: any) => `${item.cwe}: ${item.threat}`)
      : ["CWE-20: Input validation"];
    setThreats(inferredThreats);
    setSelectedThreats([inferredThreats[0]]);
    setThreatAnalysis(inferredThreats);

    setActiveStage("stage2");
  };

  const confirmThreats = async () => {
    if (!sessionId) return setStatus("Create session first");
    await postWebhook("stage:complete", { sessionId, stage: "threat", results: { threats: selectedThreats } });
    setStatus("Threat mapping confirmed");
    setActiveStage("stage3");
    setCodeOutput(`// Generated secure endpoint example\nimport express from 'express';\nconst app = express();\napp.use(express.json());\napp.post('/register', (req, res) => {\n  const { username, password } = req.body;\n  // Input validation\n  if (!username || !password) return res.status(400).json({ error: 'missing fields' });\n  // Parameterized query\n  const stmt = 'INSERT INTO users (username, password) VALUES (?, ?)';\n  // ... execute safely ...\n  res.status(201).json({ success: true });\n});`);
    setUncertaintyFlags(["UNCERTAIN: Encryption method for stored credentials", "UNCERTAIN: Session token expiry policy"]);
  };

  const finalizeGeneration = async () => {
    if (!sessionId) return setStatus("Create session first");
    const payload = { code: codeOutput };
    const codeIngest = await postWebhook("analyze:code", payload);
    const codeFindings: string[] = Array.isArray(codeIngest.findings)
      ? codeIngest.findings.map((f: any) => `${f.cwe}: ${f.message} (line ${f.line})`)
      : [];
    setCodeAnalysis(codeFindings);

    await postWebhook("stage:complete", { sessionId, stage: "generation", results: { code: codeOutput, flags: uncertaintyFlags, analysis: codeFindings } });
    setStatus("Stage 3 complete");
    setActiveStage("stage5");
    setHandoffSummary({
      sessionId,
      context: contextForm,
      threats: selectedThreats,
      threatAnalysis,
      code: codeOutput,
      codeAnalysis: codeFindings,
      uncertaintyFlags,
      recommendedChecks: ["Verify dependency versions", "Run Semgrep scan", "Rotate credentials"]
    });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(handoffSummary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessionId || "vibesecure"}-handoff.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <h1>VibeSecure Production Workflow</h1>
      <p>Webhook backend: {API_BASE}</p>

      <section style={{ marginBottom: 16 }}>
        <label>Expertise tier: </label>
        <select value={expertise} onChange={(e) => setExpertise(e.target.value as ExpertiseTier)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="expert">Expert</option>
        </select>
        <button style={{ marginLeft: 8 }} onClick={createSession}>Create Session</button>
        <span style={{ marginLeft: 10 }}><strong>Session:</strong> {sessionId || "none"}</span>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}><strong>Stage Progress:</strong> {activeStage}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={activeStage !== "stage1"} onClick={() => setActiveStage("stage1")}>Stage 1</button>
          <button disabled={activeStage !== "stage2"} onClick={() => setActiveStage("stage2")}>Stage 2</button>
          <button disabled={activeStage !== "stage3"} onClick={() => setActiveStage("stage3")}>Stage 3</button>
          <button disabled={activeStage !== "stage5"} onClick={() => setActiveStage("stage5")}>Stage 5</button>
        </div>
      </section>

      {activeStage === "stage1" && (
        <section style={{ marginBottom: 20 }}>
          <h2>Stage 1: Context Elicitation</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label>Project name<input value={contextForm.projectName} onChange={(e) => setContextForm({ ...contextForm, projectName: e.target.value })} /></label>
            <label>Language<input value={contextForm.language} onChange={(e) => setContextForm({ ...contextForm, language: e.target.value })} /></label>
            <label>Description<textarea value={contextForm.description} onChange={(e) => setContextForm({ ...contextForm, description: e.target.value })} /></label>
            <label>Deployment<input value={contextForm.deployment} onChange={(e) => setContextForm({ ...contextForm, deployment: e.target.value })} /></label>
            <label>Compliance<input value={contextForm.compliance} onChange={(e) => setContextForm({ ...contextForm, compliance: e.target.value })} /></label>
          </div>
          <button style={{ marginTop: 8 }} onClick={saveContext}>Save Context and Continue</button>
        </section>
      )}

      {activeStage === "stage2" && (
        <section style={{ marginBottom: 20 }}>
          <h2>Stage 2: Threat Mapping</h2>
          <p>Potential threats inferred from context (review and confirm):</p>
          {threats.length === 0 && <p>No threats generated yet. Complete Stage 1 first.</p>}
          {threats.length > 0 && threats.map((t) => (
            <div key={t} style={{ margin: "4px 0" }}>
              <label><input type="checkbox" checked={selectedThreats.includes(t)} onChange={(e) => {
                const next = e.target.checked ? [...selectedThreats, t] : selectedThreats.filter((x) => x !== t);
                setSelectedThreats(next);
              }} /> {t}</label>
            </div>
          ))}
          {threatAnalysis.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Threat analysis details:</strong>
              <ul>{threatAnalysis.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          )}
          <button style={{ marginTop: 8 }} onClick={confirmThreats}>Confirm Threat Mapping</button>
        </section>
      )}

      {activeStage === "stage3" && (
        <section style={{ marginBottom: 20 }}>
          <h2>Stage 3: Secure Code Generation</h2>
          <p>Generated code (with inline security annotations):</p>
          <textarea value={codeOutput} onChange={(e) => setCodeOutput(e.target.value)} style={{ width: "100%", height: 220, fontFamily: "monospace" }} />

          <div>
            <strong>Uncertainty flags:</strong>
            <ul>{uncertaintyFlags.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
          <button onClick={finalizeGeneration}>Finalize Generation</button>
        </section>
      )}

      {activeStage === "stage5" && handoffSummary && (
        <section style={{ marginBottom: 20 }}>
          <h2>Stage 5: Collaborative Handoff</h2>
          <p><strong>Session summary:</strong></p>
          <pre style={{ background: "#f8fafc", border: "1px solid #d1d5db" }}>{JSON.stringify(handoffSummary, null, 2)}</pre>
          {codeAnalysis.length > 0 && (
            <div>
              <strong>Code analysis findings:</strong>
              <ul>{codeAnalysis.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          <button onClick={exportJson}>Export JSON</button>
        </section>
      )}

      <footer style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
        <strong>Status:</strong> {status}
      </footer>
    </main>
  );
}

export default App;
