#!/usr/bin/env node
/**
 * Rebuild data/mlb-career.json from MLB Stats API (recent seasons + legends).
 * Usage: node scripts/build-mlb-career.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'data', 'mlb-career.json');
const UA = { 'User-Agent': 'CardVault/1.0' };

async function get(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

async function one(mid) {
  const pj = await get(`https://statsapi.mlb.com/api/v1/people/${mid}?hydrate=currentTeam`);
  const p = (pj.people || [])[0];
  if (!p) return null;
  async function career(group) {
    const j = await get(`https://statsapi.mlb.com/api/v1/people/${mid}/stats?stats=career&group=${group}`);
    for (const block of j.stats || []) {
      const split = (block.splits || [])[0];
      if (split?.stat) return split.stat;
    }
    return null;
  }
  const [hitting, pitching] = await Promise.all([career('hitting'), career('pitching')]);
  let h = null;
  if (hitting && +(hitting.atBats || 0) > 0) {
    h = {
      g: +hitting.gamesPlayed || 0, ab: +hitting.atBats || 0, h: +hitting.hits || 0,
      hr: +hitting.homeRuns || 0, rbi: +hitting.rbi || 0, sb: +hitting.stolenBases || 0,
      bb: +hitting.baseOnBalls || 0, so: +hitting.strikeOuts || 0,
      avg: hitting.avg || '', obp: hitting.obp || '', slg: hitting.slg || '', ops: hitting.ops || '',
    };
  }
  let pit = null;
  if (pitching && +(pitching.gamesPlayed || 0) > 0) {
    pit = {
      g: +pitching.gamesPlayed || 0, gs: +pitching.gamesStarted || 0,
      w: +pitching.wins || 0, l: +pitching.losses || 0, sv: +pitching.saves || 0,
      ip: pitching.inningsPitched || '', so: +pitching.strikeOuts || 0, bb: +pitching.baseOnBalls || 0,
      era: pitching.era || '', whip: pitching.whip || '',
    };
  }
  return {
    mlbId: +mid,
    fullName: p.fullName || '',
    pos: p.primaryPosition?.abbreviation || '',
    team: p.currentTeam?.name || '',
    bats: p.batSide?.code || '',
    throws: p.pitchHand?.code || '',
    birthDate: p.birthDate || '',
    debutDate: p.mlbDebutDate || '',
    hitting: h,
    pitching: pit,
  };
}

const ids = new Set();
for (const season of [2026, 2025, 2024]) {
  const j = await get(`https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}`);
  for (const p of j.people || []) if (p.id) ids.add(+p.id);
  console.log('season', season, 'unique', ids.size);
}

const legends = ['Babe Ruth','Lou Gehrig','Ted Williams','Willie Mays','Mickey Mantle','Hank Aaron',
  'Jackie Robinson','Ken Griffey Jr','Barry Bonds','Derek Jeter','Ichiro Suzuki','Albert Pujols',
  'Shohei Ohtani','Mike Trout','Aaron Judge','Nolan Ryan','Sandy Koufax'];
for (const q of legends) {
  const j = await get('https://statsapi.mlb.com/api/v1/people/search?names=' + encodeURIComponent(q) + '&sportIds=1');
  for (const p of (j.people || []).slice(0, 2)) if (p.id) ids.add(+p.id);
}

const list = [...ids];
const byId = {}, byName = {};
const conc = 16;
for (let i = 0; i < list.length; i += conc) {
  const chunk = list.slice(i, i + conc);
  const rows = await Promise.all(chunk.map((id) => one(id).catch(() => null)));
  for (const row of rows) {
    if (!row?.mlbId) continue;
    byId[String(row.mlbId)] = row;
    if (row.fullName) byName[row.fullName.toLowerCase()] = String(row.mlbId);
  }
  console.log(Math.min(i + conc, list.length), '/', list.length, 'ok', Object.keys(byId).length);
}

const out = {
  v: 1,
  source: 'statsapi.mlb.com',
  updated: new Date().toISOString(),
  count: Object.keys(byId).length,
  byId,
  byName,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('wrote', outPath, out.count, 'players');
