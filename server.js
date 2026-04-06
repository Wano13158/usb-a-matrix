import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MATRIX_BASE_URL = process.env.MATRIX_BASE_URL || "http://127.0.0.1:8008";
const MATRIX_SHARED_SECRET = process.env.MATRIX_SHARED_SECRET || "";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

function makeMatrixUrl(endpoint) {
  return `${MATRIX_BASE_URL}${endpoint}`;
}

function matrixAuthHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function getBearerToken(req) {
  return req.headers.authorization?.replace("Bearer ", "").trim();
}

function sanitizeLimit(rawLimit, defaultLimit = 30) {
  const parsed = Number(rawLimit ?? defaultLimit);
  if (!Number.isFinite(parsed)) return defaultLimit;
  return Math.max(1, Math.min(100, Math.trunc(parsed)));
}

function isRegistrationDisabled(responseStatus, data) {
  const matrixError = `${data?.error || ""}`;
  return (
    responseStatus === 403 &&
    data?.errcode === "M_FORBIDDEN" &&
    matrixError.includes("Registration has been disabled")
  );
}

function homeserverConnectionError(error) {
  return {
    error: `Не удалось подключиться к homeserver ${MATRIX_BASE_URL}. Проверьте доступность сервера и правильность MATRIX_BASE_URL.`,
    details: error.message,
  };
}

async function registerWithSharedSecret(username, password) {
  if (!MATRIX_SHARED_SECRET) {
    throw new Error("MATRIX_SHARED_SECRET is not configured");
  }

  const nonceResponse = await fetch(makeMatrixUrl("/_synapse/admin/v1/register"));
  const nonceData = await nonceResponse.json();

  if (!nonceResponse.ok || !nonceData?.nonce) {
    const reason = nonceData?.error || `HTTP ${nonceResponse.status}`;
    throw new Error(`Не удалось получить nonce от Synapse Admin API (fallback): ${reason}`);
  }

  const nonce = nonceData.nonce;
  const mac = createHmac("sha1", MATRIX_SHARED_SECRET)
    .update(`${nonce}\x00${username}\x00${password}\x00notadmin`)
    .digest("hex");

  const createResponse = await fetch(makeMatrixUrl("/_synapse/admin/v1/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nonce,
      username,
      password,
      admin: false,
      mac,
    }),
  });

  const createData = await createResponse.json();
  if (!createResponse.ok) {
    const reason = createData?.error || `HTTP ${createResponse.status}`;
    throw new Error(`Не удалось создать пользователя через Synapse shared secret fallback: ${reason}`);
  }

  return createData;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, homeserver: MATRIX_BASE_URL });
});

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username и password обязательны" });
  }

  try {
    const response = await fetch(makeMatrixUrl("/_matrix/client/v3/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth: { type: "m.login.dummy" },
        username,
        password,
        inhibit_login: false,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      if (isRegistrationDisabled(response.status, data)) {
        if (MATRIX_SHARED_SECRET) {
          try {
            const adminRegistration = await registerWithSharedSecret(username, password);
            return res.json(adminRegistration);
          } catch (adminError) {
            return res.status(502).json({
              errcode: data.errcode,
              error:
                "Обычная регистрация отключена, и резервная регистрация через Synapse Admin API fallback не удалась.",
              details: adminError.message,
            });
          }
        }

        return res.status(403).json({
          errcode: data.errcode,
          error:
            "Регистрация отключена на Matrix homeserver. Для Tuwunel включите allow_registration/registration_token; для Synapse можно задать MATRIX_SHARED_SECRET.",
          details: data.error,
        });
      }

      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    return res.status(502).json(homeserverConnectionError(error));
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username и password обязательны" });
  }

  try {
    const response = await fetch(makeMatrixUrl("/_matrix/client/v3/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "m.login.password",
        identifier: { type: "m.id.user", user: username },
        password,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    return res.status(502).json(homeserverConnectionError(error));
  }
});

app.get("/api/rooms", async (req, res) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: "Нужен access token" });
  }

  try {
    const response = await fetch(makeMatrixUrl("/_matrix/client/v3/joined_rooms"), {
      headers: matrixAuthHeaders(token),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    return res.status(502).json(homeserverConnectionError(error));
  }
});

app.post("/api/rooms/join", async (req, res) => {
  const token = getBearerToken(req);
  const { roomIdOrAlias } = req.body;

  if (!token) {
    return res.status(401).json({ error: "Нужен access token" });
  }

  if (!roomIdOrAlias) {
    return res.status(400).json({ error: "roomIdOrAlias обязателен" });
  }

  try {
    const encoded = encodeURIComponent(roomIdOrAlias);
    const response = await fetch(makeMatrixUrl(`/_matrix/client/v3/join/${encoded}`), {
      method: "POST",
      headers: matrixAuthHeaders(token),
      body: JSON.stringify({}),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    return res.status(502).json(homeserverConnectionError(error));
  }
});

app.get("/api/rooms/:roomId/messages", async (req, res) => {
  const token = getBearerToken(req);
  const { roomId } = req.params;

  if (!token) {
    return res.status(401).json({ error: "Нужен access token" });
  }

  try {
    const encodedRoom = encodeURIComponent(roomId);
    const limit = sanitizeLimit(req.query.limit, 30);
    const response = await fetch(
      makeMatrixUrl(`/_matrix/client/v3/rooms/${encodedRoom}/messages?dir=b&limit=${limit}`),
      { headers: matrixAuthHeaders(token) }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    return res.status(502).json(homeserverConnectionError(error));
  }
});

app.post("/api/rooms/:roomId/send", async (req, res) => {
  const token = getBearerToken(req);
  const { roomId } = req.params;
  const { message } = req.body;

  if (!token) {
    return res.status(401).json({ error: "Нужен access token" });
  }

  if (!message) {
    return res.status(400).json({ error: "message обязателен" });
  }

  try {
    const encodedRoom = encodeURIComponent(roomId);
    const txnId = Date.now().toString();

    const response = await fetch(
      makeMatrixUrl(`/_matrix/client/v3/rooms/${encodedRoom}/send/m.room.message/${txnId}`),
      {
        method: "PUT",
        headers: matrixAuthHeaders(token),
        body: JSON.stringify({
          msgtype: "m.text",
          body: message,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    return res.status(502).json(homeserverConnectionError(error));
  }
});

app.listen(PORT, () => {
  console.log(`USB-A Tuwunel server started at http://localhost:${PORT}`);
});
