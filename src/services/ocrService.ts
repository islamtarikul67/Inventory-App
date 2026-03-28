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

    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2;
    if (!apiKey) {
      throw new Error("Chiave API Gemini non configurata. Inserisci GEMINI_API_KEY o GEMINI_API_KEY_2 nelle impostazioni.");
    }

    // Inizializzazione lazy per evitare problemi di caricamento modulo
    const genAI = new GoogleGenAI({ apiKey });

    // Timeout di 30 secondi per evitare blocchi infiniti
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout: L'IA di Google sta impiegando troppo tempo. Riprova.")), 30000)
    );

    const response = await Promise.race([
      genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                }
              },
              {
                text: "Sei un esperto di OCR industriale di Google AI.\n" +
                "Analizza questa etichetta industriale PANOTEC ed estrai i dati in formato JSON.\n" +
                "STRUTTURA ETICHETTA:\n" +
                "- 'codice': dopo 'Codice :', es. 842-OCSCN0002_01.\n" +
                "- 'descrizione': blocco dopo 'Descrizione :'.\n" +
                "- 'lotto': numero nel barcode in alto a destra (es. 250305).\n" +
                "- 'quantita': numero prima di 'PZ' (es. 500).\n" +
                "- 'confidence': punteggio 0-100 per ogni campo.\n\n" +
                "REGOLE:\n" +
                "- Estrai ESATTAMENTE quello che vedi.\n" +
                "- Se un dato è incerto, usa il ragionamento logico.\n" +
                "- Restituisci SOLO il JSON."
              }
            ]
          }
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
      }),
      timeoutPromise
    ]) as any;

    const text = response.text;
    console.log("Gemini Raw Response:", text);

    if (!text) {
      throw new Error("L'IA non ha restituito dati. Riprova con una foto più chiara.");
    }

    try {
      // Estrazione robusta del JSON (cerca tra le prime '{' e l'ultima '}')
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      const data = JSON.parse(jsonStr);

      return {
        codice: String(data.codice || '').trim(),
        descrizione: String(data.descrizione || '').trim(),
        lotto: String(data.lotto || '').trim(),
        quantita: Number(data.quantita) || 1,
        confidence: data.confidence || { codice: 50, descrizione: 50, lotto: 50, quantita: 50 }
      };
    } catch (e) {
      console.error("Errore Parsing JSON:", e, text);
      throw new Error("Errore nell'interpretazione dei dati. Riprova.");
    }
  } catch (error) {
    console.error("Errore durante l'OCR con Gemini:", error);
    throw error;
  }
}
