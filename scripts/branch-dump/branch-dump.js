#!/usr/bin/env node
/**
 * Dump every row that belongs to ONE branch (production) and optionally load it
 * straight into another database (staging), or write it as a .sql file.
 *
 * Setup (once):   cd scripts/branch-dump && npm install
 *
 * Preview (reads only, writes nothing; run this first):
 *   SOURCE_DB_URL=postgres://... node branch-dump.js --branch <id> --dry-run
 *
 * Write a .sql file you can run in DBeaver / psql:
 *   SOURCE_DB_URL=... node branch-dump.js --branch <id> --out branch.sql
 *
 * Load directly into staging in ONE transaction (also writes the .sql if --out given):
 *   SOURCE_DB_URL=... TARGET_DB_URL=... node branch-dump.js --branch <id> --yes
 *
 * Options
 *   --branch <id>           branch _id to dump (required)
 *   --source-url / --target-url   or env SOURCE_DB_URL / TARGET_DB_URL
 *   --out <file>            write SQL to this file
 *   --months <n> | --since YYYY-MM-DD   override the explicit windows (cashCollections)
 *   --recency-months <n> | --recency-since YYYY-MM-DD | --no-recency   the general "only recently touched rows" rule
 *   --on-conflict none|nothing|update   when a row already exists in the target (default none = error;
 *                           with --replace default is update). config.conflict overrides this per table.
 *   --no-verify-ssl         accept self-signed certs (DigitalOcean managed Postgres)
 *   --config <file>         default ./branch-dump.config.js
 *   --replace               first DELETE this branch's existing rows in the target (same transaction),
 *                           so the target ends up matching production. Implies --on-conflict update.
 *                           Shared parent rows (areas, regions, other branches' users) and config.keepOnWipe are never deleted.
 *   --dry-run               count rows and print the coverage report (and, with a target, what --replace would delete)
 *   --yes                   required to write to a target database
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ---------------------------------------------------------------- args
function parseArgs(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    if (a[i + 1] === undefined || a[i + 1].startsWith('--')) o[k] = true;
    else o[k] = a[++i];
  }
  return o;
}
const args = parseArgs(process.argv.slice(2));
const die = (m) => { console.error('ERROR: ' + m); process.exit(1); };

const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const log = (...m) => console.error(...m);

async function main() {
  const branch = args.branch && String(args.branch);
  if (!branch) die('--branch <id> is required');
  const sourceUrl = args['source-url'] || process.env.SOURCE_DB_URL;
  const targetUrl = args['target-url'] || process.env.TARGET_DB_URL;
  if (!sourceUrl) die('set SOURCE_DB_URL (production) or pass --source-url');
  if (targetUrl && targetUrl === sourceUrl) die('source and target URLs are identical');
  if (targetUrl && !args['dry-run'] && !args.yes) die('writing to a target needs --yes');
  const dryRun = !!args['dry-run'];
  const replace = !!args.replace;
  if (replace && !targetUrl && !args.out) die('--replace needs a target URL (or --out to emit the DELETEs into the file)');
  if (!dryRun && !targetUrl && !args.out) die('give --out <file>, a target URL, or --dry-run');

  const cfg = require(path.resolve(args.config || path.join(__dirname, 'branch-dump.config.js')));
  const S = cfg.schema || 'public';
  const qt = (t) => `${q(S)}.${q(t)}`;

  const connect = async (url) => {
    let u = url, ssl;
    if (args['no-verify-ssl']) {
      u = url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
      ssl = { rejectUnauthorized: false };
    }
    const c = new Client({ connectionString: u, ssl });
    await c.connect();
    return c;
  };
  const describe = (url) => { try { const u = new URL(url); return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`; } catch { return '?'; } };

  // explicit per-table windows (e.g. cashCollections) and the general recency rule
  const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); };
  const winSince = (w) => (args.since ? String(args.since) : monthsAgo(args.months ? Number(args.months) : (w.months || 0)));
  const rec = cfg.recency && !args['no-recency'] ? cfg.recency : null;
  const recSince = rec ? (args['recency-since'] ? String(args['recency-since']) : monthsAgo(Number(args['recency-months'] || rec.months || 6))) : null;
  const recSkip = new Set(rec ? rec.skip || [] : []);
  const winNote = Object.entries(cfg.windows || {}).map(([t, w]) => `${t} since ${winSince(w)}`).join(', ') || 'none';

  const c = await connect(sourceUrl);
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  await c.query("SET LOCAL statement_timeout = '15min'");
  log(`Source: ${describe(sourceUrl)}   branch: ${branch}\n  windows: ${winNote}\n  recency: ${recSince ? 'rows touched since ' + recSince : 'off'}`);

  // ------------------------------------------------------------ introspection
  const tables = new Set((await c.query(
    `SELECT c.relname n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
     WHERE s.nspname=$1 AND c.relkind IN ('r','p') AND NOT c.relispartition`, [S])).rows.map((r) => r.n));
  const cols = new Map(); // table -> [{name, gen, hasdef}]
  for (const r of (await c.query(
    `SELECT c.relname t, a.attname::text n, a.attgenerated<>'' gen, (a.atthasdef OR a.attidentity<>'') hasdef, a.atttypid::regtype::text typ
     FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace s ON s.oid=c.relnamespace
     WHERE s.nspname=$1 AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
     ORDER BY c.relname, a.attnum`, [S])).rows) {
    if (!cols.has(r.t)) cols.set(r.t, []);
    cols.get(r.t).push({ name: r.n, gen: r.gen, hasdef: r.hasdef, typ: r.typ });
  }
  const colNames = (t) => (cols.get(t) || []).map((x) => x.name);
  const pks = new Map();
  for (const r of (await c.query(
    `SELECT cl.relname t, array_agg(a.attname::text ORDER BY k.ord) cols
     FROM pg_index i JOIN pg_class cl ON cl.oid=i.indrelid JOIN pg_namespace s ON s.oid=cl.relnamespace
     CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ord)
     JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
     WHERE i.indisprimary AND s.nspname=$1 GROUP BY 1`, [S])).rows) pks.set(r.t, r.cols);

  const fkSql = (side) => `(SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(con.${side === 'c' ? 'conkey' : 'confkey'})
      WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=con.${side === 'c' ? 'conrelid' : 'confrelid'} AND a.attnum=k.attnum)`;
  const FK_QUERY = `SELECT cl.relname child, pl.relname parent, ${fkSql('c')} "childCols", ${fkSql('p')} "parentCols"
     FROM pg_constraint con JOIN pg_class cl ON cl.oid=con.conrelid JOIN pg_class pl ON pl.oid=con.confrelid
     JOIN pg_namespace s ON s.oid=cl.relnamespace WHERE con.contype='f' AND s.nspname=$1`;
  const realFks = (await c.query(FK_QUERY, [S])).rows;

  // Connect to the target now: its foreign keys can differ from production's, and any parent row
  // the target REQUIRES must be copied too (otherwise the insert fails on the target's constraint).
  let target = null, targetFksAll = [];
  if (targetUrl) {
    target = await connect(targetUrl);
    targetFksAll = (await target.query(FK_QUERY, [S])).rows;
  }

  const excluded = new Set(cfg.exclude || []);
  const ok = (t) => tables.has(t) && !excluded.has(t);
  const edgeOk = (e) => ok(e.child) && ok(e.parent) && e.childCols.every((x) => colNames(e.child).includes(x))
    && e.parentCols.every((x) => colNames(e.parent).includes(x));
  const downEdges = (cfg.children || []).filter(edgeOk);
  const keyOf = (e) => `${e.child}|${e.childCols.join(',')}|${e.parent}|${e.parentCols.join(',')}`;
  const known = new Set([...realFks, ...(cfg.parents || [])].map(keyOf));
  const targetOnlyFks = targetFksAll.filter((e) => !known.has(keyOf(e)) && edgeOk(e));
  for (const e of targetOnlyFks) log(`  note: target enforces ${e.child}(${e.childCols}) -> ${e.parent}(${e.parentCols}); following it`);
  const upEdges = [...realFks, ...(cfg.parents || []), ...targetOnlyFks].filter(edgeOk);
  for (const e of [...(cfg.children || []), ...(cfg.parents || [])]) {
    if (!edgeOk(e) && !excluded.has(e.child) && !excluded.has(e.parent)) log(`note: config link ${e.child}(${e.childCols}) -> ${e.parent}(${e.parentCols}) skipped (table/column not found)`);
  }

  // ------------------------------------------------------------ selection
  const B = c.escapeLiteral(branch);
  const sel = new Map(); // table -> temp table holding selected ctids
  let n = 0;
  const ensure = async (t) => {
    if (!sel.has(t)) { const name = `_sel_${n++}`; await c.query(`CREATE TEMP TABLE ${name} (tid tid)`); sel.set(t, name); }
    return sel.get(t);
  };
  const add = async (t, where) => {
    const s = await ensure(t);
    const r = await c.query(`INSERT INTO ${s} SELECT c.ctid FROM ${qt(t)} c WHERE (${where})
      AND NOT EXISTS (SELECT 1 FROM ${s} x WHERE x.tid = c.ctid)`);
    return r.rowCount;
  };
  const tupleOf = (alias, names) => '(' + names.map((x) => `${alias}.${q(x)}::text`).join(',') + ')';
  const seeded = new Map(); // table -> description of how it was seeded
  const filtered = new Set(); // seeded tables limited by a window / recency rule

  const lit = (v) => c.escapeLiteral(v);
  // returns { sql, label }: extra predicate that limits a seeded table to recent rows
  const windowInfo = (t) => {
    const w = (cfg.windows || {})[t];
    if (w) {
      if (!colNames(t).includes(w.column)) { log(`note: window column ${t}.${w.column} not found; table not windowed`); return { sql: '', label: '' }; }
      const sn = winSince(w);
      return { sql: ` AND c.${q(w.column)}::date >= ${lit(sn)}::date`, label: `${w.column} >= ${sn}` };
    }
    if (!rec || recSkip.has(t)) return { sql: '', label: '' };
    const dc = (cols.get(t) || []).filter((x) => (rec.columns || []).includes(x.name) && /^(date|timestamp)/.test(x.typ)).map((x) => x.name);
    if (!dc.length) return { sql: '', label: '' };
    const g = dc.length > 1 ? `GREATEST(${dc.map((x) => `c.${q(x)}::timestamptz`).join(', ')})` : `c.${q(dc[0])}::timestamptz`;
    const keep = (rec.keep || {})[t];
    // old = has dates and the newest of them is before the cutoff; rows with no date info are kept
    return { sql: ` AND (NOT COALESCE(${g} < ${lit(recSince)}::timestamptz, false)${keep ? ` OR (${keep})` : ''})`, label: `touched since ${recSince} [${dc.join(',')}]` };
  };
  for (const t of [...tables].sort()) {
    if (!ok(t)) continue;
    const pat = new RegExp(cfg.branchColumnPattern.source, cfg.branchColumnPattern.flags);
    const bcols = colNames(t).filter((x) => pat.test(x));
    const parts = bcols.map((x) => `c.${q(x)}::text = ${B}`);
    if (cfg.extraSeeds && cfg.extraSeeds[t]) parts.push(`(${cfg.extraSeeds[t].split('{{branch}}').join(B)})`);
    if (t === cfg.branchTable.name) parts.push(`c.${q(cfg.branchTable.pk)}::text = ${B}`);
    if (!parts.length) continue;
    const wi = windowInfo(t);
    if (wi.sql) filtered.add(t);
    const cnt = await add(t, `(${parts.join(' OR ')})${wi.sql}`);
    seeded.set(t, bcols.length ? bcols.join(',') : 'custom rule');
    log(`  seed  ${t.padEnd(34)} ${String(cnt).padStart(9)}  via ${seeded.get(t)}${wi.label ? `  (${wi.label})` : ''}`);
  }
  for (const t of cfg.fullTables || []) if (ok(t)) { const cnt = await add(t, 'true'); log(`  full  ${t.padEnd(34)} ${String(cnt).padStart(9)}`); }
  if (!sel.size) die('no rows found for that branch id. Is it the right value and the right database?');

  const base = new Map();
  const walk = async (edges, dir) => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of edges) {
        const [from, to, fromCols, toCols] = dir === 'down'
          ? [e.parent, e.child, e.parentCols, e.childCols] : [e.child, e.parent, e.childCols, e.parentCols];
        const fromSel = e.fromBaseOnly && dir === 'up' ? base.get(from) : sel.get(from);
        if (!fromSel) continue;
        const cnt = await add(to, `${tupleOf('c', toCols)} IN (SELECT ${tupleOf('f', fromCols)}
          FROM ${qt(from)} f JOIN ${fromSel} s ON s.tid = f.ctid)`);
        if (cnt > 0) {
          changed = true;
          log(`  ${dir.padEnd(5)} ${to.padEnd(34)} ${String(cnt).padStart(9)}  via ${e.child}(${e.childCols}) -> ${e.parent}(${e.parentCols})`);
        }
      }
    }
  };
  await walk(downEdges, 'down');
  // snapshot of what the seed/down phases selected, so an up-link marked fromBaseOnly
  // follows only those rows (one level) and never rows that were themselves pulled in as parents
  for (const [t, s] of [...sel]) { const b = `_base_${n++}`; await c.query(`CREATE TEMP TABLE ${b} AS SELECT * FROM ${s}`); base.set(t, b); }
  await walk(upEdges, 'up');

  // Simulate every foreign key the TARGET enforces: each value a selected row points at must exist in
  // the target after the load. Missing parents that exist in the source are pulled in; the rest are reported.
  const tfk = { dangling: [], skipped: [], checked: 0 };
  if (target) {
    for (let round = 0; round < 6; round++) {
      let pulled = 0;
      tfk.dangling = []; tfk.skipped = []; tfk.checked = 0;
      for (const f of targetFksAll) {
        if (!sel.has(f.child) || !tables.has(f.parent) || excluded.has(f.parent) || excluded.has(f.child)) continue;
        if (f.childCols.length !== 1) { tfk.skipped.push(f); continue; }
        const cc = f.childCols[0], pc = f.parentCols[0];
        if (!colNames(f.child).includes(cc) || !colNames(f.parent).includes(pc)) { tfk.dangling.push({ ...f, why: 'column not present in the source table' }); continue; }
        const copied = sel.has(f.parent)
          ? `AND NOT EXISTS (SELECT 1 FROM ${qt(f.parent)} p JOIN ${sel.get(f.parent)} ps ON ps.tid = p.ctid WHERE p.${q(pc)}::text = f.${q(cc)}::text)` : '';
        const vals = (await c.query(`SELECT DISTINCT f.${q(cc)}::text AS v FROM ${qt(f.child)} f JOIN ${sel.get(f.child)} s ON s.tid = f.ctid
          WHERE f.${q(cc)} IS NOT NULL ${copied}`)).rows.map((r) => r.v);
        tfk.checked++;
        if (!vals.length) continue;
        const missing = (await target.query(`SELECT v FROM unnest($1::text[]) AS v WHERE NOT EXISTS
          (SELECT 1 FROM ${qt(f.parent)} p WHERE p.${q(pc)}::text = v)`, [vals])).rows.map((r) => r.v);
        if (!missing.length) continue;
        const inSource = (await c.query(`SELECT p.${q(pc)}::text AS v FROM ${qt(f.parent)} p WHERE p.${q(pc)}::text = ANY($1::text[])`, [missing])).rows.map((r) => r.v);
        if (inSource.length) {
          const cnt = await add(f.parent, `c.${q(pc)}::text = ANY(ARRAY[${inSource.map((v) => c.escapeLiteral(v)).join(',')}]::text[])`);
          if (cnt > 0) { pulled += cnt; log(`  up    ${f.parent.padEnd(34)} ${String(cnt).padStart(9)}  via target FK ${f.child}(${cc}) -> ${f.parent}(${pc})`); }
        }
        const gone = missing.filter((v) => !inSource.includes(v));
        if (gone.length) tfk.dangling.push({ ...f, missing: gone, why: 'value exists in neither the source nor the target' });
      }
      if (!pulled) break;
    }
  }

  const counts = new Map();
  for (const [t, s] of sel) counts.set(t, Number((await c.query(`SELECT count(*) FROM ${s}`)).rows[0].count));

  if (![...counts.values()].some((v) => v > 0)) die(`no rows found for branch "${branch}". Is it the right _id and the right database?`);

  // ------------------------------------------------------------ coverage report
  log('\n=== Coverage report ===');
  let problems = 0;
  const req = new Set(cfg.require || []);
  for (const t of tables) for (const p of cfg.requirePrefix || []) if (t.startsWith(p)) req.add(t);
  for (const t of [...req].sort()) {
    if (!tables.has(t)) { log(`  MISSING  ${t}: table does not exist in the source database`); problems++; }
    else if (excluded.has(t)) log(`  excluded ${t}`);
    else if (!sel.has(t)) { log(`  NOT LINKED ${t}: exists but has no branch column or rule. Columns: ${colNames(t).join(', ')}`); problems++; }
    else if (counts.get(t) === 0) log(`  empty    ${t}: 0 rows for this branch`);
    else log(`  ok       ${t}: ${counts.get(t)} rows`);
  }
  const unreached = [...tables].filter((t) => !sel.has(t) && !excluded.has(t)).sort();
  log(`\n  Tables NOT included (${unreached.length}). Check any that should belong to a branch:`);
  for (const t of unreached) {
    const hint = colNames(t).filter((x) => /(^|_)(id|ids)$|id$/i.test(x) || /branch/i.test(x)).slice(0, 8);
    log(`    - ${t}${hint.length ? '   [' + hint.join(', ') + ']' : ''}`);
  }
  if (rec) {
    const un = [...seeded.keys()].filter((t) => (counts.get(t) || 0) > 0 && !filtered.has(t) && !recSkip.has(t));
    if (un.length) {
      log('\n  Seeded tables copied IN FULL (no recency filter). Date columns you could filter on:');
      for (const t of un) {
        const dcs = (cols.get(t) || []).filter((x) => /^(date|timestamp)/.test(x.typ)).map((x) => x.name);
        log(`    - ${t.padEnd(32)} ${String(counts.get(t)).padStart(8)} rows   ${dcs.length ? 'date columns: ' + dcs.join(', ') : 'no date columns'}`);
      }
      log("    Add the right column names to recency.columns in the config to filter them.");
    }
  }
  const branchish = [];
  for (const t of tables) for (const x of colNames(t)) if (/branch/i.test(x) && !excluded.has(t) && !seeded.has(t) && sel.has(t) === false) branchish.push(`${t}.${x}`);
  if (branchish.length) log(`\n  Branch-like columns on tables that were not seeded (review): ${branchish.join(', ')}`);
  log('\n  Row counts:');
  for (const [t, v] of [...counts].sort((a, b) => b[1] - a[1])) log(`    ${String(v).padStart(10)}  ${t}`);
  log(`  Total: ${[...counts.values()].reduce((a, b) => a + b, 0)} rows in ${counts.size} tables`);
  if (problems) log(`\n  ${problems} required table(s) could not be captured. Fix the config before relying on this dump.`);
  if (problems && dryRun) { await c.query('ROLLBACK'); await c.end(); process.exit(2); }
  if (problems) die('required tables missing/not linked (see report). Nothing was written.');

  // ------------------------------------------------------------ ordering helper (parents first)
  const allEdges = [...downEdges, ...upEdges];
  const topo = (set, extra = []) => {
    const deps = new Map([...set].map((t) => [t, new Set()]));
    for (const e of [...allEdges, ...extra]) if (e.child !== e.parent && deps.has(e.child) && deps.has(e.parent)) deps.get(e.child).add(e.parent);
    const out = []; const done = new Set(); const left = new Set(set);
    while (left.size) {
      let ready = [...left].filter((t) => [...deps.get(t)].every((d) => done.has(d))).sort();
      if (!ready.length) ready = [...left].sort(); // cycle
      ready.forEach((t) => { out.push(t); done.add(t); left.delete(t); });
    }
    return out;
  };
  const order = topo(new Set(counts.keys()));

  // ------------------------------------------------------------ target
  let targetCols = null;
  if (target) {
    log(`\nTarget: ${describe(targetUrl)}`);
    targetCols = new Map();
    for (const r of (await target.query(
      `SELECT c.relname t, a.attname::text n FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
       JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname=$1 AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped`, [S])).rows) {
      if (!targetCols.has(r.t)) targetCols.set(r.t, new Set());
      targetCols.get(r.t).add(r.n);
    }
    const missing = order.filter((t) => !targetCols.has(t));
    if (missing.length) die(`target is missing tables: ${missing.join(', ')}. Run the migrations on staging first.`);
  }

  // ------------------------------------------------------------ target foreign keys vs the selected data
  if (target) {
    log(`\n=== Target foreign-key check: ${tfk.checked} single-column keys checked ===`);
    for (const f of tfk.skipped) log(`  skipped (composite key, not checked): ${f.child}(${f.childCols}) -> ${f.parent}(${f.parentCols})`);
    if (tfk.dangling.length) {
      log("  DANGLING: the target's foreign keys would reject these. The referenced rows don't exist anywhere we can copy from:");
      for (const d of tfk.dangling) {
        log(`    ${d.child}(${d.childCols}) -> ${d.parent}(${d.parentCols})   ${d.why}`);
        if (d.missing) log(`      ${d.missing.length} distinct missing value(s), e.g. ${d.missing.slice(0, 5).join(', ')}`);
      }
      log('  Fix the data in production, or tell me which columns to blank out for these rows.');
      if (!dryRun) die('target foreign keys cannot be satisfied (see above). Nothing was changed.');
    } else log('  all satisfiable');
  }

  // Tables loaded with ON CONFLICT DO NOTHING silently skip a row when ANY unique index collides, not just the key.
  // Children that point at the skipped row's id then fail on the target's foreign key. Find those rows up front.
  const skipped = [];
  if (target) {
    for (const t of Object.keys(cfg.conflict || {})) {
      if ((cfg.conflict[t] !== 'nothing') || !sel.has(t)) continue;
      const pk = t === (cfg.branchTable && cfg.branchTable.name) ? cfg.branchTable.pk : '_id';
      if (!colNames(t).includes(pk)) continue;
      const idx = (await target.query(`SELECT i.indexrelid::regclass::text AS name, array_agg(a.attname::text ORDER BY k.ord) AS cols
        FROM pg_index i JOIN pg_class r ON r.oid = i.indrelid JOIN pg_namespace n ON n.oid = r.relnamespace
        CROSS JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
        LEFT JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum = k.attnum
        WHERE i.indisunique AND NOT i.indisprimary AND i.indpred IS NULL AND n.nspname = $1 AND r.relname = $2
        GROUP BY i.indexrelid HAVING bool_and(k.attnum > 0)`, [cfg.schema || 'public', t])).rows;
      for (const ix of idx) {
        if (!ix.cols.every((x) => colNames(t).includes(x))) continue;
        const rows = (await c.query(`SELECT p.${q(pk)}::text AS pk, ${ix.cols.map((x, i) => `p.${q(x)}::text AS c${i}`).join(', ')}
          FROM ${qt(t)} p JOIN ${sel.get(t)} s ON s.tid = p.ctid WHERE ${ix.cols.map((x) => `p.${q(x)} IS NOT NULL`).join(' AND ')}`)).rows;
        if (!rows.length) continue;
        const spec = ix.cols.map((x, i) => `c${i} text`).join(', ');
        const join = ix.cols.map((x, i) => `t.${q(x)}::text = s.c${i}`).join(' AND ');
        const hit = (await target.query(`SELECT s.pk AS src_pk, t.${q(pk)}::text AS tgt_pk, ${ix.cols.map((x, i) => `s.c${i}`).join(', ')}
          FROM json_to_recordset($1::json) AS s(pk text, ${spec}) JOIN ${qt(t)} t ON ${join} WHERE t.${q(pk)}::text <> s.pk`, [JSON.stringify(rows)])).rows;
        for (const h of hit) skipped.push({ t, index: ix.name, cols: ix.cols, h });
      }
    }
    log(`\n=== Rows the target would silently skip (unique-index collision under ON CONFLICT DO NOTHING) ===`);
    if (skipped.length) {
      for (const k of skipped.slice(0, 40)) log(`  ${k.t}: prod ${k.h.src_pk} collides with dev ${k.h.tgt_pk} on ${k.index} (${k.cols.map((x) => `${x}=${k.h['c' + k.cols.indexOf(x)]}`).join(', ')})`);
      if (skipped.length > 40) log(`  … and ${skipped.length - 40} more`);
      log('  Anything in the load that references these prod ids will fail the target foreign keys.');
      if (args['remap-collisions']) {
        log('  --remap-collisions: those prod rows are NOT inserted; every reference to them is rewritten to the dev row\'s id.');
      } else {
        log('  Re-run with --remap-collisions to point everything at the existing dev rows instead.');
        if (!dryRun) die('rows would be silently skipped by unique-index collisions (see above). Nothing was changed.');
      }
    } else log('  none');
  }

  // Remap plan: prod id -> existing dev id, applied to the colliding table's own rows and to every column that references it.
  const remap = new Map();       // table -> temp table name
  const remapCols = new Map();   // child table -> [{col, rt}]
  if (target && skipped.length && args['remap-collisions']) {
    const byT = new Map();
    for (const k of skipped) { if (!byT.has(k.t)) byT.set(k.t, new Map()); byT.get(k.t).set(k.h.src_pk, k.h.tgt_pk); }
    for (const [t, m] of byT) {
      const rt = `_remap_${t.replace(/\W/g, '_')}`;
      await c.query(`CREATE TEMP TABLE ${rt} (src text PRIMARY KEY, tgt text NOT NULL)`);
      for (const [a, b] of m) await c.query(`INSERT INTO ${rt} VALUES ($1,$2)`, [a, b]);
      remap.set(t, rt);
    }
    const seen = new Set();
    for (const f of [...upEdges, ...targetFksAll]) {
      if (!remap.has(f.parent) || f.childCols.length !== 1 || f.parentCols.length !== 1) continue;
      const pk = f.parent === (cfg.branchTable && cfg.branchTable.name) ? cfg.branchTable.pk : '_id';
      if (f.parentCols[0] !== pk || !sel.has(f.child) || !colNames(f.child).includes(f.childCols[0])) continue;
      const key = `${f.child}|${f.childCols[0]}`;
      if (seen.has(key)) continue; seen.add(key);
      if (!remapCols.has(f.child)) remapCols.set(f.child, []);
      remapCols.get(f.child).push({ col: f.childCols[0], rt: remap.get(f.parent) });
    }
    for (const [ct, list] of remapCols) for (const { col, rt } of list) {
      const n = (await c.query(`SELECT count(*)::int AS n FROM ${qt(ct)} t JOIN ${sel.get(ct)} s ON s.tid = t.ctid JOIN ${rt} r ON r.src = t.${q(col)}::text`)).rows[0].n;
      if (n) log(`  remap ${ct}.${col}: ${n} row(s) re-pointed to the existing dev row`);
    }
  }

  // ------------------------------------------------------------ wipe plan (--replace)
  // Delete only rows that OWN-by-branch: seed rules + down links, evaluated on the target.
  // No window (all of the branch's old rows go), no "up" parents (shared), never the branch row itself.
  const wipes = []; // { t, sql }
  if (replace) {
    const hasT = (t) => (targetCols ? targetCols.has(t) : tables.has(t));
    const colsOf = (t) => (targetCols ? [...(targetCols.get(t) || [])] : colNames(t));
    const keep = new Set([cfg.branchTable.name, ...(cfg.keepOnWipe || []), ...(cfg.fullTables || [])]);
    const pat = new RegExp(cfg.branchColumnPattern.source, cfg.branchColumnPattern.flags);
    // wipeOnly links: rows in tables we do NOT copy that must still be cleared before their parents can go
    const wipeOnlyEdges = (cfg.wipeOnly || []).filter((e) => hasT(e.child) && hasT(e.parent)
      && e.childCols.every((x) => colsOf(e.child).includes(x)) && e.parentCols.every((x) => colsOf(e.parent).includes(x)));
    const wEdges = [...downEdges, ...wipeOnlyEdges];
    const wipeOnlyTables = new Set(wipeOnlyEdges.map((e) => e.child));
    const pred = (t, stack) => {
      const parts = colsOf(t).filter((x) => pat.test(x)).map((x) => `c.${q(x)}::text = ${B}`);
      if (cfg.extraSeeds && cfg.extraSeeds[t]) parts.push(cfg.extraSeeds[t].split('{{branch}}').join(B));
      for (const e of wEdges) {
        if (e.child !== t || !hasT(e.parent) || stack.includes(e.parent)) continue;
        const sub = pred(e.parent, [...stack, t]);
        if (sub) parts.push(`${tupleOf('c', e.childCols)} IN (SELECT ${tupleOf('c', e.parentCols)} FROM ${qt(e.parent)} c WHERE ${sub})`);
      }
      return parts.length ? parts.map((p) => `(${p})`).join(' OR ') : null;
    };
    const cands = new Set();
    for (const t of new Set([...tables, ...wipeOnlyTables])) {
      if ((ok(t) || wipeOnlyTables.has(t)) && hasT(t) && !keep.has(t) && pred(t, [])) cands.add(t);
    }
    // the target's own foreign keys decide the delete order and reveal anything that would block it
    const tFks = target ? targetFksAll : realFks;
    const fkIn = tFks.filter((f) => cands.has(f.child) && cands.has(f.parent));
    for (const t of topo(cands, [...wipeOnlyEdges, ...fkIn]).reverse()) wipes.push({ t, sql: `DELETE FROM ${qt(t)} AS c WHERE ${pred(t, [])};` }); // children first
    if (target) {
      log('\n=== --replace: rows that will be DELETED from the target first ===');
      let tot = 0;
      for (const w of wipes) {
        w.n = Number((await target.query(`SELECT count(*) FROM ${qt(w.t)} AS c WHERE ${w.sql.split(' WHERE ').slice(1).join(' WHERE ').replace(/;$/, '')}`)).rows[0].count);
        tot += w.n;
        if (w.n) log(`    ${String(w.n).padStart(10)}  ${w.t}${wipeOnlyTables.has(w.t) ? '   (wipe only, not copied)' : ''}`);
      }
      log(`  Total to delete: ${tot}   (kept untouched: ${[...keep].join(', ')})`);

      // rows elsewhere in the target that point at rows we are about to delete
      const blockers = [];
      for (const f of tFks) {
        if (f.child === f.parent || !cands.has(f.parent) || !hasT(f.child)) continue;
        const pp = pred(f.parent, []);
        const pc = cands.has(f.child) ? pred(f.child, []) : null;
        const n = Number((await target.query(`SELECT count(*) FROM ${qt(f.child)} AS c WHERE ${tupleOf('c', f.childCols)} IN
          (SELECT ${tupleOf('c', f.parentCols)} FROM ${qt(f.parent)} c WHERE ${pp})${pc ? ` AND NOT COALESCE((${pc}), false)` : ''}`)).rows[0].count);
        if (n) blockers.push({ ...f, n });
      }
      if (blockers.length) {
        log('\n  BLOCKED: these target rows reference rows that --replace must delete, so the delete would fail.');
        log('  Add a matching entry to "wipeOnly" in the config (clears them, does not copy them), or exclude the parent:');
        for (const bl of blockers) {
          log(`    ${String(bl.n).padStart(8)} rows in ${bl.child}(${bl.childCols}) -> ${bl.parent}(${bl.parentCols})`);
          log(`      { child: '${bl.child}', childCols: ${JSON.stringify(bl.childCols)}, parent: '${bl.parent}', parentCols: ${JSON.stringify(bl.parentCols)} },`);
        }
        if (!dryRun) die('delete would violate foreign keys (see above). Nothing was changed.');
      }
    }
  }

  if (dryRun) {
    await c.query('ROLLBACK'); await c.end(); if (target) await target.end();
    process.exit(0);
  }
  if (target) await target.query('BEGIN');

  const fd = args.out ? fs.openSync(args.out, 'w') : null;
  const emit = async (sql, isStmt) => {
    if (fd !== null) fs.writeSync(fd, sql + '\n');
    if (target && isStmt) return target.query(sql);
    return null;
  };
  const onConflict = args['on-conflict'] || (replace ? 'update' : 'none');
  const chunkRows = Number(args.chunk || 500), chunkBytes = 4 * 1024 * 1024;

  try {
    await emit(`-- Branch dump: branch ${branch}, generated ${new Date().toISOString()}\n-- windows: ${winNote}; recency: ${recSince || 'off'}\nBEGIN;\n`, false);
    if (replace) {
      await emit('-- --replace: remove this branch\'s existing rows first (children before parents)', false);
      for (const w of wipes) {
        const r = await emit(w.sql, true);
        if (r) log(`  deleted ${String(r.rowCount).padStart(8)}  ${w.t}`);
      }
      await emit('', false);
    }
    for (const t of order) {
      const total = counts.get(t);
      if (!total) continue;
      let use = (cols.get(t) || []).filter((x) => !x.gen).map((x) => x.name);
      if (targetCols) {
        const dropped = use.filter((x) => !targetCols.get(t).has(x));
        if (dropped.length) log(`  warn: ${t}: target lacks column(s) ${dropped.join(', ')}; skipped`);
        use = use.filter((x) => targetCols.get(t).has(x));
      }
      const mask = (cfg.mask || {})[t] || {};
      const rmap = Object.fromEntries((remapCols.get(t) || []).map((r) => [r.col, r.rt]));
      const selectList = use.map((x) => (mask[x] ? `(${mask[x]}) AS ${q(x)}` : rmap[x]
        ? `COALESCE((SELECT r.tgt FROM ${rmap[x]} r WHERE r.src = t.${q(x)}::text), t.${q(x)}) AS ${q(x)}` : `t.${q(x)}`)).join(', ');
      const ownPk = t === (cfg.branchTable && cfg.branchTable.name) ? cfg.branchTable.pk : '_id';
      const skipOwn = remap.has(t) ? ` WHERE NOT EXISTS (SELECT 1 FROM ${remap.get(t)} r WHERE r.src = t.${q(ownPk)}::text)` : '';
      const colList = use.map(q).join(',');
      let tail = '';
      const pk = pks.get(t);
      const mode = (cfg.conflict || {})[t] || onConflict; // per-table rule in the config wins
      if (mode === 'nothing' || (mode === 'update' && !pk)) tail = ' ON CONFLICT DO NOTHING';
      else if (mode === 'update') {
        const set = use.filter((x) => !pk.includes(x)).map((x) => `${q(x)} = EXCLUDED.${q(x)}`);
        tail = set.length ? ` ON CONFLICT (${pk.map(q).join(',')}) DO UPDATE SET ${set.join(', ')}` : ' ON CONFLICT DO NOTHING';
      }
      await emit(`-- ${t}: ${total} rows`, false);
      const cur = `cur_${t.replace(/\W/g, '_')}`.slice(0, 60);
      await c.query(`DECLARE ${cur} NO SCROLL CURSOR FOR
        SELECT row_to_json(x)::text AS j FROM (SELECT ${selectList} FROM ${qt(t)} t JOIN ${sel.get(t)} s ON s.tid = t.ctid${skipOwn}) x`);
      let buf = [], bytes = 0, written = 0;
      const flush = async () => {
        if (!buf.length) return;
        const body = '[' + buf.join(',') + ']';
        let tag = 'bd'; while (body.includes(`$${tag}$`)) tag += 'x';
        await emit(`INSERT INTO ${qt(t)} (${colList}) OVERRIDING SYSTEM VALUE\nSELECT ${colList} FROM json_populate_recordset(NULL::${qt(t)}, $${tag}$${body}$${tag}$) WHERE true${tail};`, true);
        written += buf.length; buf = []; bytes = 0;
      };
      for (;;) {
        const r = await c.query(`FETCH 2000 FROM ${cur}`);
        if (!r.rows.length) break;
        for (const row of r.rows) {
          buf.push(row.j); bytes += row.j.length;
          if (buf.length >= chunkRows || bytes >= chunkBytes) await flush();
        }
      }
      await flush();
      await c.query(`CLOSE ${cur}`);
      log(`  wrote ${t.padEnd(34)} ${written}`);
      // keep serial/identity sequences ahead of imported ids
      for (const col of (cols.get(t) || []).filter((x) => x.hasdef && !x.gen && use.includes(x.name))) {
        const sq = (await c.query('SELECT pg_get_serial_sequence($1,$2) s', [qt(t), col.name])).rows[0].s;
        if (sq) await emit(`SELECT setval('${sq}', GREATEST((SELECT COALESCE(MAX(${q(col.name)}),1) FROM ${qt(t)}), 1));`, true);
      }
    }
    await emit('COMMIT;', false);
    if (target) await target.query('COMMIT');
  } catch (err) {
    if (target) await target.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
  await c.query('ROLLBACK');
  await c.end();
  if (target) await target.end();
  log(`\nDone.${args.out ? ' SQL file: ' + args.out : ''}${target ? ' Loaded into target in a single transaction.' : ''}`);
}

main().catch((e) => { console.error('FAILED:', e.message); if (e.detail) console.error('  detail:', e.detail); if (e.table) console.error('  table:', e.table, e.constraint || ''); process.exit(1); });
