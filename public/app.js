const state = {
  accessToken: "",
  userId: "",
};

const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const sessionInfoEl = $("sessionInfo");
const roomsOutputEl = $("roomsOutput");
const messagesOutputEl = $("messagesOutput");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#ff8f8f" : "#a8bfdc";
}

function updateSessionInfo() {
  sessionInfoEl.textContent = state.accessToken
    ? `Пользователь: ${state.userId}`
    : "Нет сессии";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.accessToken) {
    headers.Authorization = `Bearer ${state.accessToken}`;
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.errcode || `HTTP ${response.status}`);
  }

  return data;
}

$("registerBtn").addEventListener("click", async () => {
  try {
    const username = $("username").value.trim();
    const password = $("password").value;
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    state.accessToken = data.access_token;
    state.userId = data.user_id;
    updateSessionInfo();
    setStatus("Регистрация успешна.");
  } catch (error) {
    setStatus(`Ошибка регистрации: ${error.message}`, true);
  }
});

$("loginBtn").addEventListener("click", async () => {
  try {
    const username = $("username").value.trim();
    const password = $("password").value;
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    state.accessToken = data.access_token;
    state.userId = data.user_id;
    updateSessionInfo();
    setStatus("Вход выполнен.");
  } catch (error) {
    setStatus(`Ошибка входа: ${error.message}`, true);
  }
});

$("loadRoomsBtn").addEventListener("click", async () => {
  try {
    const data = await api("/api/rooms");
    roomsOutputEl.textContent = JSON.stringify(data, null, 2);
    setStatus("Комнаты загружены.");
  } catch (error) {
    setStatus(`Ошибка загрузки комнат: ${error.message}`, true);
  }
});

$("joinBtn").addEventListener("click", async () => {
  try {
    const roomIdOrAlias = $("roomIdOrAlias").value.trim();
    const data = await api("/api/rooms/join", {
      method: "POST",
      body: JSON.stringify({ roomIdOrAlias }),
    });

    $("activeRoomId").value = data.room_id || roomIdOrAlias;
    setStatus(`Подключено к комнате: ${data.room_id || roomIdOrAlias}`);
  } catch (error) {
    setStatus(`Ошибка подключения: ${error.message}`, true);
  }
});

$("loadMessagesBtn").addEventListener("click", async () => {
  try {
    const roomId = $("activeRoomId").value.trim();
    if (!roomId) {
      throw new Error("Укажите roomId");
    }

    const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/messages`);
    const events = (data.chunk || [])
      .filter((event) => event.type === "m.room.message")
      .map((event) => `${event.sender}: ${event.content?.body || ""}`)
      .reverse();

    messagesOutputEl.textContent = events.length ? events.join("\n") : "Нет сообщений.";
    setStatus("Сообщения загружены.");
  } catch (error) {
    setStatus(`Ошибка загрузки сообщений: ${error.message}`, true);
  }
});

$("sendMessageBtn").addEventListener("click", async () => {
  try {
    const roomId = $("activeRoomId").value.trim();
    const message = $("messageText").value.trim();

    if (!roomId) {
      throw new Error("Укажите roomId");
    }

    await api(`/api/rooms/${encodeURIComponent(roomId)}/send`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });

    $("messageText").value = "";
    setStatus("Сообщение отправлено.");
  } catch (error) {
    setStatus(`Ошибка отправки: ${error.message}`, true);
  }
});

updateSessionInfo();
