# Timeline analysis scripts

Optional tools; not part of the OpenCode plugin runtime.

## One-liners

Quick stats (no extra deps):

```bash
# Python
python3 -c "import json,sys; r=[json.loads(x) for x in open(sys.argv[1]) if x.strip()]; h=[x['hitPercent'] for x in r if x.get('hitPercent') is not None]; print(f\"{len(r)} calls, avg hit {sum(h)/len(h):.1f}%\")" logs/timeline-2026-05-31.jsonl

# Bun
bun -e "const t=await Bun.file(process.argv[1]).text();const rows=t.trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));const h=rows.map(r=>r.hitPercent).filter((p):p is number=>p!=null);console.log(rows.length+' calls, avg hit '+(h.reduce((a,b)=>a+b,0)/h.length).toFixed(1)+'%')" logs/timeline-2026-05-31.jsonl
```

Export TSV for spreadsheets:

```bash
jq -r 'select(.hitPercent!=null) | [.completedAt,.scope,.hitPercent,.cost]|@tsv' logs/timeline-2026-05-31.jsonl
```

## `plot-hit-rate.ts` (Bun, no install)

Terminal ASCII chart; optional SVG (`open /tmp/hit.svg`):

```bash
bun scripts/plot-hit-rate.ts logs/timeline-2026-05-31.jsonl
bun scripts/plot-hit-rate.ts logs/timeline-2026-05-31.jsonl --root YOUR_ROOT_SESSION_ID -o /tmp/hit.svg
# one SVG, one colored line per rootSessionId (time-aligned)
bun scripts/plot-hit-rate.ts logs/timeline-2026-05-31.jsonl --by-root -o /tmp/hit.svg
```

Use a real path, not `$LOG`, unless you exported it first:

```bash
set -x LOG logs/timeline-(date +%Y-%m-%d).jsonl   # fish: set log ...
bun scripts/plot-hit-rate.ts $LOG -o /tmp/hit.svg
```
