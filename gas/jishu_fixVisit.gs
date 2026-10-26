/**
 * 自習室アプリ(自習室予約(マル直))に足す:先生が退室時間を直す
 * やりきリストの「✏️ 自習時間のなおし」から呼ばれ、「来室」シートの 退室・時間(分)・メモ を書きかえる。
 *
 * 【入れ方】
 * 1. スプレッドシート「自習室予約(マル直)」→ 拡張機能 → Apps Script を開く
 * 2. このファイルの中身を、いちばん下にそのまま貼り付ける
 * 3. いまある doPost(e) の { のすぐ下(1行目)に、つぎの1行を足す
 *
 *      const _fx = fixVisitRoute_(e); if (_fx) return _fx;
 *
 * 4. デプロイ → デプロイを管理 → 鉛筆(編集)→ バージョン「新バージョン」→ デプロイ
 *    (「新しいデプロイ」にするとURLが変わってしまうので、必ず「デプロイを管理」から)
 */

function fixVisitRoute_(e) {
  let b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return null; }
  if (b.action !== 'fixVisit') return null;
  let res;
  try { res = fixVisit_(b); } catch (err) { res = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/* b = { date:'2026-10-23', name:'右京', inMs:1761206820000, in:'17:07', out:'19:30' | '' }
   out を入れると その時間で退室に。out が空なら、直す前の退室(メモに残してある)にもどす。 */
function fixVisit_(b) {
  const TZ = 'Asia/Tokyo';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('来室');
  if (!sh) return { ok: false, error: '来室シートがありません' };
  const vals = sh.getDataRange().getValues();
  const norm = s => String(s || '').normalize('NFKC').replace(/\s/g, '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const day = v => v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '').replace(/\//g, '-').slice(0, 10);
  const toDate = v => v instanceof Date ? v : (v ? new Date(String(v).replace(/-/g, '/')) : null);
  const hhmm = d => d ? Utilities.formatDate(d, TZ, 'HH:mm') : '';

  let row = -1, best = 1e15;
  for (let i = 1; i < vals.length; i++) {
    const r = vals[i];
    if (day(r[0]) !== b.date) continue;
    if (norm(r[1]) !== norm(b.name)) continue;
    const inD = toDate(r[3]);
    // 入室時刻がいちばん近い行(同じ日に2回来た子もいるので)
    const diff = b.inMs && inD ? Math.abs(inD.getTime() - Number(b.inMs)) : (hhmm(inD) === String(b.in || '').slice(0, 5) ? 0 : 1e14);
    if (diff < best) { best = diff; row = i; }
  }
  if (row < 0 || best > 5 * 60 * 1000) return { ok: false, error: '来室の記録が見つかりません' };

  const r = vals[row], inD = toDate(r[3]);
  // 元にもどすときは、メモに残した「元 HH:MM」を使う
  const prev = /退室を先生が修正\(元 ([^)]*)\)/.exec(String(r[7] || ''));
  if (!b.out && !prev) return { ok: true, row: row + 1, note: '直した記録はありません' };
  const target = b.out ? b.out : (prev[1] === 'なし' ? '' : prev[1]);
  const cellOut = sh.getRange(row + 1, 5), cellMin = sh.getRange(row + 1, 6), cellMemo = sh.getRange(row + 1, 8);
  let memo = String(r[7] || '').replace(/\s*\/?\s*退室を先生が修正\(元 [^)]*\)/g, '').trim();
  const orig = prev ? prev[1] : (hhmm(toDate(r[4])) || 'なし');   // 2回目に直すときも、いちばん最初の時間を残す
  if (target) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(target);
    if (!m) return { ok: false, error: '時間の形がちがいます' };
    const outD = new Date(inD.getTime()); outD.setHours(+m[1], +m[2], 0, 0);   // 入室と同じ日のその時間
    if (outD <= inD) return { ok: false, error: '入室より前の時間です' };
    cellOut.setValue(outD);
    cellMin.setValue(Math.round((outD - inD) / 60000));
    if (b.out) memo = (memo ? memo + ' / ' : '') + `退室を先生が修正(元 ${orig})`;
  } else {   // 元にもどす:もともと退室がなかった記録
    cellOut.clearContent(); cellMin.clearContent();
  }
  cellMemo.setValue(memo);
  return { ok: true, row: row + 1 };
}
