/**
 * ガチャ券:期末の誘魔の期間(11/1〜11/8)に「すり抜け」た習慣の攻撃を、ガチャ券のダメージに換算する
 *
 * 誘魔には打撃・斬撃が効かなかったので、その間の習慣はダメージログに残っていない。
 * 記録シートから「その日に攻撃していたら入ったダメージ」を計算してここに入れた
 * (やりきった数 × Lv × 10 × 連続ボーナス。会心・状態異常はなし。モブに攻撃が入った日は除く)。
 * ボスのHPやランキングには入れず、ガチャ券(累計ダメージ2万で1枚)と「15日」の日数にだけ足す。
 *
 * 【入れ方】やりきリストのGAS(コード.gs)
 * 1. いまある function getTickets(body) { … } をまるごと消して、このファイルの中身を貼る
 * 2. デプロイ → デプロイを管理 → 鉛筆 → バージョン「新バージョン」→ デプロイ
 */

// 生徒ID: { dmg: 換算ダメージ, days: 習慣をやった日(15日のカウントに足す) }
const GACHA_KIMATSU_CONV = {"1":{"dmg":1080,"days":["2026-11-05","2026-11-08"]},"3":{"dmg":25920,"days":["2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06","2026-11-07","2026-11-08"]},"4":{"dmg":10350,"days":["2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06","2026-11-07","2026-11-08"]},"20":{"dmg":5040,"days":["2026-11-02","2026-11-03","2026-11-05","2026-11-06","2026-11-08"]},"19":{"dmg":15620,"days":["2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06","2026-11-07","2026-11-08"]},"22":{"dmg":1140,"days":["2026-11-03","2026-11-04","2026-11-05"]},"6":{"dmg":11250,"days":["2026-11-01","2026-11-02","2026-11-04","2026-11-05","2026-11-06","2026-11-07"]},"5":{"dmg":3440,"days":["2026-11-02","2026-11-04","2026-11-06","2026-11-07"]},"17":{"dmg":700,"days":["2026-11-02"]},"15":{"dmg":13020,"days":["2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-08"]},"10":{"dmg":280,"days":["2026-11-02"]},"2":{"dmg":2430,"days":["2026-11-04","2026-11-05","2026-11-06","2026-11-08"]},"23":{"dmg":750,"days":["2026-11-01","2026-11-05","2026-11-06"]},"7":{"dmg":4080,"days":["2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-06","2026-11-08"]}};

function getTickets(body) {
  const today = gachaToday_();
  const month = today.slice(0, 7);
  const per = {};
  const P = id => (per[id] = per[id] || { dmg: 0, conv: 0, days: {}, hero: 0, used: 0, adj: 0 });
  getSheet(SHEET_NAME_DAMAGE).getDataRange().getValues().slice(1).forEach(r => {
    if (!r[0] || !String(r[1])) return;
    const d = formatDate(r[0]);
    if (d < GACHA_START) return;
    const o = P(String(r[1]));
    o.dmg += Number(r[3]) || 0;
    const m = d.slice(0, 7);
    (o.days[m] = o.days[m] || {})[d] = 1;
  });
  // 期末の誘魔ですり抜けた習慣の攻撃(換算)
  Object.keys(GACHA_KIMATSU_CONV).forEach(id => {
    const c = GACHA_KIMATSU_CONV[id], o = P(id);
    o.dmg += Number(c.dmg) || 0; o.conv += Number(c.dmg) || 0;
    (c.days || []).forEach(d => { const m = d.slice(0, 7); (o.days[m] = o.days[m] || {})[d] = 1; });
  });
  gachaSheet_().getDataRange().getValues().slice(1).forEach(r => {
    const id = String(r[1] || ''); if (!id) return;
    const n = Number(r[4]) || 0, kind = String(r[3]);
    if (kind === 'とどめ') P(id).hero += n;
    else if (kind === '使用') P(id).used += n;
    else if (kind === '調整') P(id).adj += n;
  });
  const out = {};
  Object.keys(per).forEach(id => {
    const o = per[id];
    const dayTickets = Object.keys(o.days).filter(m => Object.keys(o.days[m]).length >= GACHA_DAYS).length;
    const dmgTickets = Math.floor(o.dmg / GACHA_DMG);
    const earned = dmgTickets + o.hero + dayTickets + o.adj;
    out[id] = {
      dmg: o.dmg, conv: o.conv, dmgTickets: dmgTickets, toNext: GACHA_DMG - (o.dmg % GACHA_DMG), hero: o.hero, dayTickets: dayTickets, adj: o.adj,
      monthDays: Object.keys(o.days[month] || {}).length, earned: earned, used: o.used, available: Math.max(0, earned - o.used),
    };
  });
  let tickets = out;
  if (body && body.studentId != null && body.studentId !== '') {
    tickets = {}; tickets[String(body.studentId)] = out[String(body.studentId)] || null;
  }
  return { ok: true, start: GACHA_START, today: today, perDmg: GACHA_DMG, needDays: GACHA_DAYS, tickets: tickets };
}
