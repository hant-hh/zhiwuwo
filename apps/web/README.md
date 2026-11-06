# apps/web

置物窝 Web 前端（React + Vite + TypeScript），对话式界面参考 DeepSeek 风格。

- 登录/注册后进入对话页
- **默认「智能」模式**：统一调用 `POST /api/v1/chat`，后端自动判断录入/查询，无需切换标签
  - 「把护照放在书房抽屉」→ 解析入库
  - 「我的电脑在哪里」「书房里有什么」→ 自然语言理解后检索，用人话回答 + 位置卡片
- 顶部「录入 / 查询」按钮仅作强制覆盖（偶尔判错时用）
- 低置信度解析结果可一键「确认」
- 详见 `docs/chat-assistant.md`

## 本地开发

```bash
cd apps/web
npm install
npm run dev        # 默认 http://localhost:3000
```

开发服务器通过 Vite 代理把 `/api` 转发到后端（`http://localhost:8000`，可用 `VITE_API_BASE_URL` 覆盖）。

## 连接后端

后端即 `apps/api`（FastAPI，见 `docs/PLAN.md` §5/§6）。确保后端已启动：

```bash
cd /export/ant/zhiwuwo
./deploy/start.sh
curl http://localhost:8000/health   # {"status":"ok"}
```

跨域：开发期由 Vite 代理解决；生产由 Nginx 反向代理统一处理（见 M0 文档 §5）。生产对外只开放 `http://<域名>:18080` 与 `https://<域名>:18443`（不使用 80 / 443 / 8080，HTTPS 端口必须显式写出）。
