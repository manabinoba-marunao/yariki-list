/**
 * やりきリストのGAS(本番:AKfycbxim2…/exec)に足す:範囲表の写真から、学校ワークの範囲をAIで読みとる
 * やりきリストの学習管理「📷 範囲表の写真から入れる」から呼ばれる(action: 'readRange')。
 *
 * 【入れ方】
 * 1. やりきリストのスプレッドシート → 拡張機能 → Apps Script を開く
 * 2. ファイルの「＋」→ スクリプト で readRange という名前のファイルを作り、このファイルの中身をそのまま貼り付ける
 * 3. いまある doPost(e) の { のすぐ下(1行目)に、つぎの1行を足す
 *
 *      const _rr = readRangeRoute_(e); if (_rr) return _rr;
 *
 * 4. 左の歯車「プロジェクトの設定」→ いちばん下「スクリプト プロパティ」→「スクリプト プロパティを追加」
 *      プロパティ: ANTHROPIC_API_KEY   値: sk-ant-… (Claude の APIキー)
 *    ※ Gemini を使うときは GEMINI_API_KEY に Gemini のキーを入れる(両方あれば Claude を使う)
 * 5. デプロイ → デプロイを管理 → 鉛筆(編集)→ バージョン「新バージョン」→ デプロイ
 *    (「新しいデプロイ」にするとURLが変わってしまうので、必ず「デプロイを管理」から)
 * 6. はじめて動かすとき、外部への接続の許可を求められたら「許可」する
 *    (エディタで testReadRangeAuth を一度「実行」すると許可画面が出ます)
 */

function readRangeRoute_(e) {
  let b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return null; }
  if (b.action !== 'readRange') return null;
  let res;
  try { res = readRange_(b); } catch (err) { res = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function readRangePrompt_(b) {
  const subs = (b.subjects || ['英語', '数学', '国語', '理科', '社会']).join('・');
  return [
    'これは日本の学校で配られた定期テストの「テスト範囲表」の写真です。生徒は ' + (b.grade || '中学生') + ' です。',
    '教科ごとに「学校のワーク(問題集・教科書準拠ワーク・漢字ワークなど、提出課題のページ)」のページ範囲を読みとってください。',
    '教科書のページ・プリント・ノートの範囲は入れないでください(ワークだけ)。',
    '対象の教科は ' + subs + ' です。表の教科名が「数学」「理科」などちがう書き方でも、この中の名前にそろえてください。',
    'ひとつのワークでページが「p.4〜10, p.14〜20」のように飛んでいるときは、いちばん小さいページ〜いちばん大きいページにまとめ、note に元の書き方を書いてください。',
    'ワークが2冊以上ある教科(例:国語の漢字ワークと文法ワーク)は works に分けて入れてください(最大3冊)。冊子の名前がわかれば name に、わからなければ "学校ワーク" にしてください。',
    'ページが読みとれない・書かれていない教科は入れないでください。推測でページを作らないでください。',
    '答えは次の形のJSONだけを返してください(説明文やコードブロックは不要):',
    '{"subjects":{"英語":{"works":[{"name":"学校ワーク","from":12,"to":35}],"note":""}}}'
  ].join('\n');
}

function readRange_(b) {
  if (!b.image) return { ok: false, error: '写真がありません' };
  const props = PropertiesService.getScriptProperties();
  const claudeKey = props.getProperty('ANTHROPIC_API_KEY'), geminiKey = (props.getProperty("GEMINI_API_KEY") || "").trim();
  if (!claudeKey && !geminiKey) return { ok: false, error: '先生がまだ「写真の読みとり」の準備(APIキー)をしていません。' };
  const prompt = readRangePrompt_(b), mime = b.mime || 'image/jpeg';
  let text = '';
  if (claudeKey) {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({
        model: props.getProperty('ANTHROPIC_MODEL') || 'claude-sonnet-5-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b.image } },
          { type: 'text', text: prompt }
        ] }]
      })
    });
    const j = JSON.parse(res.getContentText() || '{}');
    if (res.getResponseCode() !== 200) return { ok: false, error: 'AIの読みとりでエラー:' + ((j.error && j.error.message) || res.getResponseCode()) };
    text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  } else {
    const model = props.getProperty('GEMINI_MODEL') || 'gemini-3.8-flash';
    const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': geminiKey },
      payload: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mime, data: b.image } }, { text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    const j = JSON.parse(res.getContentText() || '{}');
    if (res.getResponseCode() !== 200) return { ok: false, error: 'AIの読みとりでエラー:' + ((j.error && j.error.message) || res.getResponseCode()) };
    text = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
  }
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return { ok: false, error: '範囲を読みとれませんでした' };
  let out; try { out = JSON.parse(m[0]); } catch (err) { return { ok: false, error: '範囲を読みとれませんでした' }; }
  return { ok: true, subjects: out.subjects || {} };
}

/* 外部接続の許可を出すために、エディタから一度だけ実行する */
function testReadRangeAuth() { UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true }); }
