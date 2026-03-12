import { GoogleGenAI, Type } from '@google/genai';

// Inizializza il client Gemini usando la chiave API iniettata dall'ambiente
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedData {
  codice: string;
  descrizione: string;
  lotto: string;
  quantita?: number;
  confidence?: {
    codice: number;
    descrizione: number;
    lotto: number;
    quantita: number;
  };
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
        "Analizza attentamente questa etichetta industriale e estrai i seguenti dati in formato JSON:\n" +
        "- Codice Prodotto: Cerca il codice alfanumerico principale (spesso vicino a 'Codice:' o sotto un codice a barre).\n" +
        "- Descrizione: Estrai l'INTERA descrizione testuale, inclusi codici di revisione (REV), norme (STD) e specifiche tecniche. Non troncare il testo.\n" +
        "- Lotto: Cerca il numero di lotto o batch. Se non c'è l'etichetta esplicita 'Lotto', cerca numeri isolati in alto, vicino a codici a barre secondari o date di produzione (es. numeri di 6-10 cifre).\n" +
        "- Quantità: Estrai solo il valore numerico (es. da '500,00 PZ' estrai 500).\n\n" +
        "Sii estremamente preciso. Se un campo è assente, usa una stringa vuota (o 1 per quantità)."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            codice: { type: Type.STRING, description: "Il codice identificativo del prodotto (es. SKU, Barcode text)" },
            descrizione: { type: Type.STRING, description: "La descrizione testuale del prodotto" },
            lotto: { type: Type.STRING, description: "Il lotto di produzione (es. LOT, L., Batch)" },
            quantita: { type: Type.NUMBER, description: "La quantità indicata sull'etichetta. Se non presente, usa 1." },
            confidence: {
              type: Type.OBJECT,
              description: "Punteggi di confidenza (0-100) per ogni campo estratto",
              properties: {
                codice: { type: Type.NUMBER },
                descrizione: { type: Type.NUMBER },
                lotto: { type: Type.NUMBER },
                quantita: { type: Type.NUMBER }
              },
              required: ["codice", "descrizione", "lotto", "quantita"]
            }
          },
          required: ["codice", "descrizione", "lotto", "quantita", "confidence"]
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
