// ========================================
// 霜月の大魔王(11月後半のボス)
//  ・GASの画面で「霜月の大魔王を出す」を選んで ▶実行 すると登場
//    (いま出ている雑魚や、残っている期末の誘魔は逃げる)
//  ・ふつうのボスなので、やりきリストの習慣・マル単の魔法・召喚、ぜんぶ効く
//  ・倒されると、いつもの仕組みで「覚醒した霜月の大魔王」(HP 120,000、絵は boss_shimotsuki_awk.png)に入れ替わる
//  ・数字やドロップは下の定数で調整できます
// ========================================
const SHIMOTSUKI_NAME     = '霜月の大魔王';
const SHIMOTSUKI_HP       = 50000;
const SHIMOTSUKI_PERIOD   = '2026/11/21〜2026/11/30';
const SHIMOTSUKI_IMAGE    = 'boss_shimotsuki.png';   // 覚醒すると boss_shimotsuki_awk.png に自動で切りかわる
const SHIMOTSUKI_TREASURE = 'みかん🍊(塾で全員に！)';
const SHIMOTSUKI_THEME    = '霜月';

function 霜月の大魔王を出す() {
  const sheet = getSheet(SHEET_NAME_BOSS);
  const rows = sheet.getDataRange().getValues();
  const last = rows[rows.length - 1];
  if (String(last[0]).indexOf(SHIMOTSUKI_NAME) >= 0 && last[7] !== 'YES') { Logger.log('もう出ています'); return; }
  if (last[7] !== 'YES') sheet.getRange(rows.length, 8).setValue('にげた');   // いまの敵(雑魚・期末の誘魔)は逃げる
  if (String(last[9]) === KIMATSU_TYPE) PropertiesService.getScriptProperties().deleteProperty('KIMATSU_START');
  sheet.appendRow([SHIMOTSUKI_NAME, SHIMOTSUKI_HP, SHIMOTSUKI_PERIOD, (Number(last[3]) || 1) + 1, SHIMOTSUKI_HP,
                   SHIMOTSUKI_IMAGE, SHIMOTSUKI_TREASURE, '', '', 'boss', SHIMOTSUKI_THEME]);
  Logger.log(SHIMOTSUKI_NAME + ' 登場！ HP ' + SHIMOTSUKI_HP + '(倒すと覚醒した' + SHIMOTSUKI_NAME + 'に入れ替わる)');
}
