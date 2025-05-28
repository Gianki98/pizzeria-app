// Client per collegare il frontend alle tue API
class PizzeriaAPI {
  constructor() {
    this.baseURL = window.location.origin; // Usa automaticamente l'URL corrente
    this.socket = null;
    this.initWebSocket();
  }

  // ============== CONNESSIONE WEBSOCKET ==============
  initWebSocket() {
    // Carica Socket.IO dal CDN se non è già caricato
    if (typeof io === "undefined") {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js";
      script.onload = () => this.connectWebSocket();
      document.head.appendChild(script);
    } else {
      this.connectWebSocket();
    }
  }

  connectWebSocket() {
    this.socket = io();

    // Debug: cattura TUTTI gli eventi
    const originalEmit = this.socket.emit;
    this.socket.emit = function (...args) {
      console.log("📤 INVIO:", args[0], args[1]);
      return originalEmit.apply(this, args);
    };

    const originalOn = this.socket.on;
    this.socket.on = function (eventName, callback) {
      const wrappedCallback = function (...args) {
        if (eventName !== "connect" && eventName !== "disconnect") {
          console.log("📥 RICEVO:", eventName, args[0]);
        }
        return callback.apply(this, args);
      };
      return originalOn.call(this, eventName, wrappedCallback);
    };

    this.socket.on("connect", () => {
      console.log("🔌 Connesso al server");
      console.log("🔌 Il mio Socket ID:", this.socket.id);
    });

    this.socket.on("disconnect", () => {
      console.log("🔌 Disconnesso dal server");
    });

    // Ascolta eventi di sincronizzazione
    this.socket.on("nuovo_ordine", (ordine) => {
      console.log("📨 Nuovo ordine ricevuto:", ordine);
      // Qui chiamerai la tua funzione per aggiornare l'interfaccia
      if (window.aggiornaListaOrdini) {
        window.aggiornaListaOrdini();
      }
    });

    this.socket.on("ordine_aggiornato", (ordine) => {
      console.log("📨 Ordine aggiornato:", ordine);
      if (window.aggiornaListaOrdini) {
        window.aggiornaListaOrdini();
      }
    });

    this.socket.on("ordine_eliminato", (data) => {
      console.log("📨 Ordine eliminato:", data);
      if (window.aggiornaListaOrdini) {
        window.aggiornaListaOrdini();
      }
    });
  }

  // ============== METODI API ORDINI ==============

  // Sostituisce localStorage.getItem('ordini')
  async getOrdini() {
    try {
      const response = await fetch(`${this.baseURL}/api/ordini`);
      if (!response.ok) throw new Error("Errore caricamento ordini");
      return await response.json();
    } catch (error) {
      console.error("❌ Errore getOrdini:", error);
      return [];
    }
  }

  // Sostituisce localStorage.setItem('ordini', ...)
  async salvaOrdine(ordineData) {
    try {
      const response = await fetch(`${this.baseURL}/api/ordini`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ordineData),
      });

      if (!response.ok) throw new Error("Errore salvataggio ordine");
      const result = await response.json();
      console.log("✅ Ordine salvato:", result);
      return result;
    } catch (error) {
      console.error("❌ Errore salvaOrdine:", error);
      throw error;
    }
  }

  // Aggiorna stato ordine
  async aggiornaOrdine(ordineId, dati) {
    try {
      const response = await fetch(`${this.baseURL}/api/ordini/${ordineId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dati),
      });

      if (!response.ok) throw new Error("Errore aggiornamento ordine");
      return await response.json();
    } catch (error) {
      console.error("❌ Errore aggiornaOrdine:", error);
      throw error;
    }
  }

  // Elimina ordine
  async eliminaOrdine(ordineId) {
    try {
      const response = await fetch(`${this.baseURL}/api/ordini/${ordineId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Errore eliminazione ordine");
      return await response.json();
    } catch (error) {
      console.error("❌ Errore eliminaOrdine:", error);
      throw error;
    }
  }

  // ============== METODI API TAVOLI ==============

  async getTavoli() {
    try {
      const response = await fetch(`${this.baseURL}/api/tavoli`);
      if (!response.ok) throw new Error("Errore caricamento tavoli");
      return await response.json();
    } catch (error) {
      console.error("❌ Errore getTavoli:", error);
      return [];
    }
  }
}

// ============== UTILIZZO SEMPLICE ==============

// Istanza globale da usare nel tuo codice
const api = new PizzeriaAPI();

// Esempi di utilizzo (sostituiscono localStorage):

// PRIMA (localStorage):
// const ordini = JSON.parse(localStorage.getItem('ordini') || '[]');

// DOPO (API):
// const ordini = await api.getOrdini();

// PRIMA (localStorage):
// localStorage.setItem('ordini', JSON.stringify(nuovoOrdine));

// DOPO (API):
// await api.salvaOrdine(nuovoOrdine);

console.log("🍕 PizzeriaAPI caricata e pronta!");
