export interface ScanResult {
  codice: string;
  descrizione: string;
  quantita: string;
  lotto: string;
  data_produzione: string | null;
  confidence: {
    barcode: number;
    codice: number;
    descrizione: number;
    quantita: number;
  };
  source: {
    codice: "barcode" | "ocr";
    lotto: "barcode";
    descrizione: "ocr";
    quantita: "ocr";
  };
}

export interface InventorySession {
  id: string;
  nome: string;
  created_at: string;
  user_id: string;
  is_active: boolean;
}

export interface InventoryItem {
  id: string;
  codice: string;
  descrizione: string;
  lotto: string;
  quantita: number;
  sessione_id: string;
  user_id: string;
  created_at: string;
  timestamp?: number;
}
