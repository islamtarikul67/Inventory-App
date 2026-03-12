export interface InventorySession {
  id: string;
  nome: string;
  data_inizio: string;
  stato: 'aperta' | 'chiusa';
  creato_da: string;
}

export interface InventoryItem {
  id: string;
  codice: string;
  descrizione: string;
  lotto: string;
  quantita: number;
  note?: string;
  sessione_id: string;
  creato_at: string;
  creato_da: string;
}
