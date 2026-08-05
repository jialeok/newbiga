// logic/bidding-workflow.js — 竞价主流程
import { CONFIG, POINT_TO_COLUMN } from '../config.js';
import { beijingToday } from '../../_shared-source/date-utils.js';
import { isTradingDay, getConstituentThscodes, getStockSnapshotPcts } from '../data/fuyao-api.js';
import { readTodayBiddingRows, upsertBiddingRows, writeLog } from '../data/supabase-write.js';
import { computeBiddingRows, avgOf, fmtPct } from './bidding-calc.js';

export async function runBidding(env, point, source) {
  const date = beijingToday();
  const column = POINT_TO_COLUMN[point];
  const logBase = { run_date: date, time_point: point, source: source || 'cron', job: 'bidding', worker: 'A' };
  if (!column) return { ok: false, error: '未知 time_point: ' + point };

  if (!(await isTradingDay(env))) {
    await writeLog(env, Object.assign(logBase, { ok: false, detail: { skipped: '非交易日' } }));
    return { ok: false, error: '非交易日，已跳过' };
  }

  const computed = await computeBiddingRows(env, point);
  const failedRowNames = Object.keys(computed).filter(k => computed[k].value === null || computed[k].value === undefined);
  if (failedRowNames.length > 0) {
    console.log('本趟有 ' + failedRowNames.length + ' 行未抓到(' + failedRowNames.join(',') + ')，45 秒后重试...');
    await new Promise(r => setTimeout(r, 45000));
    try {
      const retry = await computeBiddingRows(env, point);
      failedRowNames.forEach(k => { if (retry[k] && retry[k].value !== null && retry[k].value !== undefined) computed[k] = retry[k]; });
    } catch (e) { console.warn('45 秒重试失败:', e.message); }
  }

  const now = new Date().toISOString();
  let existingByName = {};
  if (point === 't0925') {
    try { (await readTodayBiddingRows(env, date)).forEach(r => existingByName[(r.name || '').trim()] = r); }
    catch (e) { console.error('读今日行失败:', e.message); }
  }

  const upsertPayload = [];
  const rowResults = {};
  Object.keys(computed).forEach(rowName => {
    const r = computed[rowName];
    rowResults[rowName] = r;
    if (r.value === null || r.value === undefined) return;
    const row = { date: date, name: rowName, updated_at: now };
    row[column] = r.value;
    if (point === 't0925') {
      const prev = existingByName[rowName];
      const v920 = prev ? parseFloat(prev.time920) : NaN;
      const v925 = parseFloat(r.value);
      if (!isNaN(v920) && !isNaN(v925)) row.change = v925 > v920 ? '增' : (v925 < v920 ? '减' : '平');
      if (rowName === CONFIG.ROW_LADDER) {
        const prevInitial = prev ? prev.time930_initial : null;
        if (prevInitial !== undefined && prevInitial !== null && String(prevInitial).trim() !== '') {
          row.time930_initial = prevInitial;
          row.time930_initial_modifiedAt = (prev && prev.time930_initial_modifiedAt) || now;
        } else {
          row.time930_initial = r.value;
          row.time930_initial_modifiedAt = now;
        }
      }
    }
    upsertPayload.push(row);
  });

  let ok = true, writeError = null;
  if (upsertPayload.length > 0) {
    try { await upsertBiddingRows(env, upsertPayload); }
    catch (e) { ok = false; writeError = e.message; }
  }
  await writeLog(env, Object.assign(logBase, { ok, detail: { written: upsertPayload, rows: rowResults, writeError } }));
  return { ok, date, point, column, written: upsertPayload, rows: rowResults, writeError };
}

export async function runDuobanSecond(env, source) {
  const date = beijingToday();
  const logBase = { run_date: date, time_point: 't0926', source: source || 'cron', job: 'duoban-second', worker: 'A' };

  if (!(await isTradingDay(env))) {
    await writeLog(env, Object.assign(logBase, { ok: false, detail: { skipped: '非交易日' } }));
    return { ok: false, error: '非交易日，已跳过' };
  }

  let duobanResult;
  try {
    const codes = await getConstituentThscodes(env, CONFIG.LADDER_INDEX);
    if (codes.length === 0) throw new Error('883410 成分股为空');
    const pcts = await getStockSnapshotPcts(env, codes);
    const vals = codes.map(c => pcts[c]).filter(v => typeof v === 'number' && !isNaN(v));
    const avg = avgOf(vals);
    if (avg === null) throw new Error('成分股快照全部缺失');
    duobanResult = { value: fmtPct(avg), missing: codes.length - vals.length > 0 ? [String(codes.length - vals.length) + '只无快照'] : undefined };
  } catch (e) { duobanResult = { value: null, error: e.message }; }

  let existing = null;
  try {
    const rows = await readTodayBiddingRows(env, date);
    existing = rows.find(r => (r.name || '').trim() === CONFIG.ROW_LADDER) || null;
  } catch (e) { console.error('读今日行失败:', e.message); }

  const now = new Date().toISOString();
  const row = { date: date, name: CONFIG.ROW_LADDER, time930: duobanResult.value, updated_at: now };

  if (existing && existing.time930_initial !== undefined && existing.time930_initial !== null && String(existing.time930_initial).trim() !== '') {
    row.time930_initial = existing.time930_initial;
    row.time930_initial_modifiedAt = existing.time930_initial_modifiedAt || now;
    row.time930_modifiedAt = now;
  } else if (duobanResult.value !== null && duobanResult.value !== undefined) {
    row.time930_initial = duobanResult.value;
    row.time930_initial_modifiedAt = now;
  }

  if (existing && existing.time920 !== undefined && existing.time920 !== null && String(existing.time920).trim() !== '' && duobanResult.value !== null) {
    const v926 = parseFloat(duobanResult.value);
    const v920 = parseFloat(existing.time920);
    if (!isNaN(v926) && !isNaN(v920)) row.change = v926 > v920 ? '增' : (v926 < v920 ? '减' : '平');
  }

  let ok = true, writeError = null;
  if (duobanResult.value !== null && duobanResult.value !== undefined) {
    try { await upsertBiddingRows(env, [row]); }
    catch (e) { ok = false; writeError = e.message; }
  }
  await writeLog(env, Object.assign(logBase, { ok, detail: { written: duobanResult.value !== null ? [row] : [], row: duobanResult, writeError } }));
  return { ok, date, point: 't0926', written: duobanResult.value !== null ? [row] : [], row: duobanResult, writeError };
}