export const visualizerPipelineDiagram = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visualizer pipeline</title>
<script>
  (function () {
    const key = "visualizer-theme";
    const stored = localStorage.getItem(key);
    const dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  })();
</script>
<style>
  :root {
    --bg: #FAF9F5;
    --surface: #FFFFFF;
    --surface2: #F0EEE6;
    --ink: #141413;
    --body: #3D3D3A;
    --muted: #87867F;
    --line: #D1CFC5;
    --line-soft: #E6E3DA;
    --clay: #D97757;
    --clay-soft: rgba(217,119,87,0.10);
    --olive: #788C5D;
    --olive-soft: rgba(120,140,93,0.12);
    --gold: #C9A45C;
    --zone: rgba(20,20,19,0.025);
    --serif: ui-serif, Georgia, "Times New Roman", serif;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  html.dark {
    --bg: #141413;
    --surface: #1F1F1D;
    --surface2: #2A2A28;
    --ink: #FAF9F5;
    --body: #D1CFC5;
    --muted: #87867F;
    --line: #3D3D3A;
    --line-soft: #2A2A28;
    --clay: #E48A6E;
    --clay-soft: rgba(228,138,110,0.14);
    --olive: #9DB07C;
    --olive-soft: rgba(157,176,124,0.16);
    --gold: #D4B36F;
    --zone: rgba(250,249,245,0.03);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: var(--bg); color: var(--body); font-family: var(--sans);
    -webkit-font-smoothing: antialiased; display: flex; flex-direction: column; overflow: hidden;
  }

  .bar {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    padding: 12px 20px; border-bottom: 1px solid var(--line-soft); flex: none;
  }
  .bar h1 { font-family: var(--serif); font-weight: 500; font-size: 19px; color: var(--ink); letter-spacing: -0.01em; }
  .bar .sub { font-family: var(--mono); font-size: 10.5px; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; }
  .spacer { flex: 1; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.04em;
    padding: 5px 11px; border: 1px solid var(--line); border-radius: 999px;
    background: transparent; color: var(--muted); cursor: pointer; transition: all .15s ease;
  }
  .chip:hover { color: var(--ink); border-color: var(--muted); }
  .chip.on { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  #themeToggle {
    font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em;
    padding: 5px 10px; border: 1px solid var(--line); border-radius: 6px;
    background: transparent; color: var(--muted); cursor: pointer;
  }
  #themeToggle:hover { color: var(--ink); border-color: var(--muted); }

  .stage { flex: 1; position: relative; min-height: 0; }
  .stage svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

  .zone rect { fill: var(--zone); stroke: var(--line); stroke-width: 1; stroke-dasharray: 5 5; rx: 16; }
  .zone .ztitle { font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; fill: var(--muted); }

  .node { cursor: pointer; }
  .node rect { fill: var(--surface); stroke: var(--line); stroke-width: 1.5; rx: 10; transition: stroke .15s ease, filter .15s ease; }
  .node:hover rect { stroke: var(--muted); }
  .node.sel rect { stroke: var(--clay) !important; stroke-width: 2; }
  .node .t { font-family: var(--sans); font-size: 13px; font-weight: 600; fill: var(--ink); pointer-events: none; }
  .node .m { font-family: var(--mono); font-size: 10px; fill: var(--muted); pointer-events: none; }
  .node.store rect { fill: var(--surface2); }
  .node.out rect { stroke-dasharray: 6 3; }

  .edge { stroke: var(--muted); stroke-width: 1.6; fill: none; marker-end: url(#a-mut); transition: opacity .2s ease, stroke .2s ease; }
  .edge.dash { stroke-dasharray: 5 4; }

  .stage.flowing .edge { opacity: 0.12; }
  .stage.flowing .node { opacity: 0.35; }
  .stage.flowing .zone { opacity: 0.45; }
  .stage.flowing .edge.lit { opacity: 1; stroke: var(--clay); marker-end: url(#a-clay); stroke-dasharray: 7 5; animation: march 0.9s linear infinite; }
  .stage.flowing .node.lit { opacity: 1; }
  .stage.flowing .node.lit rect { stroke: var(--clay); }
  @keyframes march { to { stroke-dashoffset: -12; } }
  @media (prefers-reduced-motion: reduce) { .stage.flowing .edge.lit { animation: none; } }

  .card {
    position: absolute; right: 16px; bottom: 16px; width: 280px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
    padding: 14px 16px; box-shadow: 0 6px 24px rgba(0,0,0,0.08);
  }
  .card h3 { font-family: var(--serif); font-weight: 500; font-size: 16px; color: var(--ink); margin-bottom: 2px; }
  .card .meta { font-family: var(--mono); font-size: 10px; color: var(--muted); margin-bottom: 8px; }
  .card p { font-size: 12px; line-height: 1.55; }
  .card code { font-family: var(--mono); font-size: 11px; color: var(--clay); }
  .hint { position: absolute; left: 16px; bottom: 16px; font-family: var(--mono); font-size: 10px; color: var(--muted); }
</style>
</head>
<body>

<div class="bar">
  <div>
    <h1>Visualizer pipeline</h1>
    <div class="sub">from repo to rendered artifact</div>
  </div>
  <div class="spacer"></div>
  <div class="chips" id="chips">
    <button class="chip on" data-flow="all">All</button>
    <button class="chip" data-flow="extract">Extract</button>
    <button class="chip" data-flow="direct">Direct</button>
    <button class="chip" data-flow="assemble">Assemble</button>
    <button class="chip" data-flow="render">Render</button>
  </div>
  <button id="themeToggle">Theme</button>
</div>

<div class="stage" id="stage">
<svg viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Visualizer pipeline diagram">
  <defs>
    <marker id="a-mut" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" style="fill: var(--muted)"/>
    </marker>
    <marker id="a-clay" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" style="fill: var(--clay)"/>
    </marker>
  </defs>

  <g class="zone">
    <rect x="40" y="80" width="280" height="380"/>
    <text class="ztitle" x="60" y="105">Sources</text>
  </g>
  <g class="zone">
    <rect x="360" y="80" width="320" height="380"/>
    <text class="ztitle" x="380" y="105">Pipeline</text>
  </g>
  <g class="zone">
    <rect x="720" y="80" width="240" height="380"/>
    <text class="ztitle" x="740" y="105">Outputs</text>
  </g>

  <path class="edge" id="e-repo"     d="M315,170 L365,170"/>
  <path class="edge" id="e-packets"  d="M315,250 L365,250"/>
  <path class="edge" id="e-direct"   d="M315,330 L365,330"/>
  <path class="edge" id="e-extract"  d="M675,190 L725,190"/>
  <path class="edge" id="e-report"   d="M675,270 L725,270"/>
  <path class="edge" id="e-visual"   d="M675,350 L725,350"/>
  <path class="edge" id="e-assemble" d="M855,240 L855,290"/>
  <path class="edge" id="e-render"   d="M855,370 L855,410"/>

  <g class="node" data-k="repo">
    <rect x="70" y="140" width="220" height="60"/>
    <text class="t" x="90" y="165">Local repo</text>
    <text class="m" x="90" y="185">files, deps, structure</text>
  </g>
  <g class="node" data-k="packets">
    <rect x="70" y="220" width="220" height="60"/>
    <text class="t" x="90" y="245">Packet reports</text>
    <text class="m" x="90" y="265">agentic findings</text>
  </g>
  <g class="node" data-k="context">
    <rect x="70" y="300" width="220" height="60"/>
    <text class="t" x="90" y="325">Source context</text>
    <text class="m" x="90" y="345">north star, instructions</text>
  </g>

  <g class="node" data-k="extract">
    <rect x="390" y="120" width="260" height="100"/>
    <text class="t" x="410" y="145">Deterministic extraction</text>
    <text class="m" x="410" y="165">repo profile · imports · deps</text>
    <text class="m" x="410" y="185">digest + evidence packets</text>
  </g>
  <g class="node" data-k="director">
    <rect x="390" y="260" width="260" height="60"/>
    <text class="t" x="410" y="285">Report director</text>
    <text class="m" x="410" y="305">thesis · sections · audience</text>
  </g>
  <g class="node" data-k="visual">
    <rect x="390" y="340" width="260" height="60"/>
    <text class="t" x="410" y="365">Visualization strategy</text>
    <text class="m" x="410" y="385">components · diagrams · flow</text>
  </g>

  <g class="node store" data-k="json">
    <rect x="740" y="140" width="200" height="100"/>
    <text class="t" x="760" y="165">Spec JSON</text>
    <text class="m" x="760" y="185">validated schema</text>
    <text class="m" x="760" y="205">~/.pi/artifacts/...</text>
  </g>
  <g class="node store" data-k="manifest">
    <rect x="740" y="290" width="200" height="60"/>
    <text class="t" x="760" y="315">Manifest</text>
    <text class="m" x="760" y="335">node type guidance</text>
  </g>
  <g class="node out" data-k="renderer">
    <rect x="755" y="410" width="170" height="50"/>
    <text class="t" x="775" y="435">Renderer</text>
    <text class="m" x="775" y="452">React components</text>
  </g>
</svg>

  <div class="card" id="detail">
    <h3 id="d-title">Click a node</h3>
    <div class="meta" id="d-meta">pipeline stage</div>
    <p id="d-body">Select a node to see what it does. Use the chips above to animate request paths.</p>
  </div>
  <div class="hint">Theme syncs with the visualizer.</div>
</div>

<script>
const DETAIL = {
  repo: { t:"Local repo", m:"source material", b:"The filesystem state of the project being analyzed: source files, package manifest, dependency tree, and entry points." },
  packets: { t:"Packet reports", m:"agentic findings", b:"Optional deep-dive reports produced by scout agents: architecture notes, risk analysis, dependency explanations, etc." },
  context: { t:"Source context", m:"north star + constraints", b:"The user's instructions, the project README, AGENTS.md, and any explicit goals or constraints." },
  extract: { t:"Deterministic extraction", m:"structured evidence", b:"Parses the repo into deterministic JSON: profile, internal imports, package deps, and a digest. No LLM guessing here." },
  director: { t:"Report director", m:"orientation-first plan", b:"Chooses the artifact type, audience, thesis, and section order. Decides what matters and what to leave out." },
  visual: { t:"Visualization strategy", m:"component plan", b:"Picks node types for each section: stat cards, tables, mermaid, svg-diagram, flow, code blocks." },
  json: { t:"VisualArtifactSpec", m:"validated output", b:"The final JSON artifact written to <code>~/.pi/artifacts/</code>. The renderer reads it and produces the page." },
  manifest: { t:"Artifact manifest", m:"component guidance", b:"Describes every node type, when to use it, and composition patterns. The assembler consults it." },
  renderer: { t:"Component registry", m:"React rendering", b:"Maps each node type to a React component: tables, charts, mermaid, and interactive svg-diagram iframes." },
};

const FLOWS = {
  extract:  { edges:["e-repo","e-extract"], nodes:["repo","extract","json"], steps:["Repo files are parsed deterministically","A structured digest + evidence packets are produced","Output is saved as validated VisualArtifactSpec JSON"] },
  direct:   { edges:["e-packets","e-direct","e-report"], nodes:["packets","context","director","manifest"], steps:["Scout packets and source context feed the director","The director chooses artifact type and section order","The manifest guides component selection"] },
  assemble: { edges:["e-report","e-visual","e-assemble"], nodes:["director","visual","json","manifest"], steps:["Visualization strategy picks components per section","Final assembler writes the VisualArtifactSpec JSON","Schema validation runs before writing"] },
  render:   { edges:["e-assemble","e-render"], nodes:["json","renderer"], steps:["Renderer reads the artifact JSON","Each node maps to a React component","Static export produces the final page"] },
};

const stage = document.getElementById('stage');
const nodes = document.querySelectorAll('.node');
const edges = document.querySelectorAll('.edge');
const chips = document.querySelectorAll('.chip');

function setFlow(key) {
  chips.forEach(c => c.classList.toggle('on', c.dataset.flow === key));
  edges.forEach(e => e.classList.remove('lit'));
  nodes.forEach(n => n.classList.remove('lit'));
  if (key === 'all') { stage.classList.remove('flowing'); return; }
  const f = FLOWS[key];
  stage.classList.add('flowing');
  f.edges.forEach(id => document.getElementById(id)?.classList.add('lit'));
  f.nodes.forEach(k => document.querySelector('.node[data-k="' + k + '"]')?.classList.add('lit'));
}
chips.forEach(c => c.addEventListener('click', () => setFlow(c.dataset.flow)));

nodes.forEach(n => n.addEventListener('click', () => {
  nodes.forEach(x => x.classList.remove('sel'));
  n.classList.add('sel');
  const d = DETAIL[n.dataset.k];
  if (!d) return;
  document.getElementById('d-title').textContent = d.t;
  document.getElementById('d-meta').textContent = d.m;
  document.getElementById('d-body').innerHTML = d.b;
}));

document.getElementById('themeToggle').addEventListener('click', () => {
  const dark = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  localStorage.setItem('visualizer-theme', dark ? 'dark' : 'light');
});
</script>
</body>
</html>`
