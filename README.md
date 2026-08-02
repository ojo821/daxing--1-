# 差旅費用問答助理（大新科技）

用 Gemini API 回答員工差旅費用問題的內部小工具。**直接把兩份 PDF 原始檔傳給 Gemini**（不轉成純文字），由模型原生讀取 PDF 內容並引用條號/題號。每一題都是**獨立問答**，彼此不共用對話紀錄。

## 專案結構

```
travel-rag-chatbot/
├── index.html          前端頁面（極簡黑白風），含 PDF 下載連結
├── api/
│   └── chat.js         Vercel Serverless Function，組裝 system prompt 並呼叫 Gemini API
├── data/
│   └── documents.js     兩份 PDF 的 Base64 內容（供 Gemini 直接讀取 PDF）
├── docs/
│   ├── travel-policy-2026.pdf   員工差旅管理辦法（給員工下載用的靜態檔案）
│   └── travel-faq-2025.pdf      差旅常見問題FAQ（給員工下載用的靜態檔案）
└── package.json
```

## 部署到 Vercel（第一次設定）

1. **申請 Gemini API Key**
   前往 https://aistudio.google.com/apikey 建立一組 API Key。

2. **安裝 Vercel CLI（若尚未安裝）**
   ```bash
   npm install -g vercel
   ```

3. **登入並初始化專案**
   在這個資料夾內執行：
   ```bash
   vercel login
   vercel
   ```

4. **設定環境變數（保護 API Key 的關鍵步驟）**
   ```bash
   vercel env add GEMINI_API_KEY
   ```
   貼上你在步驟 1 拿到的 Key。這個 Key 只存在 Vercel 伺服器端，瀏覽器端看不到。

5. **正式部署**
   ```bash
   vercel --prod
   ```
   完成後會拿到一個網址（例如 `https://travel-rag-chatbot.vercel.app`），這就是給員工使用的網址。

## 員工可以做什麼

- 在頁面下方輸入框提問，或直接點選範例問題按鈕。
- 每一題都是「獨立問答」：不會延續前一題的脈絡，每次都是重新對兩份 PDF 提問。
- 頁面上方有兩份 PDF 的下載連結，員工可以直接下載原始文件核對。

## 之後更新文件內容（換版本時）

如果《員工差旅管理辦法》或 FAQ 出新版本：

1. 把新的 PDF 檔案放進 `docs/` 資料夾（取代舊檔案，檔名保持 `travel-policy-2026.pdf` / `travel-faq-2025.pdf`，或自行修改 `index.html` 裡的連結）。
2. 重新產生 `data/documents.js` 裡的 Base64 內容——用以下指令（在專案根目錄執行，Node.js 環境）：
   ```bash
   node -e "
   const fs = require('fs');
   const policy = fs.readFileSync('docs/travel-policy-2026.pdf').toString('base64');
   const faq = fs.readFileSync('docs/travel-faq-2025.pdf').toString('base64');
   const content = \`const POLICY_PDF = { displayName: '員工差旅管理辦法_2026年版.pdf', citationLabel: '員工差旅管理辦法（2026年版）', mimeType: 'application/pdf', base64: '\${policy}' };
   const FAQ_PDF = { displayName: '差旅常見問題FAQ_2025.pdf', citationLabel: '差旅常見問題FAQ（2025年版）', mimeType: 'application/pdf', base64: '\${faq}' };
   module.exports = { POLICY_PDF, FAQ_PDF };\`;
   fs.writeFileSync('data/documents.js', content);
   "
   ```
3. 重新執行 `vercel --prod` 部署即可。

## 目前設計的回答規則（寫在 api/chat.js 的 system prompt 裡）

- 只依據兩份 PDF 附件回答，文件沒提到的一律說「本資料庫無此項規定」
- 每個答案都標註來源（文件名稱＋條號/題號）
- 兩份文件不一致時，主動列出差異，並註明以《員工差旅管理辦法 2026年版》為準
- 遇到「文件沒規定但辦法本身要求向行政部門確認」的情況（例如家人隨行費用），除了說「查無規定」，也會一併提醒「請洽行政部門確認」
- 每一題視為獨立問答，不帶先前對話紀錄

## 已知的文件內容差異（機器人會主動提醒的部分）

| 項目 | 辦法（2026） | FAQ（2025） |
|---|---|---|
| 一般員工住宿費上限 | 2,500 元/晚 | 2,200 元/晚 |
| 主管住宿費上限 | 3,200 元/晚 | 3,000 元/晚 |
| 報帳期限 | 10 個工作日 | 14 天 |

以上差異機器人會直接從 PDF 內容讀出並比對，不需另外維護對照表。
