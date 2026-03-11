import { GoogleGenAI, Type } from '@google/genai';

// Inizializza il client Gemini usando la chiave API iniettata dall'ambiente
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedData {
  codice: string;
  descrizione: string;
  lotto: string;
  quantita?: number;
}

/**
 * Utilizza l'API di Gemini (come motore OCR avanzato) per estrarre e parsare
 * intelligentemente i dati dall'immagine dell'etichetta.
 */
export async function extractDataFromImage(base64Image: string, mimeType: string): Promise<ExtractedData> {
  try {
    // Rimuovi il prefisso data:image/...;base64, se presente
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          }
        },
        "Analizza questa etichetta di inventario. Estrai le seguenti informazioni: Codice Prodotto, Descrizione, Lotto e Quantità. Usa la tua capacità di parsing intelligente per distinguere i campi. Se un campo testuale non è chiaramente presente, restituisci una stringa vuota. Se la quantità non è presente, restituisci 1."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            codice: { type: Type.STRING, description: "Il codice identificativo del prodotto (es. SKU, Barcode text)" },
            descrizione: { type: Type.STRING, description: "La descrizione testuale del prodotto" },
            lotto: { type: Type.STRING, description: "Il lotto di produzione (es. LOT, L., Batch)" },
            quantita: { type: Type.NUMBER, description: "La quantità indicata sull'etichetta. Se non presente, usa 1." }
          },
          required: ["codice", "descrizione", "lotto", "quantita"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as ExtractedData;
    }
    throw new Error("Nessun dato estratto dall'immagine");
  } catch (error) {
    console.error("Errore durante l'OCR con Gemini:", error);
    throw error;
  }
}
