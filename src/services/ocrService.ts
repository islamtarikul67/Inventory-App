import { GoogleGenAI, Type } from '@google/genai';

// Inizializza il client Gemini usando la chiave API iniettata dall'ambiente
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedData {
  codice: string;
  descrizione: string;
  lotto: string;
  quantita?: number;
  note?: string;
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
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            }
          },
          {
            text: "Analizza attentamente questa etichetta industriale e estrai i seguenti dati in formato JSON:\n" +
            "- Codice Prodotto: Cerca il codice alfanumerico principale (spesso vicino a 'Codice:' o sotto un codice a barre).\n" +
            "- Descrizione: Estrai l'INTERA descrizione testuale, inclusi codici di revisione (REV), norme (STD) e specifiche tecniche. Non troncare il testo.\n" +
            "- Lotto: Cerca il numero di lotto o batch. DEVE ESSERE UN NUMERO DI ESATTAMENTE 6 CIFRE (es. 250173, 250258). Cerca numeri isolati di 6 cifre in alto, vicino a codici a barre secondari o date di produzione. Se non trovi un numero di 6 cifre, restituisci una stringa vuota.\n" +
            "- Quantità: Estrai solo il valore numerico (es. da '500,00 PZ' estrai 500).\n\n" +
            "Sii estremamente preciso. Se un campo è assente o illeggibile, usa una stringa vuota (o 1 per quantità). Non inventare dati."
          }
        ]
      },
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

export function parseQuantita(q: any): string {
  if (!q) return "1";
  const str = String(q);
  return str.replace(/PZ/gi, "").replace(",", ".").trim();
}

/**
 * Versione PRO ottimizzata per la scansione live.
 * Utilizza un prompt più aggressivo e preciso.
 */
export async function extractLiveOCRPro(base64Image: string, mimeType: string): Promise<ExtractedData | null> {
  try {
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            }
          },
          {
            text: "SMART SCAN AI: Analizza questa etichetta industriale in tempo reale.\n" +
            "Estrai i seguenti campi in JSON:\n" +
            "- codice: il codice prodotto principale (alfanumerico).\n" +
            "- descrizione: breve descrizione del prodotto.\n" +
            "- lotto: numero di lotto (spesso 6 cifre, ma estrai quello che trovi).\n" +
            "- quantita: valore numerico (es. 1, 10, 500).\n\n" +
            "REGOLE: Estrai i dati nel miglior modo possibile. Se un campo non è presente, usa una stringa vuota. Restituisci 'confidence' come numero da 0 a 100 indicando la tua sicurezza."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            codice: { type: Type.STRING },
            descrizione: { type: Type.STRING },
            lotto: { type: Type.STRING },
            quantita: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: ["codice", "descrizione", "lotto", "quantita", "confidence"]
        }
      }
    });

    const text = response.text;
    if (text) {
      const data = JSON.parse(text);
      // Accettiamo i dati se c'è almeno un codice o un lotto, la confidence è solo indicativa
      if (data.codice || data.lotto) {
        return {
          codice: data.codice || '',
          descrizione: data.descrizione || '',
          lotto: data.lotto || '',
          quantita: parseFloat(parseQuantita(data.quantita)) || 1
        };
      }
    }
    return null;
  } catch (error) {
    console.warn("Errore PRO OCR:", error);
    return null;
  }
}
