const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(".")); // Mantiene la tua configurazione originale

// Inizializzazione Database SQLite
const db = new sqlite3.Database("./pizzeria.db", (err) => {
  if (err) {
    console.error("❌ Errore connessione database:", err.message);
  } else {
    console.log("✅ Database SQLite connesso");
    initializeDatabase();
  }
});

// Creazione tabelle database
function initializeDatabase() {
  // Tabella ordini
  db.run(`
    CREATE TABLE IF NOT EXISTS ordini (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_ordine TEXT UNIQUE NOT NULL,
      tavolo TEXT NOT NULL,
      stato TEXT DEFAULT 'aperto',
      totale REAL DEFAULT 0,
      note TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabella articoli degli ordini
  db.run(`
    CREATE TABLE IF NOT EXISTS ordini_articoli (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ordine_id INTEGER,
      nome_articolo TEXT NOT NULL,
      prezzo REAL NOT NULL,
      quantita INTEGER DEFAULT 1,
      note TEXT,
      FOREIGN KEY (ordine_id) REFERENCES ordini (id) ON DELETE CASCADE
    )
  `);

  // Tabella tavoli
  db.run(`
    CREATE TABLE IF NOT EXISTS tavoli (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      stato TEXT DEFAULT 'libero',
      ospiti INTEGER DEFAULT 0,
      ordine_attivo TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("✅ Tabelle database inizializzate");
  insertSampleData();
}

// Inserimento dati di esempio
function insertSampleData() {
  db.get("SELECT COUNT(*) as count FROM tavoli", (err, row) => {
    if (row.count === 0) {
      console.log("📝 Inserimento tavoli di esempio...");
      for (let i = 1; i <= 20; i++) {
        db.run("INSERT INTO tavoli (numero, stato) VALUES (?, ?)", [
          i.toString(),
          "libero",
        ]);
      }
    }
  });
}

// ============== API REST ENDPOINTS ==============

// GET - Recupera tutti gli ordini
app.get("/api/ordini", (req, res) => {
  const query = `
    SELECT o.*, 
           GROUP_CONCAT(oa.nome_articolo || ' x' || oa.quantita) as articoli
    FROM ordini o
    LEFT JOIN ordini_articoli oa ON o.id = oa.ordine_id
    GROUP BY o.id
    ORDER BY o.timestamp DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ Errore recupero ordini:", err);
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// GET - Recupera ordine specifico
app.get("/api/ordini/:id", (req, res) => {
  const ordineId = req.params.id;

  db.get("SELECT * FROM ordini WHERE id = ?", [ordineId], (err, ordine) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!ordine) {
      res.status(404).json({ error: "Ordine non trovato" });
      return;
    }

    db.all(
      "SELECT * FROM ordini_articoli WHERE ordine_id = ?",
      [ordineId],
      (err, articoli) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          ordine.articoli = articoli;
          res.json(ordine);
        }
      }
    );
  });
});

// POST - Crea nuovo ordine
app.post("/api/ordini", (req, res) => {
  const { numero_ordine, tavolo, articoli, note } = req.body;
  const totale = articoli.reduce(
    (sum, art) => sum + art.prezzo * art.quantita,
    0
  );

  db.run(
    "INSERT INTO ordini (numero_ordine, tavolo, totale, note) VALUES (?, ?, ?, ?)",
    [numero_ordine, tavolo, totale, note],
    function (err) {
      if (err) {
        console.error("❌ Errore creazione ordine:", err);
        res.status(500).json({ error: err.message });
        return;
      }

      const ordineId = this.lastID;

      // Inserisci articoli
      const articoliPromises = articoli.map((art) => {
        return new Promise((resolve, reject) => {
          db.run(
            "INSERT INTO ordini_articoli (ordine_id, nome_articolo, prezzo, quantita, note) VALUES (?, ?, ?, ?, ?)",
            [ordineId, art.nome, art.prezzo, art.quantita, art.note || ""],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      Promise.all(articoliPromises)
        .then(() => {
          const nuovoOrdine = {
            id: ordineId,
            numero_ordine,
            tavolo,
            totale,
            articoli,
            timestamp: new Date().toISOString(),
          };

          // Notifica tutti i client connessi
          io.emit("nuovo_ordine", nuovoOrdine);

          res.json({ success: true, ordine: nuovoOrdine });
          console.log("✅ Nuovo ordine creato:", numero_ordine);
        })
        .catch((err) => {
          console.error("❌ Errore inserimento articoli:", err);
          res.status(500).json({ error: "Errore inserimento articoli" });
        });
    }
  );
});

// PUT - Aggiorna ordine
app.put("/api/ordini/:id", (req, res) => {
  const ordineId = req.params.id;
  const { stato, note } = req.body;

  db.run(
    "UPDATE ordini SET stato = ?, note = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?",
    [stato, note, ordineId],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        io.emit("ordine_aggiornato", { id: ordineId, stato, note });
        res.json({ success: true, changes: this.changes });
        console.log("✅ Ordine aggiornato:", ordineId);
      }
    }
  );
});

// DELETE - Elimina ordine
app.delete("/api/ordini/:id", (req, res) => {
  const ordineId = req.params.id;

  db.run("DELETE FROM ordini WHERE id = ?", [ordineId], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      io.emit("ordine_eliminato", { id: ordineId });
      res.json({ success: true, changes: this.changes });
      console.log("✅ Ordine eliminato:", ordineId);
    }
  });
});

// GET - Recupera tutti i tavoli
app.get("/api/tavoli", (req, res) => {
  db.all(
    "SELECT * FROM tavoli ORDER BY CAST(numero AS INTEGER)",
    [],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

// ============== WEBSOCKET EVENTS ==============

io.on("connection", (socket) => {
  console.log("🔌 Client connesso:", socket.id);

  // NUOVO: Gestisci eventi di sincronizzazione
  socket.on("nuovo_ordine", (ordineData) => {
    console.log(
      "📢 Nuovo ordine ricevuto, broadcasting a tutti tranne mittente..."
    );
    // Invia a TUTTI i client connessi (tranne chi ha inviato)
    socket.broadcast.emit("ordine_aggiunto", ordineData);
  });

  socket.on("ordine_modificato", (ordineData) => {
    console.log(
      "📢 Ordine modificato, broadcasting a tutti tranne mittente..."
    );
    socket.broadcast.emit("ordine_aggiornato", ordineData);
  });

  socket.on("ordine_eliminato", (ordineId) => {
    console.log("📢 Ordine eliminato, broadcasting a tutti tranne mittente...");
    socket.broadcast.emit("ordine_rimosso", ordineId);
  });

  socket.on("tavolo_aggiornato", (tavoloData) => {
    console.log(
      "📢 Tavolo aggiornato, broadcasting a tutti tranne mittente..."
    );
    socket.broadcast.emit("tavolo_sincronizzato", tavoloData);
  });

  socket.on("nuovo_tavolo_asporto", (data) => {
    console.log(
      "📢 Nuovo tavolo/asporto, broadcasting a tutti tranne mittente..."
    );
    socket.broadcast.emit("nuovo_tavolo_asporto", data);
  });

  socket.on("sync_all_orders", (data) => {
    console.log("📢 Sincronizzazione completa richiesta");
    socket.broadcast.emit("sync_all_orders_broadcast", data);
  });

  socket.on("ordine_chiuso", (data) => {
    console.log("📢 Ordine chiuso, broadcasting a tutti tranne mittente...");
    socket.broadcast.emit("ordine_chiuso", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnesso:", socket.id);
  });
});

// ============== AVVIO SERVER ==============

// Usa server.listen invece di app.listen per supportare WebSocket
server.listen(port, "0.0.0.0", () => {
  console.log("🚀 Server Pizzeria avviato!");
  console.log(`📍 URL locale: http://localhost:${port}`);
  console.log(`🌐 URL rete: http://[IP-PC]:${port}`);
  console.log("💾 Database: pizzeria.db");
  console.log("🔌 WebSocket attivo per sincronizzazione");
});

// Gestione chiusura graceful
let isClosing = false;
process.on("SIGINT", () => {
  if (isClosing) return;
  isClosing = true;

  console.log("\n🛑 Chiusura server...");

  server.close(() => {
    console.log("✅ Server chiuso");

    db.close((err) => {
      if (err && err.message !== "SQLITE_MISUSE: Database is closed") {
        console.error("❌ Errore chiusura database:", err.message);
      } else {
        console.log("✅ Database chiuso");
      }
      process.exit(0);
    });
  });
});
