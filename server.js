import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MATRIX_BASE_URL = process.env.MATRIX_BASE_URL || "https://matrix.org";

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
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
    return res.status(500).json({ error: error.message });
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
    return res.status(500).json({ error: error.message });
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
    return res.status(500).json({ error: error.message });
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
    return res.status(500).json({ error: error.message });
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
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`USB-A Matrix server started at http://localhost:${PORT}`);
});
