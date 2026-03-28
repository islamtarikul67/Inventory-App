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
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          }
        },
        "Analizza attentamente questa etichetta industriale e estrai i seguenti dati in formato JSON:\n" +
        "- codice: Cerca il codice identificativo principale (Sku, Part Number, Barcode text).\n" +
        "- descrizione: Estrai l'INTERA descrizione testuale, inclusi codici di revisione (REV), norme (STD) e specifiche tecniche. Non troncare il testo.\n" +
        "- lotto: Cerca il numero di lotto o batch. Spesso è un numero di 6 cifre (es. 250173), ma può avere altri formati. Estrai quello che sembra più probabile essere il lotto.\n" +
        "- quantita: Estrai solo il valore numerico (es. da '500,00 PZ' estrai 500).\n\n" +
        "Sii estremamente preciso. Se un campo è assente o illeggibile, usa una stringa vuota (o 1 per quantità). Non inventare dati se non sei sicuro, ma cerca di estrarre tutto il possibile.\n" +
        "IMPORTANTE: Restituisci SOLO il JSON puro, senza blocchi di codice markdown."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            codice: { type: Type.STRING },
            descrizione: { type: Type.STRING },
            lotto: { type: Type.STRING },
            quantita: { type: Type.NUMBER },
            confidence: {
              type: Type.OBJECT,
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

    console.log("Risposta Gemini:", response);

    const text = response.text;
    if (!text) {
      throw new Error("Nessun dato estratto dall'immagine.");
    }

    try {
      // Pulisce il testo da eventuali blocchi markdown se presenti nonostante il prompt
      const cleanedText = text.replace(/```json|```/g, '').trim();
      const data = JSON.parse(cleanedText);
      
      // Validazione minima dei dati
      return {
        codice: data.codice || '',
        descrizione: data.descrizione || '',
        lotto: data.lotto || '',
        quantita: Number(data.quantita) || 1,
        confidence: data.confidence || { codice: 0, descrizione: 0, lotto: 0, quantita: 0 }
      };
    } catch (parseError) {
      console.error("Errore parsing JSON Gemini:", text);
      throw new Error("Errore nell'elaborazione dei dati estratti.");
    }
  } catch (error) {
    console.error("Errore durante l'OCR con Gemini:", error);
    throw error;
  }
}
