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
