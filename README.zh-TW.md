# omp-external-publish

[oh-my-pi](https://github.com/can1357/oh-my-pi)（omp）套件，實作 **Day28 整合時序** 的守門 hook 與結構化 `publish` 工具：外部程式驅動 omp 時，對外只留這一個出口。

設計依據：[`day28-integrated-sequence.md`](../external-countermeasures-day17-30/day28-integrated-sequence.md)（圖：`-fig1.svg`、`-fig1.png`）。

[English README](README.md)

## 套件做什麼、不做什麼

| 套件內（`-e`） | 不在套件內（時序圖的包裝端／基礎建設） |
|---|---|
| **守門 hook**：`publish` 的 `tool_call` 正規化參數、依呼叫者查允許的 marker、掃密鑰、必要時改寫參數；擋下／核准／結果寫稽核 | 身分閘道（oauth2-proxy、Tailscale Serve） |
| **`publish` 工具**：對 loopback URL POST `{ marker, url, content? }` | 包裝端的任務授權表 |
| **稽核帳本**（只追加、只記雜湊與欄位名） | 核准卡 UI |
| 設定偏離 Day28 overlay 時 **警告** | 以端點紀錄核對三個雜湊 |

bash／eval 的 deny、`publish: prompt`、`always-ask` 仍靠 omp 內建核准；本套件補「這個呼叫者能發到哪個 target」與證據列。

## 載入

只授權草擬（沒有對外工具）：

```bash
omp acp --tools read --no-extensions \
  --config /path/to/examples/overlay.yml \
  -e /path/to/external-publish/src/guard.ts
```

草擬＋發布（每次 `publish` 要人核准）：

```bash
omp acp --tools read --no-extensions \
  --config /path/to/examples/overlay.yml \
  -e /path/to/external-publish/src/guard.ts \
  -e /path/to/external-publish/src/publish-tool.ts \
  --publish-policy /path/to/policy.json
```

稽核用環境變數（由包裝端帶入，**不能**當成已驗證的身分）：

```bash
export OMP_PUBLISH_CALLER=program-caller-a
export OMP_PUBLISH_TASK=task-2026-001   # 選填
export OMP_PUBLISH_LEDGER=$HOME/.omp/external-publish-audit.jsonl   # 選填
```

政策格式見 [`examples/policy.example.json`](examples/policy.example.json)。marker 須符合 `d28-<id>`，URL 只能是 loopback 的 http(s)。

## 測試

```bash
cd research_folder_omp_vs_Cursor/external-publish && bun test
```

## 限制

- 呼叫者來自 env，stdio 對端可自稱 — 與 Day28 文章相同（可追溯，非身分證明）。
- 密鑰掃描為規則比對，不是 DLP。
- 帳本未做防竄改錨點（見 Day29 整合流程）。
- 身分閘道、包裝端、ACP／RPC 端到端實測不在本套件範圍。
