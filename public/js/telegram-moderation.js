(() => {
  const token = localStorage.getItem("token");
  if (!token) { location.href = "/login"; return; }
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const $ = id => document.getElementById(id);
  let page = 1;
  let providers = [];
  let providerOrder = [];
  let disabledProviders = [];
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
  function renderProviders() {
    const active = providerOrder.filter(id => providers.some(p => p.id === id));
    providerOrder = [...active, ...providers.map(p => p.id).filter(id => !active.includes(id))];
    const primary = $("tgPrimaryProvider");
    primary.innerHTML = providerOrder.map(id => providers.find(p => p.id === id)).filter(Boolean).map(p => `<option value="${esc(p.id)}">${esc(p.label)}${p.configured ? "" : " · Not configured"}</option>`).join("");
    primary.value = providerOrder.find(id => !disabledProviders.includes(id) && providers.find(p => p.id === id)?.configured) || providerOrder[0] || "";
    $("tgProviderList").innerHTML = providerOrder.map((id, index) => {
      const p = providers.find(item => item.id === id); if (!p) return "";
      const off = disabledProviders.includes(id);
      const state = off ? "Disabled" : p.configured ? "Ready" : "API key / model missing";
      return `<div class="tg-provider-row ${index === 0 ? "primary" : ""} ${off ? "disabled" : ""}" data-provider="${esc(id)}">
        <span class="tg-provider-rank">${index + 1}</span>
        <div><div class="tg-provider-name">${esc(p.label)}</div><div class="tg-provider-model">${esc(p.model || "Model not configured")}</div></div>
        <span class="tg-provider-state ${off ? "off" : p.configured ? "ready" : "missing"}">${state}</span>
        <div class="tg-provider-moves"><button type="button" data-move="up" data-id="${esc(id)}" aria-label="Move up" ${index === 0 ? "disabled" : ""}><i class="fa-solid fa-chevron-up"></i></button><button type="button" data-move="down" data-id="${esc(id)}" aria-label="Move down" ${index === providerOrder.length - 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-down"></i></button></div>
        <label class="tg-provider-toggle"><input type="checkbox" data-toggle="${esc(id)}" ${off ? "" : "checked"}> Enabled</label>
      </div>`;
    }).join("") || '<div class="tg-provider-loading">No supported providers found.</div>';
  }
  async function loadProviders() {
    try {
      const data = await api("/providers");
      providers = data.providers || [];
      providerOrder = Array.isArray(data.order) && data.order.length ? [...data.order] : providers.map(p => p.id);
      disabledProviders = providers.filter(p => !p.enabled).map(p => p.id);
      renderProviders();
    } catch (error) { $("tgProviderList").textContent = error.message; }
  }
  $("tgProviderList").addEventListener("click", event => {
    const button = event.target.closest("button[data-move]"); if (!button) return;
    const index = providerOrder.indexOf(button.dataset.id); const next = button.dataset.move === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= providerOrder.length) return;
    [providerOrder[index], providerOrder[next]] = [providerOrder[next], providerOrder[index]];
    renderProviders();
  });
  $("tgProviderList").addEventListener("change", event => {
    const id = event.target.dataset.toggle; if (!id) return;
    if (event.target.checked) disabledProviders = disabledProviders.filter(x => x !== id);
    else if (!disabledProviders.includes(id)) disabledProviders.push(id);
    renderProviders();
  });
  $("tgPrimaryProvider").addEventListener("change", event => {
    const id = event.target.value; providerOrder = [id, ...providerOrder.filter(x => x !== id)]; renderProviders();
  });
  $("tgSaveProviders").addEventListener("click", async () => {
    const button = $("tgSaveProviders"), message = $("tgProviderMessage");
    button.disabled = true; button.textContent = "Saving…"; message.textContent = "Validating provider configuration…";
    try {
      const data = await api("/providers", { method: "PUT", body: JSON.stringify({ order: providerOrder, disabled: disabledProviders }) });
      providers = data.ai.providerCatalog || providers;
      providerOrder = data.ai.configuredProviders?.length ? [...data.ai.configuredProviders, ...providerOrder.filter(id => !data.ai.configuredProviders.includes(id))] : providerOrder;
      message.textContent = data.message || "Settings saved.";
      renderProviders(); setStatus({ ...data.ai, running: document.querySelector("#tgStatus")?.classList.contains("online"), configured: true });
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; button.textContent = "Save provider order"; }
  });
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
  refreshStatus(); loadLogs(); loadProviders();
  setInterval(refreshStatus, 15000);
})();
