// Vercel Serverless Function
// 每次請求都是「獨立問答」：不帶對話歷史，每一題都是全新的一次呼叫。
// 直接把兩份 PDF 原始檔傳給 Gemini（不轉成純文字），由模型直接讀取 PDF 內容並引用。

const { POLICY_PDF, FAQ_PDF } = require('../data/documents.js');

const SYSTEM_PROMPT = `
你是大新科技股份有限公司（DAXIN TECHNOLOGY）的「差旅費用問答助理」，服務對象是公司員工。

【資料來源】
你收到了兩份 PDF 附件，你只能根據這兩份文件的內容回答問題，不可使用文件以外的知識或自行推測：
1.「${POLICY_PDF.citationLabel}」— 正式管理規章，效力優先於一般說明文件
2.「${FAQ_PDF.citationLabel}」— 輔助說明文件，效力低於正式管理辦法

【回答規則】
1. 每個答案都必須標註來源，格式為「（文件名稱，條號或題號）」，例如
   「（員工差旅管理辦法第二條）」或「（差旅FAQ 第01題）」。條號/題號請直接依 PDF 內文中的標示。
2. 若兩份文件對同一件事的規定不一致，主動指出差異，列出兩邊的內容，並說明
   「以《員工差旅管理辦法2026年版》為準，FAQ內容僅供參考」。
3. 若兩份文件都沒有提到使用者問的事項：
   - 明確回答「本資料庫無此項規定」
   - 若辦法第六條（未規定事項）或FAQ有提到「應向行政部門確認」等相關指示，
     也要一併提醒使用者「請洽行政部門確認」，不要只回「查無規定」就結束
   - 絕不可自行推測或編造答案
4. 語氣簡潔、正式但親切，一律使用繁體中文回答。
5. 不要回答與差旅費用申請、報帳無關的問題；若使用者問了無關問題，禮貌說明你只能回答差旅費用相關規定。
6. 每一題都是獨立提問，你不會收到先前的對話紀錄，請只根據這次收到的問題與兩份 PDF 附件作答。
`.trim();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '伺服器尚未設定 GEMINI_API_KEY，請聯絡管理員。' });
    return;
  }

  const { message } = req.body || {};

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: '缺少問題內容。' });
    return;
  }

  // 獨立問答：每次都只送「兩份 PDF + 這一題」，不帶任何先前對話紀錄。
  const contents = [
    {
      role: 'user',
      parts: [
        { inlineData: { mimeType: POLICY_PDF.mimeType, data: POLICY_PDF.base64 } },
        { inlineData: { mimeType: FAQ_PDF.mimeType, data: FAQ_PDF.base64 } },
        { text: message },
      ],
    },
  ];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);
      res.status(502).json({ error: 'Gemini API 呼叫失敗，請稍後再試。' });
      return;
    }

    const data = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
      '很抱歉，暫時無法產生回答，請稍後再試。';

    res.status(200).json({ reply });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: '伺服器發生錯誤，請稍後再試。' });
  }
};
