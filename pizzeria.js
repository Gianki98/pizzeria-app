// Definizione dello stato dell'applicazione
setupWebSocketListeners;
const appState = {
  menu: {
    categories: [
      { id: "antipasti", name: "Antipasti" },
      { id: "mezze-familiari", name: "1/2 Familiari" },
      { id: "pizze-speciali", name: "Pizze Speciali" },
      { id: "pizze-classiche", name: "Pizze Classiche" },
      { id: "pizze-create", name: "Pizze Create" },
      { id: "schiacciate", name: "Schiacciate" },
      { id: "bevande", name: "Bevande" },
    ],
    items: [],
  },
  tables: [],
  takeaways: [],
  currentOrderId: null,
  currentOrderType: null, // 'table' o 'takeaway'
  settings: {
    restaurantName: "Pizzeria Ximenes",
    coverCharge: 1.0,
  },
  ingredients: [
    { id: "acciughe", name: "Acciughe", price: 1.0 },
    { id: "bacon", name: "Bacon", price: 2.0 },
    { id: "bufala", name: "Mozzarella di Bufala", price: 4.0 },
    { id: "carciofi", name: "Carciofi", price: 1.0 },
    { id: "cipolla", name: "Cipolla", price: 1.0 },
    { id: "crudo", name: "Prosciutto Crudo", price: 2.0 },
    { id: "emmental", name: "Emmental", price: 1.0 },
    { id: "friarielli", name: "Friarielli", price: 2.0 },
    { id: "funghi", name: "Funghi", price: 1.0 },
    { id: "gorgonzola", name: "Gorgonzola", price: 1.0 },
    { id: "grana", name: "Scaglie di Grana", price: 1.0 },
    { id: "melanzane", name: "Melanzane", price: 1.0 },
    { id: "mortadella", name: "Mortadella", price: 2.0 },
    { id: "mozzarella", name: "Mozzarella", price: 1.0 },
    { id: "olive", name: "Olive", price: 1.0 },
    { id: "patate", name: "Patatine fritte", price: 1.0 },
    { id: "peperoni", name: "Peperoni", price: 1.0 },
    { id: "pesto", name: "Pesto", price: 1.0 },
    { id: "pistacchio", name: "Pesto di Pistacchio", price: 2.0 },
    { id: "pollo", name: "Pollo a cubetti", price: 2.0 },
    { id: "pomodorini", name: "Pomodorini", price: 1.0 },
    { id: "pomodoro", name: "Pomodoro", price: 0.0 },
    { id: "prosciutto", name: "Prosciutto", price: 1.0 },
    { id: "rucola", name: "Rucola", price: 1.0 },
    { id: "salameDolce", name: "Salame Dolce", price: 2.0 },
    { id: "salame-piccante", name: "Salame Piccante", price: 1.0 },
    { id: "salsiccia", name: "Salsiccia", price: 2.0 },
    { id: "spinaci", name: "Spinaci", price: 1.0 },
    { id: "stracciatella", name: "Stracciatella", price: 2.0 },
    { id: "tonno", name: "Tonno", price: 2.0 },
    { id: "wurstel", name: "Wurstel", price: 1.0 },
  ],
};
// Inizializza l'API client (assicurati che api_client.js sia caricato prima di pizzeria.js nell'HTML)
//let api;
/*if (typeof PizzeriaAPI !== "undefined") {
  api = new PizzeriaAPI();
}*/
// Funzione di inizializzazione
async function initializeApp() {
  await loadData(); // Ora è asincrona
  cleanupCorruptedOrders();
  loadMenuItems();
  renderTabs();
  renderTables();
  renderTakeaways();
  renderMenuEditor();
  setupEventListeners();
  updateUI();

  // AGGIORNATO: Migliora la gestione WebSocket
  if (api && api.socket) {
    console.log("WebSocket connesso, aggiornamenti real-time attivi");

    // Configura i listener WebSocket per sincronizzazione
    setupWebSocketListeners();

    // Dentro initializeApp, dopo setupWebSocketListeners();
    setTimeout(() => {
      syncExistingOrders();
    }, 1000);

    // Definisci la funzione globale per aggiornare l'interfaccia
    window.aggiornaListaOrdini = async function () {
      console.log("Aggiornamento lista ordini...");
      await loadData();
      renderTables();
      renderTakeaways();
    };
  }
}

function setupWebSocketListeners() {
  if (!api || !api.socket) return;

  const socket = api.socket;

  console.log("📡 Setup WebSocket listeners...");

  // Aggiungi un listener per verificare la connessione
  socket.on("connect", () => {
    console.log("✅ WebSocket connesso!");
  });

  socket.on("disconnect", () => {
    console.log("❌ WebSocket disconnesso!");
  });

  // Ascolta gli eventi dal SERVER (non dal client)
  socket.on("ordine_aggiunto", (ordineData) => {
    console.log("🔔 Nuovo ordine da altro dispositivo:", ordineData);
    mostraNotifica(`Nuovo ordine: ${ordineData.tavolo}`, "info");

    // Ricarica i dati e aggiorna l'interfaccia
    window.aggiornaListaOrdini();
  });

  socket.on("ordine_aggiornato", (ordineData) => {
    console.log("🔔 Ordine modificato da altro dispositivo:", ordineData);
    mostraNotifica(`Ordine modificato: ${ordineData.tavolo}`, "warning");

    // Se l'ordine modificato è quello attualmente visualizzato
    if (ordineData.id === appState.currentOrderId) {
      console.log("📱 Aggiornamento ordine corrente in corso...");

      // Trova e aggiorna l'ordine locale
      let orderFound = false;

      if (appState.currentOrderType === "table") {
        const table = appState.tables.find((t) => t.id === ordineData.id);
        if (table) {
          table.order.items = ordineData.items;
          table.order.covers = ordineData.covers || 0;
          table.status = ordineData.stato || table.status;
          orderFound = true;
        }
      } else {
        const takeaway = appState.takeaways.find((t) => t.id === ordineData.id);
        if (takeaway) {
          takeaway.order.items = ordineData.items;
          takeaway.status = ordineData.stato || takeaway.status;
          orderFound = true;
        }
      }

      if (orderFound) {
        saveData();
        renderOrderDetails();
        console.log("✅ Ordine corrente aggiornato");
      }
    }

    // Aggiorna sempre la lista
    window.aggiornaListaOrdini();
  });

  socket.on("ordine_rimosso", (ordineId) => {
    console.log("🔔 Ordine eliminato da altro dispositivo:", ordineId);
    mostraNotifica("Un ordine è stato eliminato", "info");
    window.aggiornaListaOrdini();
  });

  socket.on("tavolo_sincronizzato", (tavoloData) => {
    console.log("🔔 Tavolo sincronizzato:", tavoloData);
    window.aggiornaListaOrdini();
  });
  socket.on("nuovo_tavolo_asporto", (data) => {
    console.log("🆕 Nuovo tavolo/asporto ricevuto:", data);
    console.log("Tipo ricevuto:", data.type);
    console.log("Dati ricevuti:", data.data);

    if (data.type === "takeaway") {
      // Verifica se non esiste già
      const exists = appState.takeaways.some((t) => t.id === data.data.id);
      if (!exists) {
        appState.takeaways.push(data.data);
        saveData();
        renderTakeaways();
        mostraNotifica(`Nuovo asporto creato: #${data.data.number}`, "info");
      }
    } else if (data.type === "table") {
      // Simile per i tavoli
      const exists = appState.tables.some((t) => t.id === data.data.id);
      if (!exists) {
        appState.tables.push(data.data);
        saveData();
        renderTables();
        mostraNotifica(`Nuovo tavolo creato: ${data.data.number}`, "info");
      }
    }
  });
  // NUOVO: Aggiungi listener per sync_all_orders dal server
  socket.on("sync_all_orders_broadcast", (data) => {
    console.log("🔄 Sincronizzazione completa ricevuta:", data);

    // Aggiorna solo se ci sono differenze
    if (data.tables && data.tables.length !== appState.tables.length) {
      appState.tables = data.tables;
      renderTables();
    }

    if (data.takeaways && data.takeaways.length !== appState.takeaways.length) {
      appState.takeaways = data.takeaways;
      renderTakeaways();
    }

    saveData();
  });
  // Listener per chiusura ordini
  socket.on("ordine_chiuso", (data) => {
    console.log("🔒 Ordine chiuso ricevuto:", data);

    let tableOrTakeaway;
    if (data.type === "table") {
      tableOrTakeaway = appState.tables.find((t) => t.id === data.id);
    } else {
      tableOrTakeaway = appState.takeaways.find((t) => t.id === data.id);
    }

    if (tableOrTakeaway) {
      // Imposta lo stato a closed come nel tuo closeOrder
      tableOrTakeaway.status = "closed";
      tableOrTakeaway.order.closedAt = new Date().toISOString();

      saveData();

      // Se stiamo visualizzando questo ordine, torna alla home
      if (appState.currentOrderId === data.id) {
        showTablesView();
      }

      // Aggiorna le visualizzazioni
      renderTables();
      renderTakeaways();

      mostraNotifica(
        `Ordine ${data.type === "table" ? "tavolo" : "asporto"} chiuso`,
        "info"
      );
    }
  });
}

// Funzione per caricare i dati dal localStorage
async function loadData() {
  try {
    // Carica prima i dati locali come fallback
    const savedMenu = localStorage.getItem("pizzeria_menu");
    const savedSettings = localStorage.getItem("pizzeria_settings");
    const savedIngredients = localStorage.getItem("pizzeria_ingredients");

    if (savedMenu) {
      appState.menu = JSON.parse(savedMenu);
    }

    if (savedSettings) {
      appState.settings = JSON.parse(savedSettings);
    }

    if (savedIngredients) {
      appState.ingredients = JSON.parse(savedIngredients);
    }

    // Se l'API è disponibile, carica i dati dal server
    if (api) {
      try {
        // Carica gli ordini dal server (tavoli e asporto)
        const ordiniServer = await api.getOrdini();

        // Mappa gli ordini del server sui tavoli/asporto locali
        // Questo è un esempio, dovrai adattarlo alla struttura dei tuoi dati
        console.log("Ordini dal server:", ordiniServer);

        // Per ora manteniamo la compatibilità con localStorage per tavoli e asporto
        const savedTables = localStorage.getItem("pizzeria_tables");
        const savedTakeaways = localStorage.getItem("pizzeria_takeaways");

        if (savedTables) {
          appState.tables = JSON.parse(savedTables);
        }

        if (savedTakeaways) {
          appState.takeaways = JSON.parse(savedTakeaways);
        }
      } catch (error) {
        console.error("Errore caricamento dati dal server:", error);
        // Usa i dati locali come fallback
      }
    }

    // Rimuovi gli elementi della categoria "rosticceria" se esiste
    const validCategoryIds = appState.menu.categories.map((cat) => cat.id);
    appState.menu.items = appState.menu.items.filter((item) =>
      validCategoryIds.includes(item.categoryId)
    );
  } catch (error) {
    console.error("Errore nel caricamento dei dati:", error);
  }
}
// Funzione di ricerca nel menu
// Sostituisci completamente la funzione searchMenuItems
function searchMenuItems() {
  const searchTerm = document
    .getElementById("menuSearchInput")
    .value.toLowerCase()
    .trim();
  const activeCategory = document
    .querySelector("#editorCategoryTabs .category-tab.active")
    .getAttribute("data-category");

  // Se il campo di ricerca è vuoto, mostra tutti i prodotti della categoria attuale
  if (searchTerm === "") {
    document.getElementById("menuEditorList").innerHTML = "";
    renderMenuItemsForEditor(activeCategory);
    return;
  }

  const menuEditorList = document.getElementById("menuEditorList");
  menuEditorList.innerHTML = "";

  // Filtra gli items per il termine di ricerca
  let items;
  if (searchTerm) {
    // Cerca in tutte le categorie se c'è un termine di ricerca
    items = appState.menu.items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchTerm) ||
        (item.description &&
          item.description.toLowerCase().includes(searchTerm))
    );

    // Ordina i risultati: prima quelli che iniziano con il termine di ricerca,
    // poi quelli che lo contengono altrove nel nome
    items.sort((a, b) => {
      const aNameStart = a.name.toLowerCase().startsWith(searchTerm) ? 0 : 1;
      const bNameStart = b.name.toLowerCase().startsWith(searchTerm) ? 0 : 1;

      if (aNameStart !== bNameStart) {
        return aNameStart - bNameStart;
      }

      return a.name.localeCompare(b.name);
    });
  } else {
    // Altrimenti filtra solo per la categoria corrente
    items = appState.menu.items.filter(
      (item) => item.categoryId === activeCategory
    );
  }

  if (items.length === 0) {
    menuEditorList.innerHTML =
      '<div class="text-center p-3">Nessun risultato trovato.</div>';
    return;
  }

  // Visualizza i risultati
  items.forEach((item) => {
    const categoryName =
      appState.menu.categories.find((c) => c.id === item.categoryId)?.name ||
      "Categoria sconosciuta";

    const editorItem = document.createElement("div");
    editorItem.className = "editor-item";
    editorItem.innerHTML = `
            <div class="editor-item-details">
                <div class="menu-item-name">${item.name}</div>
                <div class="menu-item-category">Categoria: ${categoryName}</div>
                <div class="menu-item-price">€${formatPrice(item.price)}</div>
            </div>
            <div class="editor-item-actions">
                <button class="btn btn-sm btn-outline edit-item" data-id="${
                  item.id
                }">Modifica</button>
                <button class="btn btn-sm btn-danger delete-item" data-id="${
                  item.id
                }">Elimina</button>
            </div>
        `;

    menuEditorList.appendChild(editorItem);
  });

  // Aggiungi event listeners ai pulsanti
  document.querySelectorAll(".edit-item").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const itemId = button.getAttribute("data-id");
      const item = appState.menu.items.find((i) => i.id === itemId);
      if (item) {
        showEditItemModal(item);
      }
    });
  });

  document.querySelectorAll(".delete-item").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const itemId = button.getAttribute("data-id");
      if (confirm("Sei sicuro di voler eliminare questo prodotto?")) {
        appState.menu.items = appState.menu.items.filter(
          (i) => i.id !== itemId
        );
        saveData();
        searchMenuItems(); // Aggiorna i risultati della ricerca
      }
    });
  });
}
// Funzione per salvare i dati nel localStorage
// Sostituisci la funzione saveData() con questa versione
async function saveData() {
  try {
    // Salva sempre in localStorage come backup
    localStorage.setItem("pizzeria_menu", JSON.stringify(appState.menu));
    localStorage.setItem("pizzeria_tables", JSON.stringify(appState.tables));
    localStorage.setItem(
      "pizzeria_takeaways",
      JSON.stringify(appState.takeaways)
    );
    localStorage.setItem(
      "pizzeria_settings",
      JSON.stringify(appState.settings)
    );
    localStorage.setItem(
      "pizzeria_ingredients",
      JSON.stringify(appState.ingredients)
    );

    // Se l'API è disponibile, sincronizza con il server
    if (api) {
      console.log("Sincronizzazione con il server...");

      // Qui puoi aggiungere logica per sincronizzare menu, impostazioni, ecc.
      // Per ora ci concentriamo sugli ordini che sono già gestiti
    }
  } catch (error) {
    console.error("Errore nel salvataggio dei dati:", error);
  }
}
// Aggiungi questa funzione per creare un ordine sul server
/*async function addItemToOrder(tableOrTakeaway, type) {
  if (!api) return;

  try {
    const orderData = {
      numero_ordine: `${type}-${tableOrTakeaway.id}-${Date.now()}`,
      tavolo:
        type === "table"
          ? `${tableOrTakeaway.prefix || ""} ${tableOrTakeaway.number}`
          : `Asporto #${tableOrTakeaway.number}`,
      articoli: tableOrTakeaway.order.items.map((item) => ({
        nome: item.name,
        prezzo: item.basePrice,
        quantita: item.quantity,
        note: item.notes || "",
      })),
      note: tableOrTakeaway.order.notes || "",
    };

    const result = await api.salvaOrdine(orderData);
    console.log("Ordine salvato sul server:", result);

    // Salva l'ID dell'ordine del server nell'oggetto locale
    tableOrTakeaway.serverOrderId = result.ordine.id;

    // NUOVO: Emetti evento WebSocket per sincronizzazione
    if (api.socket && api.socket.connected) {
      api.socket.emit("nuovo_ordine", result.ordine);
      console.log("📡 Evento nuovo_ordine inviato via WebSocket");
    }

    return result;
  } catch (error) {
    console.error("Errore creazione ordine sul server:", error);
  }
}*/

// Caricamento iniziale dei prodotti dal menu fornito
function loadMenuItems() {
  // Se ci sono già prodotti nel menu, non caricare quelli predefiniti
  if (appState.menu.items.length > 0) {
    return;
  }

  // Lista degli antipasti
  appState.menu.items.push({
    id: generateId(),
    categoryId: "antipasti",
    name: "Patatine fritte",
    price: 3.0,
    description: "",
    variants: [
      { name: "Piccole", price: 2.0 },
      { name: "Medie", price: 3.0 },
      { name: "Grandi", price: 5.0 },
    ],
    defaultVariant: "Medie",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "antipasti",
    name: "Misto caldo",
    price: 7.0,
    description: "Patatine fritte con frittura mista secondo disponibilità",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "antipasti",
    name: "Sfincionello",
    price: 7.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "antipasti",
    name: "Bruschetta",
    price: 7.0,
    description: "Pizza condita con pomodoro a pezzi",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "antipasti",
    name: "Bomba atomica",
    price: 15.0,
    description:
      "Patatine fritte, panelle, crocchè di patate, anelli di cipolla, arancinette, crocchette di pollo e mozzarelline fritte",
  });

  // Lista delle pizze speciali
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Cu ti sta tuccannu'",
    price: 7.0,
    description: "Pomodoro, mozzarella fiordilatte, funghi freschi, salsiccia",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Chicken BBQ",
    price: 8.0,
    description: "Mozzarella fiordilatte, pollo a cubetti, bacon, salsa BBQ",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Messicana",
    price: 8.0,
    description:
      "Pomodoro, mozzarella fiordilatte, carciofi, melanzane, pomodoro a fette, olive",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Sfilatino",
    price: 8.0,
    description: "Mozzarella, prosciutto, salame piccante, emmental",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Un mi tuccari chiu'",
    price: 8.0,
    description:
      "Pomodoro, mozzarella fiordilatte, carciofi, funghi freschi, salsiccia",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Stracciatella",
    price: 9.0,
    description:
      "Mozzarella fiordilatte, prosciutto, emmental, salame piccante, bacon, con al centro panna e mozzarella",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Quadrangola",
    price: 9.0,
    description:
      "Pomodoro, mozzarella, prosciutto, salsiccia, emmental, con bordi ripieni di mozzarella e prosciutto",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Greca",
    price: 9.0,
    description:
      "Pomodoro, mozzarella fiordilatte, prosciutto, gorgonzola, melanzane, salame piccante, caciocavallo",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Ai salumi",
    price: 9.0,
    description:
      "Pomodoro, mozzarella fiordilatte, salame dolce, bacon, emmental",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Colapesce",
    price: 9.0,
    description:
      "Mozzarella fiordilatte, Emmental, Gorgonzola, prosciutto, Salame piccante, cipolla",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "U' ziu Vicè",
    price: 9.0,
    description:
      "Mozzarella fiordilatte, bacon, salsiccia, patatine fritte, salsa BBQ",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Italia",
    price: 10.0,
    description: "Pomodoro, pesto, mozzarella di Bufala, pomodorini, noci",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Friarielli",
    price: 10.0,
    description: "Mozzarella di Bufala, Friarielli, salsiccia",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "4 Canti",
    price: 10.0,
    description:
      "1/4 quattro formaggi, 1/4 capricciosa, 1/4 romana con salame piccante, 1/4 mozzarella fiordilatte, salsiccia e cipolla",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Philip Morris",
    price: 10.0,
    description:
      "Pomodoro, mozzarella fiordilatte, pesto, crudo, ricotta e scaglie di Grana",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Covaccino",
    price: 12.0,
    description:
      "Tutti i condimenti vengono serviti all uscita della pizza. Mozzarella di bufala, prosciutto crudo, pomodorini, rucola, scaglie di Grana",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Pistacchiosa",
    price: 12.0,
    description:
      "Pesto di pistacchio, mozzarella di bufala, mortadella e granella di pistacchio",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-speciali",
    name: "Original",
    price: 13.0,
    description:
      "Pomodoro, mozzarella di bufala, prosciutto crudo, rucola, pomodorini, scaglie di Grana",
  });

  // Lista delle pizze classiche
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Margherita",
    price: 4.0,
    description: "Pomodoro e mozzarella fiordilatte",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Biancaneve",
    price: 4.5,
    description: "Mozzarella fiordilatte",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Romana",
    price: 4.5,
    description: "Pomodoro, mozzarella fiordilatte e prosciutto",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Diavola",
    price: 4.5,
    description: "Pomodoro, mozzarella fiordilatte e salame piccante",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Marinara",
    price: 4.5,
    description: "Pomodoro, acciughe, origano e olio",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Napoli",
    price: 4.5,
    description: "Pomodoro, mozzarella fiordilatte, acciughe",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Calzone",
    price: 4.5,
    description:
      "Pizza ripiena di pomodoro, mozzarella fiordilatte e prosciutto cotto",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Patatosa",
    price: 5.0,
    description: "Pomodoro, mozzarella fiordilatte, patatine fritte",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Parmigiana",
    price: 5.0,
    description:
      "Pomodoro, mozzarella fiordilatte, melanzane, scaglie di Grana",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "4 Formaggi",
    price: 5.0,
    description: "Mozzarella fiordilatte, gorgonzola, emmental, formaggi vari",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "4 Gusti",
    price: 5.0,
    description: "Pomodoro, mozzarella fiordilatte, prosciutto, carciofi",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Nutella",
    price: 5.0,
    description: "",
    noFamily: true, // Questo flag impedirà l'opzione familiare
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Capricciosa",
    price: 6.0,
    description:
      "Pomodoro, mozzarella fiordilatte, prosciutto, carciofi, funghi freschi, wurstel, olive",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Bomba",
    price: 6.0,
    description:
      "Pomodoro, mozzarella fiordilatte, prosciutto cotto, funghi freschi, salame piccante",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Faccia da vecchia",
    price: 6.0,
    description: "Cipolla, mollica, acciughe, caciocavallo",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Tonno",
    price: 6.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Braccio di ferro",
    price: 6.5,
    description: "Mozzarella fiordilatte, spinaci, gorgonzola",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Calzone Special",
    price: 7.0,
    description:
      "Pomodoro, mozzarella fiordilatte, salame piccante, salsiccia, melanzane",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Boscaiola",
    price: 7.0,
    description:
      "Pomodoro, mozzarella fiordilatte, prosciutto cotto, salsiccia, funghi freschi",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "San Daniele",
    price: 7.0,
    description:
      "Pomodoro, mozzarella fiordilatte, prosciutto crudo e scaglie di Grana",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Pazza",
    price: 7.0,
    description:
      "Mozzarella fiordilatte, pomodoro a fette, rucola, scaglie di grana",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Completa",
    price: 7.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Bruschetta",
    price: 7.0,
    description: "Pomodoro, olio, origano, aglio",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Sfincionello",
    price: 7.0,
    description: "Pomodoro, origano, olio",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Bufalina",
    price: 8.0,
    description: "Pomodoro e mozzarella di bufala",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Vegetariana",
    price: 8.0,
    description:
      "Pomodoro, funghi freschi, carciofi, melanzane, peperoni, spinaci",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Rustica",
    price: 8.0,
    description:
      "Pomodoro, salame dolce, pomodoro a fette, formaggio, mozzarella fiordilatte e origano",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Campagnola",
    price: 8.0,
    description:
      "Pomodoro, mozzarella fiordilatte, cipolla, pomodoro a fette, olive, caciocavallo",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-classiche",
    name: "Esplosiva",
    price: 8.0,
    description:
      "Pomodoro, mozzarella fiordilatte, salame piccante, salsiccia, peperoni",
  });

  // Lista delle pizze create dai clienti
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "Silvio",
    price: 6.0,
    description: "Pomodoro, mozzarella fiordilatte, funghi, gorgonzola",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "Peppe",
    price: 6.5,
    description:
      "Pomodoro, mozzarella fiordilatte, salame piccante, funghi, emmental",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "Riccardo",
    price: 7.0,
    description: "Mozzarella fiordilatte, tonno, pomodoro a fette, salsa rosa",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "El Nino",
    price: 7.0,
    description:
      "Pomodoro, mozzarella fiordilatte, cipolla, peperoni, pomodoro a fette",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "Matteo",
    price: 7.5,
    description:
      "Pomodoro, mozzarella fiordilatte, patatine, salsiccia, cipolla",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "Don Dom",
    price: 7.5,
    description:
      "Pomodoro, mozzarella fiordilatte, prosciutto, melanzane, gorgonzola, scaglie di Grana",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "Russo",
    price: 7.5,
    description:
      "Pomodoro, mozzarella fiordilatte, salame piccante, salsiccia, emmental",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "Federica",
    price: 9.0,
    description: "Mozzarella fiordilatte, salsiccia, emmental, bacon",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "Salvo",
    price: 9.0,
    description:
      "Pomodoro, mozzarella fiordilatte, carciofi, salsiccia, pomodorini, rucola",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "Rita",
    price: 10.0,
    description: "Bufala, salsiccia, funghi, pesto di pistacchio",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "pizze-create",
    name: "Martina",
    price: 10.0,
    description:
      "Mozzarella fiordilatte, funghi, spinaci, salsiccia, melanzane, scaglie di grana",
  });

  // Lista schiacciate
  appState.menu.items.push({
    id: generateId(),
    categoryId: "schiacciate",
    name: "Classica",
    price: 5.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "schiacciate",
    name: "Norma",
    price: 5.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "schiacciate",
    name: "4 Caci",
    price: 5.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "schiacciate",
    name: "Tonnata",
    price: 6.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "schiacciate",
    name: "Sfiziosa",
    price: 8.0,
    description: "",
  });

  // Lista bevande
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Acqua 50 cl",
    price: 1.0,
    description: "Naturale o frizzante",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Partannina",
    price: 1.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Caffe",
    price: 1.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Spuma",
    price: 1.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Acqua 1L",
    price: 2.0,
    description: "Naturale o frizzante",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Coca cola 33 cl",
    price: 2.0,
    description: "Classica oppure Zero",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Fanta",
    price: 2.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Sprite",
    price: 2.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Chinotto",
    price: 2.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Moretti 33 cl",
    price: 2.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Amaro",
    price: 2.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Limoncello",
    price: 2.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "The",
    price: 2.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Energy Drink",
    price: 2.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Beck's",
    price: 3.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Heineken",
    price: 3.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Moretti 66 cl",
    price: 3.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Red Bull",
    price: 3.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Corona",
    price: 3.5,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Coca Cola Bottiglia",
    price: 4.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Tennent's",
    price: 4.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Ichnusa",
    price: 4.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Ceres",
    price: 4.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Messina",
    price: 4.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Corvo Glicine",
    price: 12.0,
    description: "",
  });
  appState.menu.items.push({
    id: generateId(),
    categoryId: "bevande",
    name: "Vino Regaliali",
    price: 15.0,
    description: "",
  });
}
// Funzioni di utilità
function generateId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}
// Funzione helper per emettere eventi WebSocket
// Funzione helper per emettere eventi WebSocket
function emitOrderUpdate(action = "ordine_modificato") {
  if (!api || !api.socket || !api.socket.connected) return;

  let tableOrTakeaway;
  let displayName;

  if (appState.currentOrderType === "table") {
    tableOrTakeaway = appState.tables.find(
      (t) => t.id === appState.currentOrderId
    );
    if (tableOrTakeaway) {
      if (tableOrTakeaway.customName) {
        displayName = `Tavolo ${
          tableOrTakeaway.prefix ? tableOrTakeaway.prefix + " " : ""
        }${tableOrTakeaway.customName}`;
      } else {
        displayName = `Tavolo ${
          tableOrTakeaway.prefix ? tableOrTakeaway.prefix + " " : ""
        }${tableOrTakeaway.number}`;
      }
    }
  } else {
    tableOrTakeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (tableOrTakeaway) {
      displayName = `Asporto #${tableOrTakeaway.number}`;
    }
  }

  if (tableOrTakeaway && displayName) {
    const orderData = {
      id: appState.currentOrderId,
      type: appState.currentOrderType,
      tavolo: displayName,
      items: tableOrTakeaway.order.items,
      covers: tableOrTakeaway.order.covers || 0,
      stato: tableOrTakeaway.status,
    };

    // Usa i nomi degli eventi che il server ascolta
    api.socket.emit(action, orderData);
    console.log(`📡 Evento ${action} emesso:`, orderData);
  }
}
// Funzione per mostrare notifiche
function mostraNotifica(messaggio, tipo = "info") {
  // Crea elemento notifica
  const notifica = document.createElement("div");
  notifica.className = `notifica notifica-${tipo}`;
  notifica.innerHTML = `
    <span>${messaggio}</span>
    <button onclick="this.parentElement.remove()">×</button>
  `;

  // Aggiungi al DOM
  document.body.appendChild(notifica);

  // Rimuovi automaticamente dopo 5 secondi
  setTimeout(() => {
    if (notifica.parentElement) {
      notifica.remove();
    }
  }, 5000);
}
async function modificaOrdineServer(ordineId, nuoviDati) {
  if (!api) return;

  try {
    const response = await api.modificaOrdine(ordineId, nuoviDati);

    // Emetti evento WebSocket
    if (api.socket && api.socket.connected) {
      api.socket.emit("ordine_modificato", response);
      console.log("📡 Evento ordine_modificato inviato via WebSocket");
    }

    return response;
  } catch (error) {
    console.error("❌ Errore modifica ordine:", error);
  }
}

// Funzione per eliminare ordine (aggiungi se non ce l'hai)
async function eliminaOrdineServer(ordineId) {
  if (!api) return;

  try {
    const response = await api.eliminaOrdine(ordineId);

    // Emetti evento WebSocket
    if (api.socket && api.socket.connected) {
      api.socket.emit("ordine_eliminato", ordineId);
      console.log("📡 Evento ordine_eliminato inviato via WebSocket");
    }

    return response;
  } catch (error) {
    console.error("❌ Errore eliminazione ordine:", error);
  }
}
function formatPrice(price) {
  return parseFloat(price).toFixed(2);
}

// Funzioni per l'interfaccia utente
function renderTabs() {
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = tab.getAttribute("data-tab");

      // Rimuove la classe 'active' da tutte le tab e contenuti
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Aggiunge la classe 'active' alla tab e contenuto corrente
      tab.classList.add("active");
      document.getElementById(tabId).classList.add("active");

      // Gestione casi speciali
      if (tabId === "tables-back") {
        showTablesView();
      }
    });
  });
}

function showTablesView() {
  // Nascondi la vista dell'ordine
  document.getElementById("orderView").classList.add("hidden");

  // Mostra le tab principali e i contenuti delle tab
  document.querySelectorAll(".tabs, .tab-content").forEach((el) => {
    if (!el.closest("#orderView")) {
      el.classList.remove("hidden");
    }
  });

  // Seleziona la tab dei tavoli
  document.querySelector('.tabs button[data-tab="tables"]').click();
}

function showOrderView(orderId, orderType) {
  appState.currentOrderId = orderId;
  appState.currentOrderType = orderType;

  document.getElementById("orderView").classList.remove("hidden");
  document.querySelectorAll(".tabs, .tab-content").forEach((el) => {
    if (!el.closest("#orderView")) {
      el.classList.add("hidden");
    }
  });

  renderOrderDetails();
  renderMenuCategories();
}

function updateUI() {
  document.getElementById("restaurantName").value =
    appState.settings.restaurantName;
  document.getElementById("coverCharge").value = appState.settings.coverCharge;
  document.querySelector("header h1").textContent =
    appState.settings.restaurantName + " - Gestionale";
}

function renderTakeaways() {
  const takeawayContainer = document.getElementById("takeawayContainer");
  takeawayContainer.innerHTML = "";

  appState.takeaways.forEach((takeaway) => {
    const takeawayCard = document.createElement("div");
    takeawayCard.className = `table-card ${takeaway.status}`;
    takeawayCard.innerHTML = `
            <div class="table-number">Asporto #${takeaway.number}</div>
            <div class="table-status ${takeaway.status}">${getStatusText(
      takeaway.status
    )}</div>
        `;

    takeawayCard.addEventListener("click", () => {
      if (takeaway.status === "closed") {
        // Per gli asporti chiusi, apri in modalità di sola lettura
        showOrderView(takeaway.id, "takeaway");
        // Disabilita i pulsanti di modifica
        document.getElementById("printOrderBtn").disabled = false;
        document.getElementById("printReceiptBtn").disabled = false;
        document.getElementById("closeOrderBtn").disabled = true;
        document.getElementById("applyDiscountBtn").disabled = true;
      } else {
        // Per gli asporti attivi o nuovi
        if (takeaway.status === "new") {
          // Inizializza un nuovo ordine per gli asporti nuovi
          takeaway.status = "active";
          takeaway.order = {
            items: [],
            discount: 0,
            discountType: "percentage",
            discountReason: "",
            customerName: "",
            customerPhone: "",
            createdAt: new Date().toISOString(),
          };
          saveData();
        }

        showOrderView(takeaway.id, "takeaway");
        // Abilita tutti i pulsanti
        document.getElementById("printOrderBtn").disabled = false;
        document.getElementById("printReceiptBtn").disabled = false;
        document.getElementById("closeOrderBtn").disabled = false;
        document.getElementById("applyDiscountBtn").disabled = false;
      }
    });

    takeawayContainer.appendChild(takeawayCard);
  });
}

function getStatusText(status) {
  switch (status) {
    case "new":
      return "Da Aprire";
    case "active":
      return "Attivo";
    case "closed":
      return "Chiuso";
    default:
      return status;
  }
}

// Funzioni per la gestione del menu
function renderMenuEditor() {
  // Render delle categorie nel menu editor
  const editorCategoryTabs = document.getElementById("editorCategoryTabs");
  editorCategoryTabs.innerHTML = "";

  appState.menu.categories.forEach((category, index) => {
    const categoryTab = document.createElement("button");
    categoryTab.className = `category-tab ${index === 0 ? "active" : ""}`;
    categoryTab.textContent = category.name;
    categoryTab.setAttribute("data-category", category.id);

    categoryTab.addEventListener("click", () => {
      document
        .querySelectorAll("#editorCategoryTabs .category-tab")
        .forEach((tab) => {
          tab.classList.remove("active");
        });
      categoryTab.classList.add("active");
      renderMenuItemsForEditor(category.id);
    });

    editorCategoryTabs.appendChild(categoryTab);
  });

  // Render degli items per la prima categoria
  if (appState.menu.categories.length > 0) {
    renderMenuItemsForEditor(appState.menu.categories[0].id);
  }
}

function renderMenuItemsForEditor(categoryId) {
  const menuEditorList = document.getElementById("menuEditorList");
  menuEditorList.innerHTML = "";

  const items = appState.menu.items.filter(
    (item) => item.categoryId === categoryId
  );

  items.forEach((item) => {
    const editorItem = document.createElement("div");
    editorItem.className = "editor-item";
    editorItem.innerHTML = `
            <div class="editor-item-details">
                <div class="menu-item-name">${item.name}</div>
                <div class="menu-item-price">€${formatPrice(item.price)}</div>
            </div>
            <div class="editor-item-actions">
                <button class="btn btn-sm btn-outline edit-item" data-id="${
                  item.id
                }">Modifica</button>
                <button class="btn btn-sm btn-danger delete-item" data-id="${
                  item.id
                }">Elimina</button>
            </div>
        `;

    menuEditorList.appendChild(editorItem);
  });

  // Aggiungi event listeners ai pulsanti
  document.querySelectorAll(".edit-item").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const itemId = button.getAttribute("data-id");
      const item = appState.menu.items.find((i) => i.id === itemId);
      if (item) {
        showEditItemModal(item);
      }
    });
  });

  document.querySelectorAll(".delete-item").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const itemId = button.getAttribute("data-id");
      if (confirm("Sei sicuro di voler eliminare questo prodotto?")) {
        appState.menu.items = appState.menu.items.filter(
          (i) => i.id !== itemId
        );
        saveData();
        renderMenuItemsForEditor(categoryId);
      }
    });
  });
}

// Funzioni per la gestione degli ordini
function renderMenuCategories() {
  const categoriesTabs = document.getElementById("categoriesTabs");
  const menuCategories = document.getElementById("menuCategories");

  categoriesTabs.innerHTML = "";
  menuCategories.innerHTML = "";

  appState.menu.categories.forEach((category, index) => {
    // Crea la tab della categoria
    const categoryTab = document.createElement("button");
    categoryTab.className = `category-tab ${index === 0 ? "active" : ""}`;
    categoryTab.textContent = category.name;
    categoryTab.setAttribute("data-category", category.id);

    categoryTab.addEventListener("click", () => {
      document
        .querySelectorAll("#categoriesTabs .category-tab")
        .forEach((tab) => {
          tab.classList.remove("active");
        });
      categoryTab.classList.add("active");

      document.querySelectorAll(".menu-category").forEach((cat) => {
        cat.classList.remove("active");
      });
      document
        .querySelector(`.menu-category[data-category="${category.id}"]`)
        .classList.add("active");
    });

    categoriesTabs.appendChild(categoryTab);

    // Crea la sezione per gli items della categoria
    const categorySection = document.createElement("div");
    categorySection.className = `menu-category ${index === 0 ? "active" : ""}`;
    categorySection.setAttribute("data-category", category.id);

    const items = appState.menu.items.filter(
      (item) => item.categoryId === category.id
    );

    items.forEach((item) => {
      const menuItem = document.createElement("div");
      menuItem.className = "menu-item";
      menuItem.innerHTML = `
                <div class="menu-item-name">${item.name}</div>
                <div class="menu-item-price">€${formatPrice(item.price)}</div>
            `;

      menuItem.addEventListener("click", () => {
        // Quando si clicca su un item, lo aggiungiamo all'ordine corrente
        addItemToOrder(item);
      });

      categorySection.appendChild(menuItem);
    });
    // Aggiungi un item speciale per la categoria 1/2 Familiari
    if (appState.menu.categories.some((cat) => cat.id === "mezze-familiari")) {
      const halfFamilyCategory = document.querySelector(
        '.menu-category[data-category="mezze-familiari"]'
      );
      if (halfFamilyCategory) {
        halfFamilyCategory.innerHTML = `
      <div class="menu-item" style="grid-column: 1 / -1;">
        <div class="menu-item-name">Pizza 1/2 e 1/2 Familiare</div>
        <div class="menu-item-price">Prezzo variabile</div>
      </div>
    `;

        halfFamilyCategory
          .querySelector(".menu-item")
          .addEventListener("click", () => {
            showHalfFamilyModal();
          });
      }
    }
    menuCategories.appendChild(categorySection);
  });
}

function renderOrderDetails() {
  let order;
  let orderTitle;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table) return;
    order = table.order;
    if (table.customName) {
      orderTitle = `Tavolo ${table.prefix ? table.prefix + " " : ""}${
        table.customName
      }`;
    } else {
      orderTitle = `Tavolo ${table.prefix ? table.prefix + " " : ""}${
        table.number
      }`;
    }
    document.getElementById("orderStatus").textContent = getStatusText(
      table.status
    );
    document.getElementById(
      "orderStatus"
    ).className = `table-status ${table.status}`;
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway) return;
    order = takeaway.order;
    orderTitle = `Asporto #${takeaway.number}`;
    document.getElementById("orderStatus").textContent = getStatusText(
      takeaway.status
    );
    document.getElementById(
      "orderStatus"
    ).className = `table-status ${takeaway.status}`;
  } else {
    return;
  }

  document.getElementById("orderTitle").textContent = orderTitle;

  // Render degli items dell'ordine
  const orderItemsContainer = document.getElementById("orderItems");
  orderItemsContainer.innerHTML = "";

  if (!order || !order.items) return;

  // Aggiungi coperto se è un tavolo, non per asporto
  renderCoverItem(order, orderItemsContainer);

  // Aggiungi gli items dell'ordine
  order.items.forEach((item, index) => {
    // Log di debug
    console.log(`Rendering item ${index}:`, item);

    // Controllo di sicurezza per evitare items undefined
    if (!item || !item.name) {
      console.error("❌ Item non valido trovato all'indice", index, ":", item);
      return; // Salta questo item
    }
    const orderItem = document.createElement("div");
    orderItem.className = "order-item";

    // All'interno del blocco che costruisce itemDetails, dopo il nome dell'item
    let itemDetails = `
    <div class="order-item-details">
        <div class="order-item-name">${item.name} x ${item.quantity}</div>
`;

    // Aggiungi l'indicazione per le pizze familiari
    if (item.isFamily) {
      itemDetails +=
        '<div class="order-item-options"><div>Familiare</div></div>';
    }
    // Aggiungi l'indicazione per le mezze familiari
    if (item.isHalfFamily) {
      itemDetails +=
        '<div class="order-item-options"><div>Familiare 1/2 e 1/2</div></div>';

      // Mostra le aggiunzioni/rimozioni per ogni metà
      if (item.firstHalf) {
        if (
          (item.firstHalf.additions && item.firstHalf.additions.length > 0) ||
          (item.firstHalf.removals && item.firstHalf.removals.length > 0)
        ) {
          itemDetails +=
            '<div class="order-item-options" style="font-size: 0.9em;">';
          itemDetails += `<div><strong>1/2 ${item.firstHalf.name}:</strong></div>`;

          if (item.firstHalf.additions && item.firstHalf.additions.length > 0) {
            const additionsList = item.firstHalf.additions
              .map((a) => `+ ${a.name}`)
              .join(", ");
            itemDetails += `<div style="margin-left: 10px;">${additionsList}</div>`;
          }

          if (item.firstHalf.removals && item.firstHalf.removals.length > 0) {
            const removalsList = item.firstHalf.removals
              .map((r) => `- ${r}`)
              .join(", ");
            itemDetails += `<div style="margin-left: 10px;">${removalsList}</div>`;
          }

          itemDetails += "</div>";
        }
      }

      if (item.secondHalf) {
        if (
          (item.secondHalf.additions && item.secondHalf.additions.length > 0) ||
          (item.secondHalf.removals && item.secondHalf.removals.length > 0)
        ) {
          itemDetails +=
            '<div class="order-item-options" style="font-size: 0.9em;">';
          itemDetails += `<div><strong>1/2 ${item.secondHalf.name}:</strong></div>`;

          if (
            item.secondHalf.additions &&
            item.secondHalf.additions.length > 0
          ) {
            const additionsList = item.secondHalf.additions
              .map((a) => `+ ${a.name}`)
              .join(", ");
            itemDetails += `<div style="margin-left: 10px;">${additionsList}</div>`;
          }

          if (item.secondHalf.removals && item.secondHalf.removals.length > 0) {
            const removalsList = item.secondHalf.removals
              .map((r) => `- ${r}`)
              .join(", ");
            itemDetails += `<div style="margin-left: 10px;">${removalsList}</div>`;
          }

          itemDetails += "</div>";
        }
      }
    }

    // Mostra opzioni pizza se presenti
    if (
      (item.additions && item.additions.length > 0) ||
      (item.removals && item.removals.length > 0)
    ) {
      itemDetails += '<div class="order-item-options">';

      if (item.additions && item.additions.length > 0) {
        const additionsList = item.additions
          .map((a) => `+ ${a.name}`)
          .join(", ");
        itemDetails += `<div>${additionsList}</div>`;
      }

      if (item.removals && item.removals.length > 0) {
        const removalsList = item.removals.map((r) => `NO ${r}`).join(", ");
        itemDetails += `<div>${removalsList}</div>`;
      }

      itemDetails += "</div>";
    }

    // Mostra note se presenti
    if (item.notes) {
      itemDetails += `<div class="order-item-options">Note: ${item.notes}</div>`;
    }

    // Mostra informazioni su sconto od omaggio
    if (item.discount > 0 || item.isComplement) {
      itemDetails += '<div class="order-item-options">';

      if (item.discount > 0) {
        itemDetails += `<div>Sconto: ${item.discount}%</div>`;
      }

      if (item.isComplement) {
        itemDetails += "<div>Omaggio</div>";
      }

      itemDetails += "</div>";
    }

    itemDetails += "</div>";

    // Calcola il prezzo incluso modifiche
    let itemPrice = item.basePrice;

    // Applica il fattore moltiplicativo per pizze familiari
    if (item.isFamily) {
      itemPrice *= 2;
    }

    // Aggiungi costi per aggiunzioni
    if (item.additions && item.additions.length > 0) {
      item.additions.forEach((addition) => {
        // Per le pizze familiari, anche le aggiunte costano il doppio
        let additionPrice = addition.price;
        if (item.isFamily) {
          additionPrice *= 2;
        }
        itemPrice += additionPrice;
      });
    }

    // Applica sconto se presente
    let finalPrice = itemPrice;
    if (item.discount > 0) {
      finalPrice = itemPrice * (1 - item.discount / 100);
    }

    // Se è un omaggio, il prezzo è 0
    if (item.isComplement) {
      finalPrice = 0;
    }

    // Moltiplica per la quantità
    finalPrice = finalPrice * item.quantity;

    orderItem.innerHTML = `
            ${itemDetails}
            <div class="order-item-price">€${formatPrice(finalPrice)}</div>
            <div class="order-item-actions">
                <button class="btn btn-sm btn-icon btn-outline edit-order-item" data-index="${index}" title="Modifica">✏️</button>
                <button class="btn btn-sm btn-icon btn-danger remove-order-item" data-index="${index}" title="Rimuovi">🗑️</button>
            </div>
        `;

    orderItemsContainer.appendChild(orderItem);
  });

  // Aggiungi event listeners ai pulsanti
  document.querySelectorAll(".edit-order-item").forEach((button) => {
    button.addEventListener("click", () => {
      const index = parseInt(button.getAttribute("data-index"));
      showEditOrderItemModal(index);
    });
  });

  document.querySelectorAll(".remove-order-item").forEach((button) => {
    button.addEventListener("click", () => {
      const index = parseInt(button.getAttribute("data-index"));
      if (
        confirm("Sei sicuro di voler rimuovere questo prodotto dall'ordine?")
      ) {
        removeItemFromOrder(index);
      }
    });
  });

  // Aggiorna i totali
  updateOrderTotals();
}

function addItemToOrder(menuItem) {
  // Controllo validità menuItem
  if (!menuItem || !menuItem.name) {
    console.error("❌ Tentativo di aggiungere item non valido:", menuItem);
    return;
  }
  let orderObject;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table || table.status === "closed") return;
    orderObject = table.order;
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway || takeaway.status === "closed") return;
    orderObject = takeaway.order;
  } else {
    return;
  }

  // Crea un nuovo item per l'ordine
  const orderItem = {
    name: menuItem.name,
    basePrice: menuItem.price,
    quantity: 1,
    discount: 0,
    isComplement: false,
    isFamily: false,
    notes: "",
    additions: [],
    removals: [],
  };

  // Aggiungi l'item all'ordine
  orderObject.items.push(orderItem);
  saveData();

  // Emetti evento WebSocket con il nome corretto
  if (api && api.socket && api.socket.connected) {
    let tableOrTakeaway;
    if (appState.currentOrderType === "table") {
      tableOrTakeaway = appState.tables.find(
        (t) => t.id === appState.currentOrderId
      );
    } else {
      tableOrTakeaway = appState.takeaways.find(
        (t) => t.id === appState.currentOrderId
      );
    }

    if (tableOrTakeaway) {
      const orderData = {
        id: appState.currentOrderId,
        type: appState.currentOrderType,
        tavolo:
          appState.currentOrderType === "table"
            ? `Tavolo ${tableOrTakeaway.prefix || ""} ${
                tableOrTakeaway.number || tableOrTakeaway.customName || ""
              }`
            : `Asporto #${tableOrTakeaway.number}`,
        items: orderObject.items,
        covers: orderObject.covers || 0,
        stato: tableOrTakeaway.status,
      };

      // Usa 'ordine_modificato' che il server ascolta
      api.socket.emit("ordine_modificato", orderData);
      console.log("📡 Evento ordine_modificato emesso:", orderData);
    }
  }

  // Aggiorna la visualizzazione dell'ordine
  renderOrderDetails();

  // Se è una pizza o una schiacciata, apri automaticamente il modal per modificarla
  const isPizza =
    menuItem.categoryId === "pizze-classiche" ||
    menuItem.categoryId === "pizze-speciali" ||
    menuItem.categoryId === "pizze-create" ||
    menuItem.categoryId === "schiacciate" ||
    menuItem.name.toLowerCase().includes("pizza") ||
    menuItem.name.toLowerCase().includes("margherita") ||
    menuItem.name.toLowerCase().includes("diavola") ||
    menuItem.name.toLowerCase().includes("romana") ||
    menuItem.name.toLowerCase().includes("calzone");

  if (isPizza) {
    showEditOrderItemModal(orderObject.items.length - 1);
  }
}
// Funzione per mostrare il modal di selezione mezze familiari
// Funzione per mostrare il modal di selezione mezze familiari
function showHalfFamilyModal(editIndex = null) {
  let editingItem = null;
  if (editIndex !== null) {
    editingItem = getCurrentOrderItem(editIndex);
  }

  // Crea il modal se non esiste
  let modal = document.getElementById("halfFamilyModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "halfFamilyModal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 700px;">
      <div class="modal-header">
        <h3 class="modal-title">${
          editingItem ? "Modifica" : "Nuova"
        } Pizza 1/2 e 1/2 Familiare</h3>
        <button class="modal-close" onclick="document.getElementById('halfFamilyModal').classList.remove('active')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Prima metà</label>
          <select class="form-control" id="firstHalf">
            <option value="">-- Seleziona --</option>
          </select>
        </div>
        
        <div id="firstHalfOptions" style="display: none; margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
          <h5 style="margin-bottom: 10px;">Opzioni prima metà</h5>
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <button type="button" class="btn btn-sm btn-outline" id="addFirstAddition">+ Aggiungi</button>
            <button type="button" class="btn btn-sm btn-outline" id="addFirstRemoval">- Rimuovi</button>
          </div>
          <div id="firstHalfModifications"></div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Seconda metà</label>
          <select class="form-control" id="secondHalf">
            <option value="">-- Seleziona --</option>
          </select>
        </div>
        
        <div id="secondHalfOptions" style="display: none; margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
          <h5 style="margin-bottom: 10px;">Opzioni seconda metà</h5>
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <button type="button" class="btn btn-sm btn-outline" id="addSecondAddition">+ Aggiungi</button>
            <button type="button" class="btn btn-sm btn-outline" id="addSecondRemoval">- Rimuovi</button>
          </div>
          <div id="secondHalfModifications"></div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Prezzo consigliato</label>
          <div class="price-control" style="display: flex; align-items: center; gap: 1rem;">
            <button type="button" class="btn btn-outline btn-icon" id="decreasePriceBtn" style="width: 40px; height: 40px;">−</button>
            <input type="number" class="form-control" id="suggestedPrice" value="0" readonly style="width: 100px; text-align: center;">
            <button type="button" class="btn btn-outline btn-icon" id="increasePriceBtn" style="width: 40px; height: 40px;">+</button>
          </div>
          <small id="priceBreakdown" style="display: block; margin-top: 5px; color: #666;"></small>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="document.getElementById('halfFamilyModal').classList.remove('active')">Annulla</button>
        <button class="btn btn-primary" id="saveHalfFamilyBtn">${
          editingItem ? "Salva" : "Aggiungi"
        }</button>
      </div>
    </div>
  `;

  // Popola i select con le pizze
  const pizzas = appState.menu.items.filter(
    (item) =>
      item.categoryId === "pizze-classiche" ||
      item.categoryId === "pizze-speciali" ||
      item.categoryId === "pizze-create"
  );

  // Ordina le pizze alfabeticamente
  pizzas.sort((a, b) => a.name.localeCompare(b.name));

  const firstHalfSelect = document.getElementById("firstHalf");
  const secondHalfSelect = document.getElementById("secondHalf");

  pizzas.forEach((pizza) => {
    const option1 = document.createElement("option");
    option1.value = pizza.id;
    option1.textContent = `${pizza.name} (€${pizza.price})`;
    option1.dataset.price = pizza.price;
    option1.dataset.name = pizza.name;
    firstHalfSelect.appendChild(option1);

    const option2 = document.createElement("option");
    option2.value = pizza.id;
    option2.textContent = `${pizza.name} (€${pizza.price})`;
    option2.dataset.price = pizza.price;
    option2.dataset.name = pizza.name;
    secondHalfSelect.appendChild(option2);
  });

  // Stato temporaneo per le modifiche
  let tempModifications = {
    first: { additions: [], removals: [] },
    second: { additions: [], removals: [] },
  };

  // Se stiamo modificando, prepopola i dati
  if (editingItem) {
    firstHalfSelect.value = editingItem.firstHalf.id;
    secondHalfSelect.value = editingItem.secondHalf.id;
    document.getElementById("suggestedPrice").value = editingItem.basePrice;

    // Copia le modifiche esistenti
    tempModifications.first.additions = [
      ...(editingItem.firstHalf.additions || []),
    ];
    tempModifications.first.removals = [
      ...(editingItem.firstHalf.removals || []),
    ];
    tempModifications.second.additions = [
      ...(editingItem.secondHalf.additions || []),
    ];
    tempModifications.second.removals = [
      ...(editingItem.secondHalf.removals || []),
    ];

    // Mostra le opzioni
    document.getElementById("firstHalfOptions").style.display = "block";
    document.getElementById("secondHalfOptions").style.display = "block";

    // Renderizza le modifiche
    renderHalfModifications("first", tempModifications);
    renderHalfModifications("second", tempModifications);
  }

  // Funzione per renderizzare le modifiche
  function renderHalfModifications(half, modifications) {
    const container = document.getElementById(`${half}HalfModifications`);
    container.innerHTML = "";

    if (modifications[half].additions.length > 0) {
      modifications[half].additions.forEach((addition, idx) => {
        const div = document.createElement("div");
        div.className = "flex items-center justify-between mb-1";
        div.innerHTML = `
          <span>+ ${addition.name} (+€${formatPrice(addition.price)})</span>
          <button class="btn btn-sm btn-icon btn-danger" onclick="removeModification('${half}', 'additions', ${idx})">🗑️</button>
        `;
        container.appendChild(div);
      });
    }

    if (modifications[half].removals.length > 0) {
      modifications[half].removals.forEach((removal, idx) => {
        const div = document.createElement("div");
        div.className = "flex items-center justify-between mb-1";
        div.innerHTML = `
          <span>NO ${removal}</span>
          <button class="btn btn-sm btn-icon btn-danger" onclick="removeModification('${half}', 'removals', ${idx})">🗑️</button>
        `;
        container.appendChild(div);
      });
    }
  }

  // Funzioni globali temporanee
  window.tempModifications = tempModifications;
  window.removeModification = function (half, type, idx) {
    tempModifications[half][type].splice(idx, 1);
    renderHalfModifications(half, tempModifications);
    calculateSuggestedPrice();
  };

  // Calcola prezzo consigliato
  const calculateSuggestedPrice = () => {
    const first = firstHalfSelect.options[firstHalfSelect.selectedIndex];
    const second = secondHalfSelect.options[secondHalfSelect.selectedIndex];

    if (first && first.value && second && second.value) {
      const firstPrice = parseFloat(first.dataset.price);
      const secondPrice = parseFloat(second.dataset.price);
      const maxPrice = Math.max(firstPrice, secondPrice);
      let suggestedPrice = maxPrice * 2; // Prezzo familiare della pizza più costosa

      // Aggiungi il costo delle aggiunzioni (prezzo singolo)
      tempModifications.first.additions.forEach((add) => {
        suggestedPrice += add.price;
      });
      tempModifications.second.additions.forEach((add) => {
        suggestedPrice += add.price;
      });

      document.getElementById("suggestedPrice").value =
        suggestedPrice.toFixed(2);

      // Mostra il breakdown del prezzo
      const breakdown = `Pizza più costosa (${
        maxPrice > firstPrice ? second.dataset.name : first.dataset.name
      }) x2: €${(maxPrice * 2).toFixed(2)}`;
      document.getElementById("priceBreakdown").textContent = breakdown;
    }
  };

  // Event listeners
  firstHalfSelect.addEventListener("change", () => {
    if (firstHalfSelect.value) {
      document.getElementById("firstHalfOptions").style.display = "block";
    }
    calculateSuggestedPrice();
  });

  secondHalfSelect.addEventListener("change", () => {
    if (secondHalfSelect.value) {
      document.getElementById("secondHalfOptions").style.display = "block";
    }
    calculateSuggestedPrice();
  });

  // Pulsanti per modificare il prezzo
  document.getElementById("decreasePriceBtn").onclick = () => {
    const priceInput = document.getElementById("suggestedPrice");
    const currentPrice = parseFloat(priceInput.value);
    if (currentPrice > 1) {
      priceInput.value = (currentPrice - 1).toFixed(2);
    }
  };

  document.getElementById("increasePriceBtn").onclick = () => {
    const priceInput = document.getElementById("suggestedPrice");
    const currentPrice = parseFloat(priceInput.value);
    priceInput.value = (currentPrice + 1).toFixed(2);
  };

  // Gestori per aggiungere ingredienti
  document.getElementById("addFirstAddition").onclick = () => {
    showIngredientModalForHalfFamily(
      "addition",
      "first",
      tempModifications,
      () => {
        renderHalfModifications("first", tempModifications);
        calculateSuggestedPrice();
      }
    );
  };

  document.getElementById("addFirstRemoval").onclick = () => {
    showIngredientModalForHalfFamily(
      "removal",
      "first",
      tempModifications,
      () => {
        renderHalfModifications("first", tempModifications);
      }
    );
  };

  document.getElementById("addSecondAddition").onclick = () => {
    showIngredientModalForHalfFamily(
      "addition",
      "second",
      tempModifications,
      () => {
        renderHalfModifications("second", tempModifications);
        calculateSuggestedPrice();
      }
    );
  };

  document.getElementById("addSecondRemoval").onclick = () => {
    showIngredientModalForHalfFamily(
      "removal",
      "second",
      tempModifications,
      () => {
        renderHalfModifications("second", tempModifications);
      }
    );
  };

  // Salva la selezione
  document.getElementById("saveHalfFamilyBtn").onclick = () => {
    const first = firstHalfSelect.options[firstHalfSelect.selectedIndex];
    const second = secondHalfSelect.options[secondHalfSelect.selectedIndex];

    if (!first || !first.value || !second || !second.value) {
      alert("Seleziona entrambe le metà");
      return;
    }

    const price = parseFloat(document.getElementById("suggestedPrice").value);

    let orderObject;
    if (appState.currentOrderType === "table") {
      const table = appState.tables.find(
        (t) => t.id === appState.currentOrderId
      );
      if (!table || table.status === "closed") return;
      orderObject = table.order;
    } else if (appState.currentOrderType === "takeaway") {
      const takeaway = appState.takeaways.find(
        (t) => t.id === appState.currentOrderId
      );
      if (!takeaway || takeaway.status === "closed") return;
      orderObject = takeaway.order;
    } else {
      return;
    }

    if (editingItem && editIndex !== null) {
      // Modifica esistente
      orderObject.items[editIndex] = {
        ...orderObject.items[editIndex],
        name: `1/2 ${first.dataset.name} + 1/2 ${second.dataset.name}`,
        basePrice: price,
        firstHalf: {
          id: first.value,
          name: first.dataset.name,
          additions: tempModifications.first.additions,
          removals: tempModifications.first.removals,
        },
        secondHalf: {
          id: second.value,
          name: second.dataset.name,
          additions: tempModifications.second.additions,
          removals: tempModifications.second.removals,
        },
      };
    } else {
      // Nuovo item
      const orderItem = {
        name: `1/2 ${first.dataset.name} + 1/2 ${second.dataset.name}`,
        basePrice: price,
        quantity: 1,
        discount: 0,
        isComplement: false,
        isHalfFamily: true,
        firstHalf: {
          id: first.value,
          name: first.dataset.name,
          additions: tempModifications.first.additions,
          removals: tempModifications.first.removals,
        },
        secondHalf: {
          id: second.value,
          name: second.dataset.name,
          additions: tempModifications.second.additions,
          removals: tempModifications.second.removals,
        },
        notes: "",
        additions: [],
        removals: [],
      };

      orderObject.items.push(orderItem);
    }

    saveData();
    renderOrderDetails();

    // Pulisci le variabili temporanee
    delete window.tempModifications;
    delete window.removeModification;

    // Chiudi il modal
    modal.classList.remove("active");
  };

  // Calcola il prezzo iniziale se stiamo modificando
  if (editingItem) {
    calculateSuggestedPrice();
  }

  modal.classList.add("active");
}

// Funzione helper per mostrare il modal ingredienti per mezze familiari
function showIngredientModalForHalfFamily(type, half, modifications, callback) {
  // Mostra il modal ingredienti standard
  const isAddition = type === "addition";

  document.getElementById("ingredientModalTitle").textContent = isAddition
    ? `Aggiungi Ingrediente - ${half === "first" ? "Prima" : "Seconda"} metà`
    : `Rimuovi Ingrediente - ${half === "first" ? "Prima" : "Seconda"} metà`;

  document.getElementById("additionPriceGroup").style.display = isAddition
    ? "block"
    : "none";

  // Prepara il modal come nella funzione showIngredientModal originale
  if (!isAddition) {
    const ingredientNameLabel = document.querySelector(
      "label[for='ingredientName']"
    );
    if (ingredientNameLabel) {
      ingredientNameLabel.textContent = "Nome Ingrediente da Rimuovere";
    }

    const parentNode = document.querySelector(
      "label[for='ingredientName']"
    ).parentNode;
    const inputElement = document.createElement("input");
    inputElement.id = "ingredientName";
    inputElement.className = "form-control";
    inputElement.type = "text";
    inputElement.placeholder = "Nome ingrediente da rimuovere";

    const oldElement =
      document.getElementById("ingredientSelect") ||
      document.getElementById("ingredientName");
    if (oldElement) {
      parentNode.replaceChild(inputElement, oldElement);
    }

    let datalist = document.getElementById("ingredientsList");
    if (!datalist) {
      datalist = document.createElement("datalist");
      datalist.id = "ingredientsList";
      document.body.appendChild(datalist);
    } else {
      datalist.innerHTML = "";
    }

    appState.ingredients.forEach((ingredient) => {
      const option = document.createElement("option");
      option.value = ingredient.name;
      datalist.appendChild(option);
    });

    document
      .getElementById("ingredientName")
      .setAttribute("list", "ingredientsList");
    document.getElementById("ingredientName").value = "";
  } else {
    const ingredientNameLabel = document.querySelector(
      "label[for='ingredientName']"
    );
    if (ingredientNameLabel) {
      ingredientNameLabel.textContent = "Nome Ingrediente";
    }

    const parentNode = document.querySelector(
      "label[for='ingredientName']"
    ).parentNode;
    const select = document.createElement("select");
    select.id = "ingredientSelect";
    select.className = "form-control";

    appState.ingredients.forEach((ingredient) => {
      const option = document.createElement("option");
      option.value = ingredient.id;
      option.textContent = `${ingredient.name} (+€${formatPrice(
        ingredient.price
      )})`;
      option.dataset.price = ingredient.price;
      select.appendChild(option);
    });

    const oldElement =
      document.getElementById("ingredientSelect") ||
      document.getElementById("ingredientName");
    if (oldElement) {
      parentNode.replaceChild(select, oldElement);
    }

    if (appState.ingredients.length > 0) {
      document.getElementById("ingredientPrice").value =
        appState.ingredients[0].price;
    }

    select.addEventListener("change", function () {
      const selectedOption = this.options[this.selectedIndex];
      const price = selectedOption.dataset.price;
      document.getElementById("ingredientPrice").value = price;
    });
  }

  // Override del pulsante salva
  const saveBtn = document.getElementById("saveIngredientBtn");
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  newSaveBtn.onclick = () => {
    if (type === "addition") {
      const selectElement = document.getElementById("ingredientSelect");
      if (!selectElement) return;

      const selectedIngredientId = selectElement.value;
      const selectedIngredient = appState.ingredients.find(
        (i) => i.id === selectedIngredientId
      );
      if (!selectedIngredient) return;

      const existingAddition = modifications[half].additions.find(
        (a) => a.id === selectedIngredient.id
      );
      if (existingAddition) {
        alert("Questo ingrediente è già stato aggiunto.");
        return;
      }

      modifications[half].additions.push({
        id: selectedIngredient.id,
        name: selectedIngredient.name,
        price:
          parseFloat(document.getElementById("ingredientPrice").value) ||
          selectedIngredient.price,
      });
    } else {
      const ingredientName = document
        .getElementById("ingredientName")
        .value.trim();
      if (ingredientName === "") {
        alert("Inserisci un nome per l'ingrediente da rimuovere.");
        return;
      }

      if (modifications[half].removals.includes(ingredientName)) {
        alert("Questo ingrediente è già stato rimosso.");
        return;
      }

      modifications[half].removals.push(ingredientName);
    }

    document.getElementById("ingredientModal").classList.remove("active");
    document.getElementById("ingredientModal").classList.remove("nested");

    if (callback) callback();
  };

  document.getElementById("halfFamilyModal").classList.add("parent-modal");
  document.getElementById("ingredientModal").classList.add("nested");
  document.getElementById("ingredientModal").classList.add("active");
}

function removeItemFromOrder(index) {
  let orderObject;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table || table.status === "closed") return;
    orderObject = table.order;
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway || takeaway.status === "closed") return;
    orderObject = takeaway.order;
  } else {
    return;
  }

  // Rimuovi l'item dall'ordine
  orderObject.items.splice(index, 1);
  saveData();

  // Emetti evento WebSocket
  emitOrderUpdate();

  // Aggiorna la visualizzazione dell'ordine
  renderOrderDetails();
}

function updateOrderTotals() {
  let orderObject;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table) return;
    orderObject = table.order;
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway) return;
    orderObject = takeaway.order;
  } else {
    return;
  }

  // Calcola il subtotale
  let subtotal = 0;

  // Aggiungi il costo dei coperti se è un tavolo
  if (appState.currentOrderType === "table" && orderObject.covers > 0) {
    subtotal += orderObject.covers * appState.settings.coverCharge;
  }

  // Aggiungi il costo di tutti gli items
  if (orderObject.items) {
    orderObject.items.forEach((item) => {
      // Calcola il prezzo base
      let itemPrice = item.basePrice;

      // Applica il fattore moltiplicativo per pizze familiari
      if (item.isFamily) {
        itemPrice *= 2;
      }
      // Gestione speciale per le mezze familiari
      if (item.isHalfFamily) {
        // Il prezzo base è già quello impostato dall'utente (già include il calcolo familiare)
        // Non moltiplicare per 2 perché è già incluso nel basePrice

        // Le aggiunzioni per le mezze familiari hanno prezzo singolo
        if (item.firstHalf && item.firstHalf.additions) {
          item.firstHalf.additions.forEach((addition) => {
            itemPrice += addition.price; // Prezzo singolo
          });
        }
        if (item.secondHalf && item.secondHalf.additions) {
          item.secondHalf.additions.forEach((addition) => {
            itemPrice += addition.price; // Prezzo singolo
          });
        }
      }
      // Aggiungi costi per aggiunzioni
      if (item.additions && item.additions.length > 0) {
        item.additions.forEach((addition) => {
          // Per le pizze familiari, anche le aggiunte costano il doppio
          let additionPrice = addition.price;
          if (item.isFamily) {
            additionPrice *= 2;
          }
          itemPrice += additionPrice;
        });
      }

      // Applica sconto se presente
      let finalPrice = itemPrice;
      if (item.discount > 0) {
        finalPrice = itemPrice * (1 - item.discount / 100);
      }

      // Se è un omaggio, il prezzo è 0
      if (item.isComplement) {
        finalPrice = 0;
      }

      // Moltiplica per la quantità
      subtotal += finalPrice * item.quantity;
    });
  }

  // Calcola l'importo dello sconto
  let discountAmount = 0;
  if (orderObject.discount > 0) {
    if (orderObject.discountType === "percentage") {
      discountAmount = subtotal * (orderObject.discount / 100);
    } else if (orderObject.discountType === "fixed") {
      discountAmount = Math.min(orderObject.discount, subtotal); // Lo sconto non può essere maggiore del subtotale
    }
  }

  // Calcola il totale finale
  const total = subtotal - discountAmount;

  // Aggiorna l'interfaccia
  document.getElementById("subtotal").textContent = `€${formatPrice(subtotal)}`;

  if (discountAmount > 0) {
    document.getElementById("discountsRow").classList.remove("hidden");
    document.getElementById("discounts").textContent = `-€${formatPrice(
      discountAmount
    )}`;
  } else {
    document.getElementById("discountsRow").classList.add("hidden");
  }

  document.getElementById("total").textContent = `€${formatPrice(total)}`;
}

// Funzioni per i modal
function setupModalEventListeners() {
  // Chiusura modals
  document
    .querySelectorAll('.modal-close, [data-dismiss="modal"]')
    .forEach((button) => {
      button.addEventListener("click", (e) => {
        // Trova il modal padre più vicino
        const modal = e.target.closest(".modal");
        if (modal) {
          modal.classList.remove("active");

          // Se è un modal annidato, rimuovi anche la classe nested
          if (modal.classList.contains("nested")) {
            modal.classList.remove("nested");
            // Rimuovi anche la classe parent-modal dai modal genitori
            document
              .querySelectorAll(".parent-modal")
              .forEach((parentModal) => {
                parentModal.classList.remove("parent-modal");
              });
          }
        }
      });
    });

  // Modal tavolo
  document.getElementById("saveTableBtn").addEventListener("click", saveTable);

  // Modal prodotto menu
  document
    .getElementById("saveItemBtn")
    .addEventListener("click", saveMenuItem);

  // Modal categoria
  document
    .getElementById("saveCategoryBtn")
    .addEventListener("click", saveCategory);

  // Modal prodotto ordine
  document
    .getElementById("saveOrderItemBtn")
    .addEventListener("click", saveOrderItem);

  // Modal sconto
  document
    .getElementById("saveDiscountBtn")
    .addEventListener("click", saveDiscount);

  // Modal conferma chiusura
  document
    .getElementById("confirmCloseBtn")
    .addEventListener("click", closeOrder);

  // Modal ingrediente
  document
    .getElementById("saveIngredientBtn")
    .addEventListener("click", saveIngredient);
  // Modal coperti
  document
    .getElementById("saveCoversBtn")
    .addEventListener("click", saveCovers);

  // Controlli + e - per il modal coperti
  document.getElementById("increaseCoversBtn").addEventListener("click", () => {
    const input = document.getElementById("coversCount");
    input.value = parseInt(input.value) + 1;
  });

  document.getElementById("decreaseCoversBtn").addEventListener("click", () => {
    const input = document.getElementById("coversCount");
    const currentValue = parseInt(input.value);
    if (currentValue > 0) {
      input.value = currentValue - 1;
    }
  });
  // Modal impostazioni
  document
    .getElementById("saveSettingsBtn")
    .addEventListener("click", saveSettings);
  // Chiusura dei modal quando si fa click all'esterno
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", function (e) {
      // Chiudi il modal solo se il click è sul backdrop (non sul contenuto)
      if (e.target === this) {
        this.classList.remove("active");
        // Se è un modal annidato, rimuovi anche la classe nested
        if (this.classList.contains("nested")) {
          this.classList.remove("nested");
          // Rimuovi anche la classe parent-modal dai modal genitori
          document.querySelectorAll(".parent-modal").forEach((parentModal) => {
            parentModal.classList.remove("parent-modal");
          });
        }
      }
    });
  });
  function removeModalListeners() {
    document
      .getElementById("addAdditionBtn")
      .removeEventListener("click", showIngredientModal);
    document
      .getElementById("addRemovalBtn")
      .removeEventListener("click", showIngredientModal);
  }

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("hidden", removeModalListeners);
  });
}

function showEditItemModal(item) {
  document.getElementById("menuItemModalTitle").textContent =
    "Modifica Prodotto";
  document.getElementById("itemName").value = item.name;
  document.getElementById("itemPrice").value = item.price;
  document.getElementById("itemDescription").value = item.description || "";

  // Popola le opzioni per le categorie
  const categorySelect = document.getElementById("itemCategory");
  categorySelect.innerHTML = "";

  appState.menu.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    categorySelect.appendChild(option);
  });

  categorySelect.value = item.categoryId;

  // Salva l'ID dell'item da modificare come attributo del pulsante salva
  document.getElementById("saveItemBtn").setAttribute("data-id", item.id);

  // Mostra il modal
  document.getElementById("menuItemModal").classList.add("active");
}

function showAddItemModal() {
  document.getElementById("menuItemModalTitle").textContent = "Nuovo Prodotto";
  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  document.getElementById("itemDescription").value = "";

  // Popola le opzioni per le categorie
  const categorySelect = document.getElementById("itemCategory");
  categorySelect.innerHTML = "";

  appState.menu.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    categorySelect.appendChild(option);
  });

  // Seleziona la prima categoria per default
  if (appState.menu.categories.length > 0) {
    categorySelect.value = appState.menu.categories[0].id;
  }

  // Rimuovi l'ID dell'item da modificare
  document.getElementById("saveItemBtn").removeAttribute("data-id");

  // Mostra il modal
  document.getElementById("menuItemModal").classList.add("active");
}

function showAddTableModal() {
  document.getElementById("tableModalTitle").textContent = "Nuovo Tavolo";
  document.getElementById("tablePrefix").value = "";
  document.getElementById("tableNumber").value = "";
  document.getElementById("tableCustomName").value = "";
  document.getElementById("tableStatus").value = "new";

  // Rimuovi l'ID del tavolo da modificare
  document.getElementById("saveTableBtn").removeAttribute("data-id");

  // Mostra il modal
  document.getElementById("tableModal").classList.add("active");
}

async function showAddTakeawayModal() {
  // Trova il numero progressivo più alto
  let maxNumber = 0;
  appState.takeaways.forEach((takeaway) => {
    if (takeaway.number > maxNumber) {
      maxNumber = takeaway.number;
    }
  });

  // Crea un nuovo asporto
  const newTakeaway = {
    id: generateId(),
    number: maxNumber + 1,
    status: "new",
    order: {
      items: [],
      discount: 0,
      discountType: "percentage",
      discountReason: "",
      customerName: "",
      customerPhone: "",
      createdAt: new Date().toISOString(),
    },
  };

  appState.takeaways.push(newTakeaway);
  saveData();
  renderTakeaways();

  // NUOVO: Emetti evento per sincronizzare
  if (api && api.socket && api.socket.connected) {
    api.socket.emit("nuovo_tavolo_asporto", {
      type: "takeaway",
      data: newTakeaway,
    });
    console.log("📡 Nuovo asporto emesso:", newTakeaway);
  }
}

function showEditOrderItemModal(index) {
  let orderObject;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table || table.status === "closed") return;
    orderObject = table.order;
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway || takeaway.status === "closed") return;
    orderObject = takeaway.order;
  } else {
    return;
  }

  const item = orderObject.items[index];
  if (!item) return;

  document.getElementById(
    "orderItemModalTitle"
  ).textContent = `Modifica ${item.name}`;
  document.getElementById("orderItemQuantity").value = item.quantity;
  document.getElementById("orderItemDiscount").value = item.discount;
  document.getElementById("orderItemComplement").checked = item.isComplement;
  document.getElementById("orderItemNotes").value = item.notes || "";

  // Trova il prodotto corrispondente nel menu per determinare la categoria
  const menuItem = appState.menu.items.find(
    (menuItem) => menuItem.name === item.name
  );

  // Determina se è una pizza o schiacciata in base alla categoria o al nome
  const isPizzaCategory =
    menuItem &&
    (menuItem.categoryId === "pizze-classiche" ||
      menuItem.categoryId === "pizze-speciali" ||
      menuItem.categoryId === "pizze-create" ||
      menuItem.categoryId === "schiacciate" ||
      item.name.toLowerCase().includes("pizza") ||
      item.name.toLowerCase().includes("margherita") ||
      item.name.toLowerCase().includes("diavola") ||
      item.name.toLowerCase().includes("romana") ||
      item.name.toLowerCase().includes("calzone"));

  // Gestione opzione pizza familiare
  if (isPizzaCategory) {
    document.getElementById("familyOptionContainer").classList.remove("hidden");
    document.getElementById("orderItemFamily").checked = item.isFamily || false;

    // Mostra anche le opzioni per gli ingredienti delle pizze
    document.getElementById("pizzaOptionsContainer").classList.remove("hidden");

    // Popola contenitori aggiunzioni e rimozioni
    const additionsContainer = document.getElementById("additionsContainer");
    const removalsContainer = document.getElementById("removalsContainer");

    additionsContainer.innerHTML = "";
    removalsContainer.innerHTML = "";

    // Popola le aggiunzioni esistenti
    if (item.additions && item.additions.length > 0) {
      item.additions.forEach((addition, i) => {
        const additionRow = document.createElement("div");
        additionRow.className = "flex items-center justify-between";
        additionRow.innerHTML = `
                    <span>${addition.name} (+€${formatPrice(
          addition.price
        )})</span>
                    <button class="btn btn-sm btn-icon btn-danger remove-addition" data-index="${i}">🗑️</button>
                `;
        additionsContainer.appendChild(additionRow);
      });
    }

    // Popola le rimozioni esistenti
    if (item.removals && item.removals.length > 0) {
      item.removals.forEach((removal, i) => {
        const removalRow = document.createElement("div");
        removalRow.className = "flex items-center justify-between";
        removalRow.innerHTML = `
                    <span>${removal}</span>
                    <button class="btn btn-sm btn-icon btn-danger remove-removal" data-index="${i}">🗑️</button>
                `;
        removalsContainer.appendChild(removalRow);
      });
    }

    // Event listener per rimuovere aggiunzioni
    document.querySelectorAll(".remove-addition").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const removalIndex = parseInt(button.getAttribute("data-index"));
        item.additions.splice(removalIndex, 1);
        showEditOrderItemModal(index); // Refresh modal
      });
    });

    // Event listener per rimuovere rimozioni
    document.querySelectorAll(".remove-removal").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const removalIndex = parseInt(button.getAttribute("data-index"));
        item.removals.splice(removalIndex, 1);
        showEditOrderItemModal(index); // Refresh modal
      });
    });

    // Event listener per aggiungere ingredienti
    const addAdditionBtn = document.getElementById("addAdditionBtn");
    if (addAdditionBtn) {
      // Rimuovi eventuali listener precedenti per evitare duplicazioni
      const newAddAdditionBtn = addAdditionBtn.cloneNode(true);
      addAdditionBtn.parentNode.replaceChild(newAddAdditionBtn, addAdditionBtn);
      newAddAdditionBtn.addEventListener("click", () => {
        showIngredientModal("addition", index);
      });
    }

    // Event listener per rimuovere ingredienti
    const addRemovalBtn = document.getElementById("addRemovalBtn");
    if (addRemovalBtn) {
      // Rimuovi eventuali listener precedenti per evitare duplicazioni
      const newAddRemovalBtn = addRemovalBtn.cloneNode(true);
      addRemovalBtn.parentNode.replaceChild(newAddRemovalBtn, addRemovalBtn);
      newAddRemovalBtn.addEventListener("click", () => {
        showIngredientModal("removal", index);
      });
    }
  } else {
    document.getElementById("familyOptionContainer").classList.add("hidden");
    document.getElementById("pizzaOptionsContainer").classList.add("hidden");
  }
  // Gestione speciale per le mezze familiari
  if (item.isHalfFamily) {
    // Nascondi l'opzione famiglia normale
    document.getElementById("familyOptionContainer").classList.add("hidden");

    // Mostra le opzioni per gli ingredienti
    document.getElementById("pizzaOptionsContainer").classList.remove("hidden");

    // Modifica il contenuto per mostrare le due metà
    const additionsContainer = document.getElementById("additionsContainer");
    const removalsContainer = document.getElementById("removalsContainer");

    additionsContainer.innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong>Prima metà (${item.firstHalf.name}):</strong>
      <div id="firstHalfAdditions"></div>
      <button type="button" class="btn btn-sm btn-outline" id="addFirstHalfAddition">+ Aggiungi</button>
    </div>
    <div>
      <strong>Seconda metà (${item.secondHalf.name}):</strong>
      <div id="secondHalfAdditions"></div>
      <button type="button" class="btn btn-sm btn-outline" id="addSecondHalfAddition">+ Aggiungi</button>
    </div>
  `;

    removalsContainer.innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong>Prima metà (${item.firstHalf.name}):</strong>
      <div id="firstHalfRemovals"></div>
      <button type="button" class="btn btn-sm btn-outline" id="removeFirstHalfRemoval">- Rimuovi</button>
    </div>
    <div>
      <strong>Seconda metà (${item.secondHalf.name}):</strong>
      <div id="secondHalfRemovals"></div>
      <button type="button" class="btn btn-sm btn-outline" id="removeSecondHalfRemoval">- Rimuovi</button>
    </div>
  `;

    // Popola le aggiunzioni/rimozioni esistenti
    if (item.firstHalf.additions) {
      item.firstHalf.additions.forEach((addition, i) => {
        const additionEl = document.createElement("div");
        additionEl.className = "flex items-center justify-between mb-1";
        additionEl.innerHTML = `
        <span>${addition.name} (+€${formatPrice(addition.price)})</span>
        <button class="btn btn-sm btn-icon btn-danger" data-half="first" data-type="additions" data-index="${i}">🗑️</button>
      `;
        document.getElementById("firstHalfAdditions").appendChild(additionEl);
      });
    }

    if (item.secondHalf.additions) {
      item.secondHalf.additions.forEach((addition, i) => {
        const additionEl = document.createElement("div");
        additionEl.className = "flex items-center justify-between mb-1";
        additionEl.innerHTML = `
        <span>${addition.name} (+€${formatPrice(addition.price)})</span>
        <button class="btn btn-sm btn-icon btn-danger" data-half="second" data-type="additions" data-index="${i}">🗑️</button>
      `;
        document.getElementById("secondHalfAdditions").appendChild(additionEl);
      });
    }

    if (item.firstHalf.removals) {
      item.firstHalf.removals.forEach((removal, i) => {
        const removalEl = document.createElement("div");
        removalEl.className = "flex items-center justify-between mb-1";
        removalEl.innerHTML = `
        <span>${removal}</span>
        <button class="btn btn-sm btn-icon btn-danger" data-half="first" data-type="removals" data-index="${i}">🗑️</button>
      `;
        document.getElementById("firstHalfRemovals").appendChild(removalEl);
      });
    }

    if (item.secondHalf.removals) {
      item.secondHalf.removals.forEach((removal, i) => {
        const removalEl = document.createElement("div");
        removalEl.className = "flex items-center justify-between mb-1";
        removalEl.innerHTML = `
        <span>${removal}</span>
        <button class="btn btn-sm btn-icon btn-danger" data-half="second" data-type="removals" data-index="${i}">🗑️</button>
      `;
        document.getElementById("secondHalfRemovals").appendChild(removalEl);
      });
    }

    // Event listeners per i pulsanti di rimozione
    setTimeout(() => {
      document
        .querySelectorAll(
          "#additionsContainer .btn-danger, #removalsContainer .btn-danger"
        )
        .forEach((button) => {
          button.addEventListener("click", (e) => {
            e.preventDefault();
            const half = button.getAttribute("data-half");
            const type = button.getAttribute("data-type");
            const idx = parseInt(button.getAttribute("data-index"));

            if (half === "first") {
              item.firstHalf[type].splice(idx, 1);
            } else {
              item.secondHalf[type].splice(idx, 1);
            }

            saveData();
            showEditOrderItemModal(index);
          });
        });

      // Event listeners per aggiungere ingredienti
      document
        .getElementById("addFirstHalfAddition")
        ?.addEventListener("click", () => {
          window.currentHalfEdit = {
            index: index,
            half: "first",
            type: "addition",
          };
          showIngredientModal("addition", index);
        });

      document
        .getElementById("addSecondHalfAddition")
        ?.addEventListener("click", () => {
          window.currentHalfEdit = {
            index: index,
            half: "second",
            type: "addition",
          };
          showIngredientModal("addition", index);
        });

      document
        .getElementById("removeFirstHalfRemoval")
        ?.addEventListener("click", () => {
          window.currentHalfEdit = {
            index: index,
            half: "first",
            type: "removal",
          };
          showIngredientModal("removal", index);
        });

      document
        .getElementById("removeSecondHalfRemoval")
        ?.addEventListener("click", () => {
          window.currentHalfEdit = {
            index: index,
            half: "second",
            type: "removal",
          };
          showIngredientModal("removal", index);
        });
    }, 100);

    // Salva l'indice per la modifica
    document
      .getElementById("saveOrderItemBtn")
      .setAttribute("data-index", index);

    // Aggiungi listener per il pulsante di modifica completa
    const editFullBtn = document.createElement("button");
    editFullBtn.className = "btn btn-outline mb-2";
    editFullBtn.textContent = "Modifica selezione pizze";
    editFullBtn.style.width = "100%";
    editFullBtn.onclick = () => {
      document.getElementById("orderItemModal").classList.remove("active");
      showHalfFamilyModal(index);
    };

    // Inserisci il pulsante all'inizio del modal body
    const modalBody = document.querySelector("#orderItemModal .modal-body");
    modalBody.insertBefore(editFullBtn, modalBody.firstChild);

    // NON fare return qui, lascia che il resto della funzione continui
  }

  // Salva l'indice dell'item da modificare come attributo del pulsante salva
  document.getElementById("saveOrderItemBtn").setAttribute("data-index", index);

  // Mostra il modal
  document.getElementById("orderItemModal").classList.add("active");
}

function showIngredientModal(type, orderItemIndex) {
  // Prima di mostrare il modal ingredienti, applica la classe parent-modal al modal ordine
  document.getElementById("orderItemModal").classList.add("parent-modal");

  const isAddition = type === "addition";

  // Imposta il titolo del modal
  document.getElementById("ingredientModalTitle").textContent = isAddition
    ? "Aggiungi Ingrediente"
    : "Rimuovi Ingrediente";

  // Mostra/nascondi il campo prezzo in base al tipo
  document.getElementById("additionPriceGroup").style.display = isAddition
    ? "block"
    : "none";

  // Reset dei campi
  if (!isAddition) {
    // Per le rimozioni, usiamo un input text normale con datalist
    const ingredientNameLabel = document.querySelector(
      "label[for='ingredientName']"
    );
    if (ingredientNameLabel) {
      ingredientNameLabel.textContent = "Nome Ingrediente da Rimuovere";
    }

    // Controlla se abbiamo già sostituito con un select
    const parentNode = document.querySelector(
      "label[for='ingredientName']"
    ).parentNode;

    // Crea un input text per la rimozione
    const inputElement = document.createElement("input");
    inputElement.id = "ingredientName";
    inputElement.className = "form-control";
    inputElement.type = "text";
    inputElement.placeholder = "Nome ingrediente da rimuovere";

    // Sostituisci l'elemento esistente
    const oldElement =
      document.getElementById("ingredientSelect") ||
      document.getElementById("ingredientName");
    if (oldElement) {
      parentNode.replaceChild(inputElement, oldElement);
    }

    // Crea un datalist per suggerimenti se non esiste
    let datalist = document.getElementById("ingredientsList");
    if (!datalist) {
      datalist = document.createElement("datalist");
      datalist.id = "ingredientsList";
      document.body.appendChild(datalist);
    } else {
      datalist.innerHTML = "";
    }

    // Usa direttamente gli ingredienti dall'array appState per avere l'ordine corretto
    appState.ingredients.forEach((ingredient) => {
      const option = document.createElement("option");
      option.value = ingredient.name;
      datalist.appendChild(option);
    });

    document
      .getElementById("ingredientName")
      .setAttribute("list", "ingredientsList");
    document.getElementById("ingredientName").value = "";
  } else {
    // Per le aggiunzioni, creiamo un select con gli ingredienti disponibili
    const ingredientNameLabel = document.querySelector(
      "label[for='ingredientName']"
    );
    if (ingredientNameLabel) {
      ingredientNameLabel.textContent = "Nome Ingrediente";
    }

    const parentNode = document.querySelector(
      "label[for='ingredientName']"
    ).parentNode;

    const select = document.createElement("select");
    select.id = "ingredientSelect";
    select.className = "form-control";

    // Aggiungi le opzioni al select
    appState.ingredients.forEach((ingredient) => {
      const option = document.createElement("option");
      option.value = ingredient.id;
      option.textContent = `${ingredient.name} (+€${formatPrice(
        ingredient.price
      )})`;
      option.dataset.price = ingredient.price;
      select.appendChild(option);
    });

    // Sostituisci l'elemento esistente
    const oldElement =
      document.getElementById("ingredientSelect") ||
      document.getElementById("ingredientName");
    if (oldElement) {
      parentNode.replaceChild(select, oldElement);
    }

    // Imposta il prezzo iniziale
    if (appState.ingredients.length > 0) {
      document.getElementById("ingredientPrice").value =
        appState.ingredients[0].price;
    }

    // Event listener per aggiornare il prezzo quando si seleziona un ingrediente
    select.addEventListener("change", function () {
      const selectedOption = this.options[this.selectedIndex];
      const price = selectedOption.dataset.price;
      document.getElementById("ingredientPrice").value = price;
    });
  }

  // Salva l'indice dell'item e il tipo come attributi del pulsante salva
  document
    .getElementById("saveIngredientBtn")
    .setAttribute("data-index", orderItemIndex);
  document.getElementById("saveIngredientBtn").setAttribute("data-type", type);

  // Aggiungi classe nested al modal degli ingredienti
  const ingredientModal = document.getElementById("ingredientModal");
  ingredientModal.classList.add("nested");

  // Mostra il modal
  ingredientModal.classList.add("active");
}

/// Modifica questa funzione sostituendola completamente
function saveIngredient() {
  const orderItemIndex = parseInt(
    document.getElementById("saveIngredientBtn").getAttribute("data-index")
  );
  const type = document
    .getElementById("saveIngredientBtn")
    .getAttribute("data-type");

  let orderObject;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table || table.status === "closed") return;
    orderObject = table.order;
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway || takeaway.status === "closed") return;
    orderObject = takeaway.order;
  } else {
    return;
  }

  const item = orderObject.items[orderItemIndex];
  if (!item) return;

  // Gestione speciale per le mezze familiari
  if (item.isHalfFamily && window.currentHalfEdit) {
    const { half, type } = window.currentHalfEdit;
    const targetHalf = half === "first" ? item.firstHalf : item.secondHalf;

    if (type === "addition") {
      const selectElement = document.getElementById("ingredientSelect");
      if (!selectElement) return;

      const selectedIngredientId = selectElement.value;
      const selectedIngredient = appState.ingredients.find(
        (i) => i.id === selectedIngredientId
      );

      if (!selectedIngredient) return;

      if (!targetHalf.additions) {
        targetHalf.additions = [];
      }

      const existingAddition = targetHalf.additions.find(
        (a) => a.id === selectedIngredient.id
      );
      if (existingAddition) {
        alert("Questo ingrediente è già stato aggiunto a questa metà.");
        return;
      }

      targetHalf.additions.push({
        id: selectedIngredient.id,
        name: selectedIngredient.name,
        price:
          parseFloat(document.getElementById("ingredientPrice").value) ||
          selectedIngredient.price,
      });
    } else if (type === "removal") {
      const ingredientName = document
        .getElementById("ingredientName")
        .value.trim();

      if (ingredientName === "") {
        alert("Inserisci un nome per l'ingrediente da rimuovere.");
        return;
      }

      if (!targetHalf.removals) {
        targetHalf.removals = [];
      }

      if (targetHalf.removals.includes(ingredientName)) {
        alert("Questo ingrediente è già stato rimosso da questa metà.");
        return;
      }

      targetHalf.removals.push(ingredientName);
    }

    saveData();
    document.getElementById("ingredientModal").classList.remove("active");
    document.getElementById("ingredientModal").classList.remove("nested");
    document.getElementById("orderItemModal").classList.remove("parent-modal");

    // Pulisci la variabile temporanea
    window.currentHalfEdit = null;

    showEditOrderItemModal(orderItemIndex);
    return;
  }

  if (type === "addition") {
    // Per le aggiunzioni, prendiamo l'ingrediente selezionato dal dropdown
    const selectElement = document.getElementById("ingredientSelect");
    if (!selectElement) return;

    const selectedIngredientId = selectElement.value;
    const selectedIngredient = appState.ingredients.find(
      (i) => i.id === selectedIngredientId
    );

    if (!selectedIngredient) return;

    // Inizializza l'array delle aggiunzioni se non esiste
    if (!item.additions) {
      item.additions = [];
    }

    // Verifica se l'ingrediente è già presente tra le aggiunzioni
    const existingAddition = item.additions.find(
      (a) => a.id === selectedIngredient.id
    );
    if (existingAddition) {
      alert("Questo ingrediente è già stato aggiunto.");
      return;
    }

    // Aggiungi l'ingrediente alle aggiunzioni
    item.additions.push({
      id: selectedIngredient.id,
      name: selectedIngredient.name,
      price:
        parseFloat(document.getElementById("ingredientPrice").value) ||
        selectedIngredient.price,
    });
  } else if (type === "removal") {
    // Per le rimozioni, prendiamo il valore dal campo di testo
    const ingredientName = document
      .getElementById("ingredientName")
      .value.trim();

    if (ingredientName === "") {
      alert("Inserisci un nome per l'ingrediente da rimuovere.");
      return;
    }

    // Inizializza l'array delle rimozioni se non esiste
    if (!item.removals) {
      item.removals = [];
    }

    // Verifica se l'ingrediente è già presente tra le rimozioni
    if (item.removals.includes(ingredientName)) {
      alert("Questo ingrediente è già stato rimosso.");
      return;
    }

    // Aggiungi l'ingrediente alle rimozioni
    item.removals.push(ingredientName);
  }

  saveData();

  // Chiudi il modal degli ingredienti
  const ingredientModal = document.getElementById("ingredientModal");
  ingredientModal.classList.remove("active");
  ingredientModal.classList.remove("nested");

  // Rimuovi la classe parent-modal dal modal ordine
  document.getElementById("orderItemModal").classList.remove("parent-modal");

  // Riapri quello di modifica dell'item
  showEditOrderItemModal(orderItemIndex);
}

function showDiscountModal() {
  let orderObject;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table || table.status === "closed") return;
    orderObject = table.order;
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway || takeaway.status === "closed") return;
    orderObject = takeaway.order;
  } else {
    return;
  }

  // Imposta il tipo di sconto
  document.getElementById("discountType").value =
    orderObject.discountType || "percentage";

  // Imposta il valore dello sconto
  document.getElementById("discountValue").value = orderObject.discount || 0;

  // Imposta la motivazione dello sconto
  document.getElementById("discountReason").value =
    orderObject.discountReason || "";

  // Mostra il modal
  document.getElementById("discountModal").classList.add("active");
}

function showConfirmCloseModal() {
  document.getElementById("confirmCloseModal").classList.add("active");
}

// Funzioni per salvare i dati dai modals
function saveTable() {
  const prefix = document.getElementById("tablePrefix").value.trim();
  const number = parseInt(document.getElementById("tableNumber").value);
  const customName = document.getElementById("tableCustomName").value.trim();
  const status = document.getElementById("tableStatus").value;

  // Verifica che sia stato inserito almeno un numero o un nome personalizzato
  if ((isNaN(number) || number <= 0) && customName === "") {
    alert(
      "Inserisci un numero valido per il tavolo oppure un nome personalizzato."
    );
    return;
  }

  // Controlla se stiamo modificando un tavolo esistente
  const tableId = document
    .getElementById("saveTableBtn")
    .getAttribute("data-id");

  let newTable = null; // Dichiarato fuori dall'if/else

  if (tableId) {
    // Stiamo modificando un tavolo esistente
    const tableIndex = appState.tables.findIndex((t) => t.id === tableId);
    if (tableIndex !== -1) {
      appState.tables[tableIndex].prefix = prefix;
      appState.tables[tableIndex].number = number;
      appState.tables[tableIndex].customName = customName;
      appState.tables[tableIndex].status = status;
    }
  } else {
    // Stiamo creando un nuovo tavolo
    newTable = {
      id: generateId(),
      prefix: prefix,
      number: number,
      customName: customName,
      status: status,
      order: {
        items: [],
        discount: 0,
        discountType: "percentage",
        discountReason: "",
        covers: 0,
        createdAt: new Date().toISOString(),
      },
    };

    appState.tables.push(newTable);
  }

  saveData();
  renderTables();

  // Emetti evento per sincronizzare il nuovo tavolo
  if (!tableId && newTable && api && api.socket && api.socket.connected) {
    api.socket.emit("nuovo_tavolo_asporto", {
      type: "table",
      data: newTable,
    });
    console.log("📡 Nuovo tavolo emesso:", newTable);
  }

  // Chiudi il modal
  document.getElementById("tableModal").classList.remove("active");
}

function saveMenuItem() {
  const name = document.getElementById("itemName").value.trim();
  const price = parseFloat(document.getElementById("itemPrice").value);
  const categoryId = document.getElementById("itemCategory").value;
  const description = document.getElementById("itemDescription").value.trim();

  if (name === "") {
    alert("Inserisci un nome per il prodotto.");
    return;
  }

  if (isNaN(price) || price < 0) {
    alert("Inserisci un prezzo valido per il prodotto.");
    return;
  }

  // Controlla se stiamo modificando un prodotto esistente
  const itemId = document.getElementById("saveItemBtn").getAttribute("data-id");

  if (itemId) {
    // Stiamo modificando un prodotto esistente
    const itemIndex = appState.menu.items.findIndex((i) => i.id === itemId);
    if (itemIndex !== -1) {
      appState.menu.items[itemIndex].name = name;
      appState.menu.items[itemIndex].price = price;
      appState.menu.items[itemIndex].categoryId = categoryId;
      appState.menu.items[itemIndex].description = description;
    }
  } else {
    // Stiamo creando un nuovo prodotto
    const newItem = {
      id: generateId(),
      name: name,
      price: price,
      categoryId: categoryId,
      description: description,
    };

    appState.menu.items.push(newItem);
  }

  // Salva i dati (chiamata una sola volta)
  saveData();

  // Se siamo nell'editor del menu, aggiorniamo la visualizzazione
  if (document.getElementById("menu-editor").classList.contains("active")) {
    // Trova la categoria attiva
    const activeCategory = document
      .querySelector("#editorCategoryTabs .category-tab.active")
      .getAttribute("data-category");
    renderMenuItemsForEditor(activeCategory);
  }

  // Chiudi il modal
  document.getElementById("menuItemModal").classList.remove("active");
}

function saveCategory() {
  const name = document.getElementById("categoryName").value.trim();

  if (name === "") {
    alert("Inserisci un nome per la categoria.");
    return;
  }

  // Crea un nuovo ID basato sul nome (lowercase e con trattini invece di spazi)
  const id = name.toLowerCase().replace(/\s+/g, "-");

  // Controlla se esiste già una categoria con lo stesso ID
  const categoryExists = appState.menu.categories.some((c) => c.id === id);

  if (categoryExists) {
    alert("Esiste già una categoria con questo nome.");
    return;
  }

  // Aggiungi la nuova categoria
  appState.menu.categories.push({
    id: id,
    name: name,
  });

  saveData();
  renderMenuEditor();

  // Chiudi il modal
  document.getElementById("categoryModal").classList.remove("active");
}

function saveOrderItem() {
  const index = parseInt(
    document.getElementById("saveOrderItemBtn").getAttribute("data-index")
  );
  let orderObject;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table || table.status === "closed") return;
    orderObject = table.order;
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway || takeaway.status === "closed") return;
    orderObject = takeaway.order;
  } else {
    return;
  }

  const item = orderObject.items[index];
  if (!item) return;

  // Aggiorna i dati dell'item
  item.quantity =
    parseInt(document.getElementById("orderItemQuantity").value) || 1;
  item.discount =
    parseFloat(document.getElementById("orderItemDiscount").value) || 0;
  item.isComplement = document.getElementById("orderItemComplement").checked;
  item.isFamily = document.getElementById("orderItemFamily").checked;
  item.notes = document.getElementById("orderItemNotes").value.trim();

  saveData();

  // Emetti evento WebSocket
  emitOrderUpdate();

  renderOrderDetails();

  // Chiudi il modal
  document.getElementById("orderItemModal").classList.remove("active");
}
async function createServerOrder(tableOrTakeaway, type) {
  if (!api) return;

  try {
    // Filtra items non validi prima di inviare al server
    const validItems = tableOrTakeaway.order.items.filter(
      (item) => item && item.name
    );

    const orderData = {
      numero_ordine: `${type}-${tableOrTakeaway.id}-${Date.now()}`,
      tavolo:
        type === "table"
          ? `${tableOrTakeaway.prefix || ""} ${
              tableOrTakeaway.number || tableOrTakeaway.customName || ""
            }`
          : `Asporto #${tableOrTakeaway.number}`,
      articoli: validItems.map((item) => ({
        nome: item.name,
        prezzo: item.basePrice || 0,
        quantita: item.quantity || 1,
        note: item.notes || "",
      })),
      note: tableOrTakeaway.order.notes || "",
    };

    console.log("📤 Invio ordine al server:", orderData);

    const result = await api.salvaOrdine(orderData);
    console.log("✅ Ordine salvato sul server:", result);

    // Salva l'ID dell'ordine del server nell'oggetto locale
    tableOrTakeaway.serverOrderId = result.ordine.id;

    return result;
  } catch (error) {
    console.error("❌ Errore creazione ordine sul server:", error);
    // Non bloccare la chiusura se il server non risponde
    return null;
  }
}

function setupTakeawayFilters() {
  const filterSelect = document.getElementById("takeawayStatusFilter");
  if (filterSelect) {
    filterSelect.addEventListener("change", () => {
      renderTakeaways(filterSelect.value);
    });
  }
}

// Sostituisci la funzione saveDiscount
function saveDiscount() {
  const discountType = document.getElementById("discountType").value;
  const discountValue =
    parseFloat(document.getElementById("discountValue").value) || 0;
  const discountReason = document.getElementById("discountReason").value.trim();

  if (
    discountType === "percentage" &&
    (discountValue < 0 || discountValue > 100)
  ) {
    alert("La percentuale di sconto deve essere compresa tra 0 e 100");
    return;
  }

  if (discountType === "fixed" && discountValue < 0) {
    alert("Lo sconto fisso non può essere negativo");
    return;
  }

  let orderObject;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table || table.status === "closed") return;
    orderObject = table.order;
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway || takeaway.status === "closed") return;
    orderObject = takeaway.order;
  } else {
    return;
  }

  // Aggiorna i dati dello sconto
  orderObject.discountType = discountType;
  orderObject.discount = discountValue;
  orderObject.discountReason = discountReason;

  saveData();
  renderOrderDetails();

  // Chiudi il modal
  document.getElementById("discountModal").classList.remove("active");
}

async function closeOrder() {
  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table || table.status === "closed") return;

    // Salva l'ordine sul server prima di chiuderlo
    await createServerOrder(table, "table");

    // Imposta lo stato del tavolo a 'closed'
    table.status = "closed";

    // Aggiungi la data di chiusura all'ordine
    table.order.closedAt = new Date().toISOString();
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway || takeaway.status === "closed") return;

    // Salva l'ordine sul server prima di chiuderlo
    await createServerOrder(takeaway, "takeaway");

    // Imposta lo stato dell'asporto a 'closed'
    takeaway.status = "closed";

    // Aggiungi la data di chiusura all'ordine
    takeaway.order.closedAt = new Date().toISOString();
  } else {
    return;
  }

  saveData();

  // Emetti evento per sincronizzare la chiusura
  if (api && api.socket && api.socket.connected) {
    api.socket.emit("ordine_chiuso", {
      id: appState.currentOrderId,
      type: appState.currentOrderType,
      status: "closed",
    });
    console.log("📡 Ordine chiuso emesso");
  }

  // Chiudi il modal di conferma
  document.getElementById("confirmCloseModal").classList.remove("active");
  // Torna alla vista dei tavoli
  showTablesView();

  // Aggiorna la visualizzazione dei tavoli e degli asporti
  renderTables();
  renderTakeaways();
}

function saveSettings() {
  appState.settings.restaurantName = document
    .getElementById("restaurantName")
    .value.trim();
  appState.settings.coverCharge =
    parseFloat(document.getElementById("coverCharge").value) || 0;

  saveData();
  updateUI();

  // Chiudi il modal
  document.getElementById("settingsModal").classList.remove("active");
}

// Funzioni per la stampa
function printOrder() {
  let orderObject;
  let orderTitle;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table) return;
    orderObject = table.order;

    // Gestione del nome del tavolo per la stampa comanda
    if (table.customName) {
      orderTitle = `Tavolo ${table.prefix ? table.prefix + " " : ""}${
        table.customName
      }`;
    } else {
      orderTitle = `Tavolo ${table.prefix ? table.prefix + " " : ""}${
        table.number
      }`;
    }
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway) return;
    orderObject = takeaway.order;
    orderTitle = `Asporto #${takeaway.number}`;
  } else {
    return;
  }

  // Crea una finestra di stampa
  const printWindow = window.open("", "_blank");

  // Genera il contenuto della comanda
  let content = `
        <html>
        <head>
            <title>Comanda - ${orderTitle}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                h1 { font-size: 18px; text-align: center; margin-bottom: 10px; }
                h2 { font-size: 16px; margin-bottom: 10px; }
                .date { text-align: center; font-size: 12px; margin-bottom: 20px; }
                .item { margin-bottom: 5px; }
                .item-name { font-weight: bold; }
                .item-options { margin-left: 20px; font-size: 12px; }
                .notes { font-style: italic; margin-top: 10px; }
                .section-divider { border-top: 1px dashed #000; margin: 15px 0; }
                .riepilogo { background-color: #f0f0f0; padding: 10px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <h1>${appState.settings.restaurantName}</h1>
            <h2>Comanda - ${orderTitle}</h2>
            <div class="date">${new Date().toLocaleString()}</div>
    `;

  // Aggiungi i coperti se è un tavolo
  if (appState.currentOrderType === "table" && orderObject.covers > 0) {
    content += `<div class="item"><span class="item-name">Coperti: ${orderObject.covers}</span></div>`;
  }

  // Prepara le categorie degli items
  const antipasti = [];
  const pizzeNormali = [];
  const pizzeFamiliari = [];
  const altriProdotti = [];

  if (orderObject.items && orderObject.items.length > 0) {
    orderObject.items.forEach((item) => {
      // Trova il prodotto nel menu per determinare la categoria
      const menuItem = appState.menu.items.find(
        (menuItem) => menuItem.name === item.name
      );

      if (menuItem && menuItem.categoryId === "antipasti") {
        antipasti.push(item);
      } else if (item.isHalfFamily) {
        // Le mezze familiari vanno sempre nelle pizze familiari
        pizzeFamiliari.push(item);
      } else if (
        menuItem &&
        (menuItem.categoryId === "pizze-classiche" ||
          menuItem.categoryId === "pizze-speciali" ||
          menuItem.categoryId === "pizze-create")
      ) {
        if (item.isFamily) {
          pizzeFamiliari.push(item);
        } else {
          pizzeNormali.push(item);
        }
      } else {
        altriProdotti.push(item);
      }
    });
  }

  // Gestione speciale per le mezze familiari nella stampa
  const printHalfFamilyItem = (item) => {
    let itemContent = `<div class="item">`;
    itemContent += `<span class="item-name">${item.quantity} x FAMILIARE 1/2 e 1/2</span>`;
    itemContent += `<div class="item-options" style="margin-left: 20px;">`;

    // Prima metà
    itemContent += `<div><strong>1/2 ${item.firstHalf.name}</strong></div>`;
    if (item.firstHalf.additions && item.firstHalf.additions.length > 0) {
      const additionsList = item.firstHalf.additions
        .map((a) => `+ ${a.name}`)
        .join(", ");
      itemContent += `<div style="margin-left: 20px;">${additionsList}</div>`;
    }
    if (item.firstHalf.removals && item.firstHalf.removals.length > 0) {
      const removalsList = item.firstHalf.removals
        .map((r) => `NO ${r}`)
        .join(", ");
      itemContent += `<div style="margin-left: 20px;">${removalsList}</div>`;
    }

    // Seconda metà
    itemContent += `<div><strong>1/2 ${item.secondHalf.name}</strong></div>`;
    if (item.secondHalf.additions && item.secondHalf.additions.length > 0) {
      const additionsList = item.secondHalf.additions
        .map((a) => `+ ${a.name}`)
        .join(", ");
      itemContent += `<div style="margin-left: 20px;">${additionsList}</div>`;
    }
    if (item.secondHalf.removals && item.secondHalf.removals.length > 0) {
      const removalsList = item.secondHalf.removals
        .map((r) => `NO ${r}`)
        .join(", ");
      itemContent += `<div style="margin-left: 20px;">${removalsList}</div>`;
    }

    itemContent += `</div>`;

    if (item.notes) {
      itemContent += `<div class="item-options">Note: ${item.notes}</div>`;
    }

    itemContent += "</div>";
    return itemContent;
  };

  // Aggiungi riepilogo pizze
  content += '<div class="riepilogo">';
  content += "<strong>RIEPILOGO PIZZE:</strong><br>";

  const totalePizzeNormali = pizzeNormali.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const totalePizzeFamiliari = pizzeFamiliari.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  if (totalePizzeNormali > 0) {
    content += `Pizze Normali: ${totalePizzeNormali}<br>`;
  }
  if (totalePizzeFamiliari > 0) {
    content += `Pizze Familiari: ${totalePizzeFamiliari}<br>`;
  }
  if (totalePizzeNormali === 0 && totalePizzeFamiliari === 0) {
    content += "Nessuna pizza nell'ordine<br>";
  }
  content += "</div>";

  // Funzione helper per stampare un item
  const printItem = (item) => {
    let itemContent = `<div class="item">`;

    // Costruisci il nome con quantità
    let itemName = `${item.quantity} x `;
    if (item.isFamily) {
      itemName += `FAMILIARE ${item.name}`;
    } else {
      itemName += item.name;
    }

    itemContent += `<span class="item-name">${itemName}</span>`;

    // Mostra opzioni pizza se presenti
    if (
      (item.additions && item.additions.length > 0) ||
      (item.removals && item.removals.length > 0)
    ) {
      itemContent += '<div class="item-options">';

      if (item.additions && item.additions.length > 0) {
        const additionsList = item.additions
          .map((a) => `+ ${a.name}`)
          .join(", ");
        itemContent += `<div>${additionsList}</div>`;
      }

      if (item.removals && item.removals.length > 0) {
        const removalsList = item.removals.map((r) => `NO ${r}`).join(", ");
        itemContent += `<div>${removalsList}</div>`;
      }

      itemContent += "</div>";
    }

    // Mostra note se presenti
    if (item.notes) {
      itemContent += `<div class="item-options">Note: ${item.notes}</div>`;
    }

    itemContent += "</div>";
    return itemContent;
  };

  // Stampa antipasti
  if (antipasti.length > 0) {
    content += '<div class="section-divider"></div>';
    content += "<h3>ANTIPASTI</h3>";
    antipasti.forEach((item) => {
      content += printItem(item);
    });
  }

  /// Stampa pizze
  if (pizzeNormali.length > 0 || pizzeFamiliari.length > 0) {
    content += '<div class="section-divider"></div>';
    content += "<h3>PIZZE</h3>";

    // Prima le pizze normali
    pizzeNormali.forEach((item) => {
      if (item.isHalfFamily) {
        content += printHalfFamilyItem(item);
      } else {
        content += printItem(item);
      }
    });

    // Poi le pizze familiari
    pizzeFamiliari.forEach((item) => {
      content += printItem(item);
    });
  }

  // Stampa altri prodotti
  if (altriProdotti.length > 0) {
    content += '<div class="section-divider"></div>';
    content += "<h3>ALTRI PRODOTTI</h3>";
    altriProdotti.forEach((item) => {
      content += printItem(item);
    });
  }

  // Aggiungi eventuali note generali
  if (orderObject.notes) {
    content += `<div class="notes">Note: ${orderObject.notes}</div>`;
  }

  content += `
        </body>
        </html>
    `;

  // Scrivi il contenuto nella finestra di stampa
  printWindow.document.write(content);
  printWindow.document.close();

  // Attendi il caricamento e stampa
  printWindow.onload = function () {
    printWindow.print();
    printWindow.close();
  };
}

function printReceipt() {
  let orderObject;
  let orderTitle;

  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table) return;
    orderObject = table.order;

    // Gestione del nome del tavolo per la stampa
    if (table.customName) {
      orderTitle = `Tavolo ${table.prefix ? table.prefix + " " : ""}Pers.`;
    } else {
      orderTitle = `Tavolo ${table.prefix ? table.prefix + " " : ""}${
        table.number
      }`;
    }
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway) return;
    orderObject = takeaway.order;
    orderTitle = `Asporto #${takeaway.number}`;
  } else {
    return;
  }

  // Calcola il subtotale
  let subtotal = 0;

  // Aggiungi il costo dei coperti se è un tavolo
  let coverCharge = 0;
  if (appState.currentOrderType === "table" && orderObject.covers > 0) {
    coverCharge = orderObject.covers * appState.settings.coverCharge;
    subtotal += coverCharge;
  }

  // Aggiungi il costo di tutti gli items
  const itemsWithPrice = [];

  if (orderObject.items) {
    orderObject.items.forEach((item) => {
      // Calcola il prezzo base con aggiunzioni
      let itemPrice = item.basePrice;
      let itemDescription = item.name;

      // Prezzo doppio per le pizze familiari
      if (item.isFamily) {
        itemPrice *= 2;
        itemDescription += " (Familiare)";
      }

      // Descrizione per mezze familiari
      if (item.isHalfFamily) {
        itemDescription = `Familiare: (1/2 + 1/2)`;

        // Aggiungi dettagli delle due metà
        if (item.firstHalf) {
          itemDescription += ` - ${item.firstHalf.name}`;
          if (item.firstHalf.additions && item.firstHalf.additions.length > 0) {
            itemDescription += ` (${item.firstHalf.additions
              .map((a) => `+${a.name}`)
              .join(", ")})`;
          }
          if (item.firstHalf.removals && item.firstHalf.removals.length > 0) {
            itemDescription += ` (${item.firstHalf.removals
              .map((r) => `NO ${r}`)
              .join(", ")})`;
          }
        }

        if (item.secondHalf) {
          itemDescription += ` + ${item.secondHalf.name}`;
          if (
            item.secondHalf.additions &&
            item.secondHalf.additions.length > 0
          ) {
            itemDescription += ` (${item.secondHalf.additions
              .map((a) => `+${a.name}`)
              .join(", ")})`;
          }
          if (item.secondHalf.removals && item.secondHalf.removals.length > 0) {
            itemDescription += ` (${item.secondHalf.removals
              .map((r) => `NO ${r}`)
              .join(", ")})`;
          }
        }
      }

      // Descrizione per aggiunzioni
      if (item.additions && item.additions.length > 0) {
        const additionsList = item.additions.map((a) => a.name).join(", ");
        itemDescription += ` (+ ${additionsList})`;

        item.additions.forEach((addition) => {
          // Per le pizze familiari, anche le aggiunte costano il doppio
          let additionPrice = addition.price;
          if (item.isFamily) {
            additionPrice *= 2;
          }
          itemPrice += additionPrice;
        });
      }

      // Descrizione per rimozioni
      if (item.removals && item.removals.length > 0) {
        const removalsList = item.removals.map((r) => `NO ${r}`).join(", ");
        itemDescription += ` (${removalsList})`;
      }

      // Applica sconto se presente
      let finalPrice = itemPrice;
      let discountDescription = "";

      if (item.discount > 0) {
        finalPrice = itemPrice * (1 - item.discount / 100);
        discountDescription = ` (-${item.discount}%)`;
      }

      // Se è un omaggio, il prezzo è 0
      if (item.isComplement) {
        finalPrice = 0;
        discountDescription = " (Omaggio)";
      }

      // Moltiplica per la quantità
      const totalPrice = finalPrice * item.quantity;
      subtotal += totalPrice;

      itemsWithPrice.push({
        description: `${itemDescription}${discountDescription} x ${item.quantity}`,
        price: totalPrice,
      });
    });
  }

  // Calcola l'importo dello sconto
  let discountAmount = 0;
  let discountDescription = "";

  if (orderObject.discount > 0) {
    if (orderObject.discountType === "percentage") {
      discountAmount = subtotal * (orderObject.discount / 100);
      discountDescription = `Sconto ${orderObject.discount}%`;
    } else if (orderObject.discountType === "fixed") {
      discountAmount = Math.min(orderObject.discount, subtotal); // Lo sconto non può essere maggiore del subtotale
      discountDescription = `Sconto €${formatPrice(orderObject.discount)}`;
    }

    if (orderObject.discountReason) {
      discountDescription += ` (${orderObject.discountReason})`;
    }
  }

  // Calcola il totale finale
  const total = subtotal - discountAmount;

  // Crea una finestra di stampa
  const printWindow = window.open("", "_blank");

  // Genera il contenuto dello scontrino
  let content = `
        <html>
        <head>
            <title>Scontrino - ${orderTitle}</title>
            <style>
                body { font-family: 'Courier New', monospace; margin: 0; padding: 20px; width: 80mm; font-weight: bold; }
                h1 { font-size: 18px; text-align: center; margin-bottom: 10px; }
                h2 { font-size: 16px; text-align: center; margin-bottom: 10px; }
                .date { text-align: center; font-size: 12px; margin-bottom: 20px; }
                .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .item-description { flex: 1; padding-right: 10px; }
                .item-price { text-align: right; white-space: nowrap; }
                .divider { border-top: 1px dashed #000; margin: 10px 0; }
                .subtotal { display: flex; justify-content: space-between; margin-top: 10px; }
                .discount { display: flex; justify-content: space-between; color: #d32f2f; }
                .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin-top: 10px; }
                .footer { margin-top: 30px; text-align: center; font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>${appState.settings.restaurantName}</h1>
            <h2>${orderTitle}</h2>
            <div class="date">${formatDateTime(new Date().toISOString())}</div>
            <div class="divider"></div>
    `;

  // Aggiungi i coperti se è un tavolo
  if (appState.currentOrderType === "table" && orderObject.covers > 0) {
    content += `
            <div class="item">
                <div class="item-description">Coperto x ${
                  orderObject.covers
                }</div>
                <div class="item-price">€${formatPrice(coverCharge)}</div>
            </div>
        `;
  }

  // Aggiungi gli items dell'ordine
  itemsWithPrice.forEach((item) => {
    content += `
            <div class="item">
                <div class="item-description">${item.description}</div>
                <div class="item-price">€${formatPrice(item.price)}</div>
            </div>
        `;
  });

  content += '<div class="divider"></div>';

  // Aggiungi subtotale, sconto e totale
  content += `
        <div class="subtotal">
            <div>Subtotale</div>
            <div>€${formatPrice(subtotal)}</div>
        </div>
    `;

  if (discountAmount > 0) {
    content += `
            <div class="discount">
                <div>${discountDescription}</div>
                <div>-€${formatPrice(discountAmount)}</div>
            </div>
        `;
  }

  content += `
        <div class="total">
            <div>TOTALE</div>
            <div>€${formatPrice(total)}</div>
        </div>
        
        <div class="footer">
            <p>Grazie per averci scelto!</p>
            <p>Vi aspettiamo presto</p>
        </div>
        
        <div class="divider"></div>
        <div style="text-align: center; font-size: 10px;">
            <p>Documento non fiscale</p>
            <p>Questo non è uno scontrino fiscale</p>
        </div>
    </body>
    </html>
    `;

  // Scrivi il contenuto nella finestra di stampa
  printWindow.document.write(content);
  printWindow.document.close();

  // Attendi il caricamento e stampa
  printWindow.onload = function () {
    printWindow.print();
    printWindow.close();
  };
}

// Export e import dei dati
function exportData() {
  const data = {
    menu: appState.menu,
    tables: appState.tables,
    takeaways: appState.takeaways,
    settings: appState.settings,
    ingredients: appState.ingredients,
    exportDate: new Date().toISOString(),
  };

  const dataStr = JSON.stringify(data, null, 2);
  const dataUri =
    "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

  const exportFileDefaultName = `pizzeria_ximenes_backup_${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  const linkElement = document.createElement("a");
  linkElement.setAttribute("href", dataUri);
  linkElement.setAttribute("download", exportFileDefaultName);
  linkElement.click();
}
function formatDateTime(dateString) {
  const date = new Date(dateString);
  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return date.toLocaleString("it-IT", options);
}
// Sostituisci la funzione importData
function importData() {
  const fileInput = document.getElementById("importData");
  const file = fileInput.files[0];

  if (!file) {
    alert("Seleziona un file da importare.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);

      // Verifica che il file contenga i dati necessari
      if (!data.menu || !data.tables || !data.takeaways || !data.settings) {
        throw new Error(
          "Il file non contiene dati validi per il gestionale pizzeria."
        );
      }

      // Verifica la struttura dei dati più in dettaglio
      if (
        !Array.isArray(data.menu.categories) ||
        !Array.isArray(data.menu.items)
      ) {
        throw new Error("La struttura del menu non è valida.");
      }

      if (!Array.isArray(data.tables) || !Array.isArray(data.takeaways)) {
        throw new Error(
          "La struttura dei tavoli o degli asporti non è valida."
        );
      }

      // Aggiorna lo stato dell'applicazione
      appState.menu = data.menu;
      appState.tables = data.tables;
      appState.takeaways = data.takeaways;
      appState.settings = data.settings;

      // Aggiorna gli ingredienti se presenti
      if (data.ingredients) {
        appState.ingredients = data.ingredients;
      }

      saveData();

      // Aggiorna l'interfaccia
      renderTables();
      renderTakeaways();
      renderMenuEditor();
      updateUI();

      alert("Dati importati con successo.");

      // Chiudi il modal
      document.getElementById("settingsModal").classList.remove("active");
    } catch (error) {
      alert("Errore durante l'importazione dei dati: " + error.message);
    }
  };

  reader.readAsText(file);
}

// Funzione per pulire i dati di tavoli e asporto
function clearTablesAndTakeaways() {
  // Manteniamo gli elementi del menu ma cancelliamo tavoli e asporto
  appState.tables = [];
  appState.takeaways = [];

  // Salviamo i dati aggiornati
  saveData();

  // Aggiorniamo la visualizzazione
  renderTables();
  renderTakeaways();

  // Mostriamo una conferma all'utente
  alert(
    "Tutti i tavoli e gli ordini da asporto sono stati rimossi con successo."
  );

  // Chiudiamo il modal impostazioni
  document.getElementById("settingsModal").classList.remove("active");
}
function renderMenuEditor() {
  // Render delle categorie nel menu editor
  const editorCategoryTabs = document.getElementById("editorCategoryTabs");
  editorCategoryTabs.innerHTML = "";

  appState.menu.categories.forEach((category, index) => {
    const categoryTab = document.createElement("button");
    categoryTab.className = `category-tab ${index === 0 ? "active" : ""}`;
    categoryTab.textContent = category.name;
    categoryTab.setAttribute("data-category", category.id);

    categoryTab.addEventListener("click", () => {
      document
        .querySelectorAll("#editorCategoryTabs .category-tab")
        .forEach((tab) => {
          tab.classList.remove("active");
        });
      categoryTab.classList.add("active");

      // Reset della ricerca quando si cambia categoria
      document.getElementById("menuSearchInput").value = "";

      renderMenuItemsForEditor(category.id);
    });

    editorCategoryTabs.appendChild(categoryTab);
  });

  // Render degli items per la prima categoria
  if (appState.menu.categories.length > 0) {
    renderMenuItemsForEditor(appState.menu.categories[0].id);
  }
}
// Event listeners principali
function setupEventListeners() {
  // Tab di navigazione
  renderTabs();
  // Ricerca nel menu
  document
    .getElementById("menuSearchInput")
    .addEventListener("input", searchMenuItems);
  document.getElementById("clearSearchBtn").addEventListener("click", () => {
    document.getElementById("menuSearchInput").value = "";
    const activeCategory = document
      .querySelector("#editorCategoryTabs .category-tab.active")
      .getAttribute("data-category");
    renderMenuItemsForEditor(activeCategory);
  });

  // Pulsanti principali
  document
    .getElementById("addTableBtn")
    .addEventListener("click", showAddTableModal);
  document
    .getElementById("addTakeawayBtn")
    .addEventListener("click", showAddTakeawayModal);
  document.getElementById("addCategoryBtn").addEventListener("click", () => {
    document.getElementById("categoryModal").classList.add("active");
  });
  document
    .getElementById("addItemBtn")
    .addEventListener("click", showAddItemModal);

  // Pulsanti nella vista ordine
  document
    .getElementById("applyDiscountBtn")
    .addEventListener("click", showDiscountModal);
  document
    .getElementById("printOrderBtn")
    .addEventListener("click", printOrder);
  document
    .getElementById("printReceiptBtn")
    .addEventListener("click", printReceipt);
  document
    .getElementById("closeOrderBtn")
    .addEventListener("click", showConfirmCloseModal);

  // Pulsante impostazioni
  document.getElementById("settingsBtn").addEventListener("click", () => {
    document.getElementById("settingsModal").classList.add("active");
  });

  // Esporta/Importa dati
  document
    .getElementById("exportDataBtn")
    .addEventListener("click", exportData);
  document.getElementById("importData").addEventListener("change", importData);

  // Setup dei modal
  setupModalEventListeners();
  // Pulsante pulizia dati
  document.getElementById("clearDataBtn").addEventListener("click", () => {
    if (
      confirm(
        "Sei sicuro di voler eliminare tutti i tavoli e gli ordini da asporto? Questa operazione non può essere annullata."
      )
    ) {
      clearTablesAndTakeaways();
    }
  });
  // Aggiungi questa riga alla fine della funzione setupEventListeners
  setupTableFilters();
}

// Funzione coperti
function promptCovers(tableId) {
  const table = appState.tables.find((t) => t.id === tableId);
  if (!table) return;

  // Mostra il dialogo solo se è un nuovo tavolo che diventa attivo
  if (table.status === "active" && table.order.covers === 0) {
    showCoversModal(tableId);
  }
}
function showCoversModal(tableId) {
  const table = appState.tables.find((t) => t.id === tableId);
  if (!table) return;

  // Imposta il valore corrente
  document.getElementById("coversCount").value = table.order.covers || 0;

  // Salva l'ID del tavolo per riferimento
  document
    .getElementById("saveCoversBtn")
    .setAttribute("data-table-id", tableId);

  // Mostra il modal
  document.getElementById("coversModal").classList.add("active");
}

function saveCovers() {
  const tableId = document
    .getElementById("saveCoversBtn")
    .getAttribute("data-table-id");
  const covers = parseInt(document.getElementById("coversCount").value) || 0;

  const table = appState.tables.find((t) => t.id === tableId);
  if (!table) return;

  table.order.covers = covers;
  saveData();

  // Se siamo nella vista ordine, aggiorna la visualizzazione
  if (appState.currentOrderId === tableId) {
    // Emetti evento WebSocket
    emitOrderUpdate();
    renderOrderDetails();
  }

  // Chiudi il modal
  document.getElementById("coversModal").classList.remove("active");
}
function renderCoverItem(orderObject, orderItemsContainer) {
  if (appState.currentOrderType === "table" && orderObject.covers >= 0) {
    const coverItem = document.createElement("div");
    coverItem.className = "order-item";
    coverItem.innerHTML = `
            <div class="order-item-details">
                <div class="order-item-name">Coperto</div>
            </div>
            <div class="order-item-price">€${formatPrice(
              orderObject.covers * appState.settings.coverCharge
            )}</div>
            <div class="covers-control">
                <button class="btn btn-sm btn-icon btn-outline decrease-cover" title="Diminuisci">−</button>
                <span class="covers-display">x ${orderObject.covers}</span>
                <button class="btn btn-sm btn-icon btn-outline increase-cover" title="Aumenta">+</button>
            </div>
        `;

    // Event listeners per i pulsanti + e -
    coverItem.querySelector(".decrease-cover").addEventListener("click", () => {
      if (orderObject.covers > 0) {
        orderObject.covers--;
        saveData();
        renderOrderDetails();
      }
    });

    coverItem.querySelector(".increase-cover").addEventListener("click", () => {
      orderObject.covers++;
      saveData();
      renderOrderDetails();
    });

    orderItemsContainer.appendChild(coverItem);
  }
}
// Funzione per pulire completamente il localStorage
function resetAllData() {
  if (
    confirm(
      "ATTENZIONE: Stai per cancellare tutti i dati salvati (menu, tavoli, asporto, impostazioni). Questa operazione non può essere annullata. Vuoi continuare?"
    )
  ) {
    localStorage.clear();
    alert("Dati cancellati con successo. La pagina verrà ricaricata.");
    location.reload();
  }
}

// Aggiungi pulsante di reset al modal impostazioni
document.addEventListener("DOMContentLoaded", function () {
  // Ottieni il container dove inserire il pulsante
  const settingsSection = document.querySelector(
    "#settingsModal .settings-section:last-child"
  );

  if (settingsSection) {
    // Crea una nuova sezione per il reset
    const resetSection = document.createElement("div");
    resetSection.className = "settings-section";
    resetSection.innerHTML = `
    <h4 class="settings-section-title">Reset Completo</h4>
    <div class="form-group">
    <button class="btn btn-danger mb-1" id="resetAllDataBtn">
    Reset Completo Dati
        </button>
        <p class="mb-1">
        ATTENZIONE: Questa operazione cancellerà tutti i dati salvati, inclusi ingredienti, menu, tavoli e asporto. Utilizzare solo se necessario.
        </p>
        </div>
        `;

    // Inserisci prima della sezione del footer
    const modalFooter = document.querySelector("#settingsModal .modal-footer");
    modalFooter.parentNode.insertBefore(resetSection, modalFooter);

    // Aggiungi l'event listener al pulsante di reset
    document
      .getElementById("resetAllDataBtn")
      .addEventListener("click", resetAllData);
  }
});

// Aggiungi questa funzione per gestire i filtri dei tavoli
function setupTableFilters() {
  const filterSelect = document.getElementById("tableStatusFilter");
  if (filterSelect) {
    filterSelect.addEventListener("change", () => {
      renderTables(filterSelect.value);
    });
  }
}

// Modifica la funzione renderTables per accettare un filtro
function renderTables(statusFilter = "all") {
  const tablesContainer = document.getElementById("tablesContainer");
  tablesContainer.innerHTML = "";

  // Filtra i tavoli in base allo stato selezionato
  const filteredTables =
    statusFilter === "all"
      ? appState.tables
      : appState.tables.filter((table) => table.status === statusFilter);

  filteredTables.forEach((table) => {
    const tableCard = document.createElement("div");
    tableCard.className = `table-card ${table.status}`;

    // Determina cosa mostrare: se c'è un nome personalizzato usa quello, altrimenti numero
    let tableDisplay = "";
    if (table.customName) {
      tableDisplay = `${table.prefix ? table.prefix + " " : ""}${
        table.customName
      }`;
    } else {
      tableDisplay = `${table.prefix ? table.prefix + " " : ""}${table.number}`;
    }

    tableCard.innerHTML = `
            <div class="table-number">${tableDisplay}</div>
            <div class="table-status ${table.status}">${getStatusText(
      table.status
    )}</div>
        `;

    tableCard.addEventListener("click", () => {
      if (table.status === "closed") {
        // Per i tavoli chiusi, apri in modalità di sola lettura
        showOrderView(table.id, "table");
        // Disabilita i pulsanti di modifica
        document.getElementById("printOrderBtn").disabled = false;
        document.getElementById("printReceiptBtn").disabled = false;
        document.getElementById("closeOrderBtn").disabled = true;
        document.getElementById("applyDiscountBtn").disabled = true;
      } else {
        // Per i tavoli attivi o nuovi
        if (table.status === "new") {
          // Inizializza un nuovo ordine per i tavoli nuovi
          table.status = "active";
          table.order = {
            items: [],
            discount: 0,
            discountType: "percentage",
            discountReason: "",
            covers: 0,
            createdAt: new Date().toISOString(),
          };
          saveData();

          // Dopo aver aperto la vista dell'ordine, chiedi i coperti
          setTimeout(() => {
            promptCovers(table.id);
          }, 100);
        }

        showOrderView(table.id, "table");
        // Abilita tutti i pulsanti
        document.getElementById("printOrderBtn").disabled = false;
        document.getElementById("printReceiptBtn").disabled = false;
        document.getElementById("closeOrderBtn").disabled = false;
        document.getElementById("applyDiscountBtn").disabled = false;
      }
    });

    tablesContainer.appendChild(tableCard);
  });

  // Mostra un messaggio se non ci sono tavoli con il filtro selezionato
  if (filteredTables.length === 0) {
    tablesContainer.innerHTML =
      '<div class="text-center p-3">Nessun tavolo trovato con il filtro selezionato.</div>';
  }
}
async function syncExistingOrders() {
  if (!api || !api.socket) return;

  // Invia tutti i tavoli e asporti al server per sincronizzazione
  api.socket.emit("sync_all_orders", {
    tables: appState.tables,
    takeaways: appState.takeaways,
  });
}
function getCurrentOrderItem(index) {
  let orderObject;
  if (appState.currentOrderType === "table") {
    const table = appState.tables.find((t) => t.id === appState.currentOrderId);
    if (!table) return null;
    orderObject = table.order;
  } else if (appState.currentOrderType === "takeaway") {
    const takeaway = appState.takeaways.find(
      (t) => t.id === appState.currentOrderId
    );
    if (!takeaway) return null;
    orderObject = takeaway.order;
  }
  return orderObject?.items[index];
}
function cleanupCorruptedOrders() {
  // Pulisci tavoli
  appState.tables.forEach((table) => {
    if (table.order && table.order.items) {
      table.order.items = table.order.items.filter((item) => item && item.name);
    }
  });

  // Pulisci asporti
  appState.takeaways.forEach((takeaway) => {
    if (takeaway.order && takeaway.order.items) {
      takeaway.order.items = takeaway.order.items.filter(
        (item) => item && item.name
      );
    }
  });

  saveData();
  console.log("✅ Ordini puliti");
}

// Inizializzazione dell'app
document.addEventListener("DOMContentLoaded", async () => {
  await initializeApp();
});
