(function () {
  const { Session, api, showToast } = window.PymeBoost;
  if (!localStorage.getItem("pymeboost_role")) {
    location.href = "Ingresar.html";
    return;
  }
  const role = Session.getRole();
  const userId = Session.getUserId();
  const isPyme = role === "pyme";

  let conversations = [];
  let activeConvId = null;
  let activeConv = null;

  const convList = document.getElementById("conv-list");
  const convSearch = document.getElementById("conv-search");
  const chatEmpty = document.getElementById("chat-empty");
  const chatActive = document.getElementById("chat-active");
  const messagesArea = document.getElementById("messages-area");
  const chatInput = document.getElementById("msg-input");
  const sendBtn = document.getElementById("send-btn");
  function esc(text) {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  }

  function formatMsgTime(iso) {
    if (!iso) return "";
    const d = new Date(iso.replace(" ", "T") + "Z");
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }

  function renderConvList(filter = "") {
    const q = filter.toLowerCase().trim();
    const filtered = conversations.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.projectName || "").toLowerCase().includes(q) ||
        (c.lastMessage || "").toLowerCase().includes(q)
    );

    if (!filtered.length) {
      convList.innerHTML = `<div style="padding:24px 16px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px;">${q ? "Sin resultados" : "No hay conversaciones"}</div>`;
      return;
    }

    convList.innerHTML = filtered
      .map(
        (c) => `
      <div class="conv-item ${activeConvId === c.id ? "active" : ""}" data-id="${c.id}">
        <div class="conv-avatar">${esc(c.initials)}</div>
        <div class="conv-meta">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;">
            <span class="conv-name">${esc(c.name)}</span>
            <span style="font-size:10px;color:rgba(255,255,255,0.3);flex-shrink:0;">${esc(c.lastAt || "")}</span>
          </div>
          <div class="conv-project">${esc(c.projectName || "")}</div>
          <div class="conv-preview">${esc(c.lastMessage || "Sin mensajes")}</div>
        </div>
        ${c.unread ? `<span class="conv-badge">${c.unread}</span>` : ""}
      </div>`
      )
      .join("");

    convList.querySelectorAll(".conv-item").forEach((el) => {
      el.onclick = () => openChat(Number(el.dataset.id));
    });
  }

  function renderMessages(messages) {
    if (!messages.length) {
      messagesArea.innerHTML = `<div class="date-sep"><span>Inicio de la conversación</span></div><p style="text-align:center;color:rgba(255,255,255,0.35);font-size:13px;margin-top:24px;">Envía el primer mensaje</p>`;
      return;
    }

    let html = `<div class="date-sep"><span>Hoy</span></div>`;
    for (const m of messages) {
      const mine = m.senderRole === role;
      html += `
        <div class="msg-row ${mine ? "mine" : "theirs"}">
          <div>
            <div class="msg-bubble ${mine ? "mine" : "theirs"}">${esc(m.body)}</div>
            <div class="msg-time ${mine ? "mine" : ""}">${formatMsgTime(m.createdAt)}</div>
          </div>
        </div>`;
    }
    messagesArea.innerHTML = html;
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  async function openChat(id) {
    activeConvId = id;
    activeConv = conversations.find((c) => c.id === id);
    if (!activeConv) return;

    chatEmpty.style.display = "none";
    chatActive.style.display = "flex";
    sendBtn.disabled = false;

    document.getElementById("chat-name").textContent = activeConv.name;
    document.getElementById("chat-sub").textContent = activeConv.projectName || "";
    document.getElementById("chat-avatar").textContent = activeConv.initials;
    const link = document.getElementById("chat-contract-link");
    if (activeConv.contractId) {
      link.style.display = "inline-flex";
      link.href = "Contratos.html";
    } else {
      link.style.display = "none";
    }

    renderConvList(convSearch.value);

    const { messages } = await api(`/conversations/${id}/messages`);
    renderMessages(messages);
    chatInput.focus();
  }

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !activeConvId) return;
    sendBtn.disabled = true;
    try {
      await api(`/conversations/${activeConvId}/messages`, {
        method: "POST",
        body: { senderRole: role, senderId: userId, body: text },
      });
      chatInput.value = "";
      chatInput.style.height = "auto";
      await loadConversations();
      await openChat(activeConvId);
    } catch (e) {
      showToast(e.message || "Error al enviar");
    } finally {
      sendBtn.disabled = !activeConvId;
    }
  }

  async function loadConversations() {
    const data = await api(`/conversations?role=${role}&userId=${userId}`);
    conversations = data.conversations || [];

    const badge = document.getElementById("total-unread");
    if (data.totalUnread > 0) {
      badge.style.display = "inline";
      badge.textContent = `${data.totalUnread} nuevos`;
    } else {
      badge.style.display = "none";
    }

    renderConvList(convSearch.value);

    if (conversations.length && !activeConvId) {
      openChat(conversations[0].id);
    }
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  convSearch.addEventListener("input", () => renderConvList(convSearch.value));
  sendBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("input", () => autoResize(chatInput));
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  loadConversations().catch((e) => {
    console.error(e);
    showToast("Error al cargar mensajes. ¿Backend activo?");
  });
})();
