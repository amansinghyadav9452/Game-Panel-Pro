(() => {
  const token = localStorage.getItem("token");
  if (!token) { location.href = "/login"; return; }
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const $ = id => document.getElementById(id);
  let page = 1;
  async function api(path, options = {}) {
    const res = await fetch(`/api/telegram-moderation${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || "Request failed");
    return data;
  }
  function setStatus(data) {
    const node = $("tgStatus");
    node.className = `tg-status ${data.running ? "online" : "offline"}`;
    node.innerHTML = `<span class="tg-dot"></span><span>${data.running ? "Bot running" : "Bot stopped"}</span>`;
    $("tgIdentity").textContent = data.username ? `Connected as @${data.username}` : (data.configured ? "Token configured, bot is stopped" : "Bot token is not configured");
    $("tgConfigNote").textContent = data.configured ? (data.lastError ? `Last error: ${data.lastError}` : "Bot token detected. Start the bot to begin moderation.") : "Add TG_BOT_TOKEN to your hosting environment, then redeploy.";
    $("tgStart").disabled = data.running || !data.configured;
    $("tgStop").disabled = !data.running;
    if (data.ai) {
      const chain = Array.isArray(data.ai.chain) ? data.ai.chain : [];
      $("tgAiProvider").textContent = data.ai.enabled ? (chain.length > 1 ? `${chain[0].id} primary · ${chain.length - 1} fallback model${chain.length > 2 ? "s" : ""}` : `${data.ai.provider || "AI"} primary · no fallback`) : "API key missing";
      $("tgAiModel").textContent = chain.length ? chain.map(c => `${c.id}${c.coolingDownSeconds ? " (cooldown)" : ""}`).join(" → ") : (data.ai.model || "—");
      $("tgAiNote").textContent = data.ai.enabled
        ? `${chain.length} AI model${chain.length > 1 ? "s" : ""} in the automatic fallback chain. If one hits its limit or fails, the next one answers. Replies are subject to cooldowns.`
        : "Add at least one AI API key (GEMINI_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY, SAMBANOVA_API_KEY, NVIDIA_API_KEY or GITHUB_MODELS_TOKEN) to hosting environment and redeploy. Telegram moderation remains active without AI.";
    }
  }
  async function refreshStatus() {
    try { setStatus(await api("/status")); }
    catch (e) { $("tgStatus").textContent = e.message; }
  }
  async function loadLogs() {
    const body = $("tgLogs");
    try {
      const data = await api(`/logs?page=${page}`);
      body.innerHTML = data.items.length ? data.items.map(item => `<tr>
        <td>${esc(item.chatTitle || item.chatId)}</td>
        <td>${esc(item.displayName || (item.username ? "@"+item.username : item.userId))}</td>
        <td><span class="tg-reason">${esc(item.reason)}</span></td>
        <td class="tg-excerpt">${esc(item.excerpt || "—")}</td>
        <td>${new Date(item.deletedAt).toLocaleString()}</td>
      </tr>`).join("") : '<tr><td colspan="5">No moderation activity recorded yet.</td></tr>';
      $("tgPagination").textContent = `Page ${data.page} of ${Math.max(1, data.pages)}`;
    } catch (e) { body.innerHTML = `<tr><td colspan="5">${esc(e.message)}</td></tr>`; }
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }
  $("tgStart").addEventListener("click", async () => {
    $("tgStart").disabled = true;
    try { setStatus(await api("/start", { method: "POST" })); await loadLogs(); }
    catch (e) { alert(e.message); await refreshStatus(); }
  });
  $("tgStop").addEventListener("click", async () => {
    $("tgStop").disabled = true;
    try { setStatus(await api("/stop", { method: "POST" })); }
    catch (e) { alert(e.message); }
  });
  $("tgRefresh").addEventListener("click", () => loadLogs());
  refreshStatus(); loadLogs();
  setInterval(refreshStatus, 15000);
})();
