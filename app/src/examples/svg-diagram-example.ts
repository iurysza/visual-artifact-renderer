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
    padding: 12px 16px; border-bottom: 1px solid var(--line-soft); flex: none;
  }
  .bar h1 { font-family: var(--serif); font-weight: 500; font-size: 18px; color: var(--ink); letter-spacing: -0.01em; }
  .bar .sub { font-family: var(--mono); font-size: 10px; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; }
  .spacer { flex: 1; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.04em;
    padding: 5px 11px; border: 1px solid var(--line); border-radius: 9999px;
    background: transparent; color: var(--muted); cursor: pointer; transition: all .15s ease; flex: none;
  }
  .chip:hover { color: var(--ink); border-color: var(--muted); }
  .chip.on { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  #themeToggle {
    font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
    padding: 5px 10px; border: 1px solid var(--line); border-radius: 0.45rem;
    background: transparent; color: var(--muted); cursor: pointer; flex: none;
  }
  #themeToggle:hover { color: var(--ink); border-color: var(--muted); }

  .stage { flex: 1; position: relative; min-width: 0; overflow: hidden; }
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
    position: absolute; right: 24px; bottom: 24px; width: 280px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
    padding: 14px 16px; box-shadow: 0 6px 24px rgba(0,0,0,0.08);
    z-index: 10;
  }
  .card h3 { font-family: var(--serif); font-weight: 500; font-size: 16px; color: var(--ink); margin-bottom: 2px; }
  .card .meta { font-family: var(--mono); font-size: 10px; color: var(--muted); margin-bottom: 8px; }
  .card p { font-size: 12px; line-height: 1.55; }
  .card code { font-family: var(--mono); font-size: 11px; color: var(--clay); }
  .hint { position: absolute; left: 16px; bottom: 12px; font-family: var(--mono); font-size: 10px; color: var(--muted); }

  .diagram-mobile { display: none; }

  @media (max-width: 760px) {
    .bar { gap: 10px; padding: 10px 12px; }
    .bar h1 { font-size: 15px; }
    .bar .sub { display: none; }
    .chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
    .chips::-webkit-scrollbar { display: none; }
    .diagram-desktop { display: none; }
    .diagram-mobile { display: block; }
    .hint { display: none; }
    .card { left: 16px; right: 16px; bottom: 16px; width: auto; padding: 12px 16px; }
    .card p { font-size: 11.5px; }
  }
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
  <!-- Layout notes for generated diagrams:
       - viewBox must fit all nodes, zones, edges, labels, and the bottom-right card overlay.
       - Every node rectangle keeps >= 30px empty space to the next node in both x and y.
       - Adjacent zones keep >= 40px empty space between them.
       - Edges and labels travel through blank canvas, never across nodes or labels.
       - Bottom-right corner is reserved for the detail card overlay. -->
  <svg class="diagram-desktop" viewBox="0 0 1100 700" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Visualizer pipeline diagram">
      <defs>
        <marker id="a-mut" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style="fill: var(--muted)"/>
        </marker>
        <marker id="a-clay" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style="fill: var(--clay)"/>
        </marker>
      </defs>

      <!-- Zones: 40px gap between zone rectangles. -->
      <g class="zone">
        <rect x="40" y="80" width="280" height="440"/>
        <text class="ztitle" x="60" y="105">Sources</text>
      </g>
      <g class="zone">
        <rect x="360" y="80" width="340" height="440"/>
        <text class="ztitle" x="380" y="105">Pipeline</text>
      </g>
      <g class="zone">
        <rect x="740" y="80" width="260" height="440"/>
        <text class="ztitle" x="760" y="105">Outputs</text>
      </g>

      <!-- Edges run through empty space, not across nodes. -->
      <path class="edge" id="e-repo"     d="M315,170 L365,170"/>
      <path class="edge" id="e-packets"  d="M315,270 L365,270"/>
      <path class="edge" id="e-direct"   d="M315,370 L340,370 L340,310 L365,310"/>
      <path class="edge" id="e-extract"  d="M700,170 L745,170"/>
      <path class="edge" id="e-report"   d="M700,300 L745,300"/>
      <path class="edge" id="e-visual"   d="M700,400 L745,400"/>
      <path class="edge" id="e-assemble" d="M890,240 L890,300"/>
      <path class="edge" id="e-render"   d="M890,350 L890,410"/>

      <!-- Source nodes: 30px vertical gap between rectangles (140->220->300, each h=60). -->
      <g class="node" data-k="repo">
        <rect x="70" y="140" width="220" height="60"/>
        <text class="t" x="90" y="165">Local repo</text>
        <text class="m" x="90" y="185">files, deps, structure</text>
      </g>
      <g class="node" data-k="packets">
        <rect x="70" y="240" width="220" height="60"/>
        <text class="t" x="90" y="265">Packet reports</text>
        <text class="m" x="90" y="285">agentic findings</text>
      </g>
      <g class="node" data-k="context">
        <rect x="70" y="340" width="220" height="60"/>
        <text class="t" x="90" y="365">Source context</text>
        <text class="m" x="90" y="385">north star, instructions</text>
      </g>

      <!-- Pipeline nodes: 50-60px vertical gaps. extract ends y=230, director starts y=280. -->
      <g class="node" data-k="extract">
        <rect x="390" y="120" width="280" height="110"/>
        <text class="t" x="410" y="145">Deterministic extraction</text>
        <text class="m" x="410" y="165">repo profile · imports · deps</text>
        <text class="m" x="410" y="185">digest + evidence packets</text>
      </g>
      <g class="node" data-k="director">
        <rect x="390" y="280" width="280" height="60"/>
        <text class="t" x="410" y="305">Report director</text>
        <text class="m" x="410" y="325">thesis · sections · audience</text>
      </g>
      <g class="node" data-k="visual">
        <rect x="390" y="370" width="280" height="60"/>
        <text class="t" x="410" y="395">Visualization strategy</text>
        <text class="m" x="410" y="415">components · diagrams · flow</text>
      </g>

      <!-- Output nodes: placed in upper-right; card overlay sits in empty bottom-right. -->
      <g class="node store" data-k="json">
        <rect x="760" y="140" width="220" height="100"/>
        <text class="t" x="780" y="165">Spec JSON</text>
        <text class="m" x="780" y="185">validated schema</text>
        <text class="m" x="780" y="205">~/.pi/artifacts/...</text>
      </g>
      <g class="node store" data-k="manifest">
        <rect x="760" y="300" width="220" height="60"/>
        <text class="t" x="780" y="325">Manifest</text>
        <text class="m" x="780" y="345">node type guidance</text>
      </g>
      <g class="node out" data-k="renderer">
        <rect x="775" y="410" width="190" height="50"/>
        <text class="t" x="795" y="435">Renderer</text>
        <text class="m" x="795" y="452">React components</text>
      </g>
    </svg>

    <svg class="diagram-mobile" viewBox="0 0 420 1200" preserveAspectRatio="xMidYMin meet" role="img" aria-label="Visualizer pipeline diagram mobile">
      <defs>
        <marker id="am-mut" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style="fill: var(--muted)"/>
        </marker>
        <marker id="am-clay" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style="fill: var(--clay)"/>
        </marker>
      </defs>

      <g class="zone">
        <rect x="20" y="60" width="380" height="360"/>
        <text class="ztitle" x="40" y="85">Sources</text>
      </g>
      <g class="zone">
        <rect x="20" y="460" width="380" height="320"/>
        <text class="ztitle" x="40" y="485">Pipeline</text>
      </g>
      <g class="zone">
        <rect x="20" y="820" width="380" height="240"/>
        <text class="ztitle" x="40" y="845">Outputs</text>
      </g>

      <path class="edge" id="em-repo"     d="M210,170 L210,490"/>
      <path class="edge" id="em-packets"  d="M210,270 L240,490"/>
      <path class="edge" id="em-context"  d="M210,370 L210,590"/>
      <path class="edge" id="em-extract"  d="M210,560 L210,850"/>
      <path class="edge" id="em-direct"   d="M210,640 L210,670"/>
      <path class="edge" id="em-visual"   d="M210,720 L210,850"/>
      <path class="edge" id="em-json"     d="M210,920 L210,1035"/>
      <path class="edge" id="em-manifest" d="M210,1000 L210,1035"/>

      <g class="node" data-k="repo">
        <rect x="80" y="120" width="260" height="50"/>
        <text class="t" x="96" y="143">Local repo</text>
        <text class="m" x="96" y="160">files, deps, structure</text>
      </g>
      <g class="node" data-k="packets">
        <rect x="80" y="220" width="260" height="50"/>
        <text class="t" x="96" y="243">Packet reports</text>
        <text class="m" x="96" y="260">agentic findings</text>
      </g>
      <g class="node" data-k="context">
        <rect x="80" y="320" width="260" height="50"/>
        <text class="t" x="96" y="343">Source context</text>
        <text class="m" x="96" y="360">north star, instructions</text>
      </g>

      <g class="node" data-k="extract">
        <rect x="60" y="490" width="300" height="70"/>
        <text class="t" x="76" y="515">Deterministic extraction</text>
        <text class="m" x="76" y="533">repo profile · imports · deps</text>
        <text class="m" x="76" y="548">digest + evidence packets</text>
      </g>
      <g class="node" data-k="director">
        <rect x="60" y="590" width="300" height="50"/>
        <text class="t" x="76" y="613">Report director</text>
        <text class="m" x="76" y="630">thesis · sections · audience</text>
      </g>
      <g class="node" data-k="visual">
        <rect x="60" y="670" width="300" height="50"/>
        <text class="t" x="76" y="693">Visualization strategy</text>
        <text class="m" x="76" y="710">components · diagrams · flow</text>
      </g>

      <g class="node store" data-k="json">
        <rect x="70" y="850" width="280" height="70"/>
        <text class="t" x="86" y="875">Spec JSON</text>
        <text class="m" x="86" y="893">validated schema</text>
        <text class="m" x="86" y="908">~/.pi/artifacts/...</text>
      </g>
      <g class="node store" data-k="manifest">
        <rect x="70" y="950" width="280" height="50"/>
        <text class="t" x="86" y="973">Manifest</text>
        <text class="m" x="86" y="990">node type guidance</text>
      </g>
      <g class="node out" data-k="renderer">
        <rect x="85" y="1035" width="250" height="45"/>
        <text class="t" x="101" y="1057">Renderer</text>
        <text class="m" x="101" y="1073">React components</text>
      </g>
    </svg>

    <div class="hint">Theme syncs with the visualizer.</div>
    
    <div class="card" id="detail">
      <h3 id="d-title">Click a node</h3>
      <div class="meta" id="d-meta">pipeline stage</div>
      <p id="d-body">Select a node to see what it does. Use the chips above to animate request paths.</p>
    </div>
  </div>
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
  extract:  { edges:["e-repo","e-packets","e-extract"], nodes:["repo","packets","extract","json"], steps:["Repo files and packets are parsed deterministically","A structured digest + evidence packets are produced","Output is saved as validated VisualArtifactSpec JSON"] },
  direct:   { edges:["e-direct","e-report"], nodes:["context","director","manifest"], steps:["Source context feeds the director","The director chooses artifact type and section order","The manifest guides component selection"] },
  assemble: { edges:["e-report","e-visual","e-assemble"], nodes:["director","visual","json","manifest"], steps:["Visualization strategy picks components per section","Final assembler writes the VisualArtifactSpec JSON","Schema validation runs before writing"] },
  render:   { edges:["e-assemble","e-render"], nodes:["json","renderer"], steps:["Renderer reads the artifact JSON","Each node maps to a React component","Static export produces the final page"] },
};

const FLOWS_MOBILE = {
  extract:  { edges:["em-repo","em-packets","em-extract"], nodes:["repo","packets","extract","json"] },
  direct:   { edges:["em-context"], nodes:["context","director"] },
  assemble: { edges:["em-direct","em-visual"], nodes:["director","visual","json","manifest"] },
  render:   { edges:["em-json","em-manifest"], nodes:["json","manifest","renderer"] },
};

const stage = document.getElementById('stage');
const nodes = document.querySelectorAll('.node');
const chips = document.querySelectorAll('.chip');
const isMobile = () => window.innerWidth <= 760;

function setFlow(key) {
  chips.forEach(c => c.classList.toggle('on', c.dataset.flow === key));
  document.querySelectorAll('.edge').forEach(e => e.classList.remove('lit'));
  nodes.forEach(n => n.classList.remove('lit'));
  if (key === 'all') { stage.classList.remove('flowing'); return; }
  const f = isMobile() ? FLOWS_MOBILE[key] : FLOWS[key];
  stage.classList.add('flowing');
  f.edges.forEach(id => document.getElementById(id)?.classList.add('lit'));
  f.nodes.forEach(k => document.querySelector('.node[data-k="' + k + '"]')?.classList.add('lit'));
}
chips.forEach(c => c.addEventListener('click', () => setFlow(c.dataset.flow)));
window.addEventListener('resize', () => {
  const on = document.querySelector('.chip.on');
  if (on && on.dataset.flow !== 'all') setFlow(on.dataset.flow);
});

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
