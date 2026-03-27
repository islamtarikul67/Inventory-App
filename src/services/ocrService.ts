import { GoogleGenAI, Type } from '@google/genai';

// Inizializza il client Gemini usando la chiave API iniettata dall'ambiente
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedData {
  codice: string;
  descrizione: string;
  lotto: string;
  quantita?: number;
  note?: string;
  // Nuovi campi per l'analisi intelligente
  categoria?: string;
  scadenza?: string;
  unita?: string;
  traduzione?: string;
  pericolo?: string;
  isSmartAnalysis?: boolean;
  confidence?: {
    codice: number;
    descrizione: number;
    lotto: number;
    quantita: number;
    categoria?: number;
    scadenza?: number;
  };
}

/**
 * Utilizza l'API di Gemini (come motore OCR avanzato) per estrarre e parsare
 * intelligentemente i dati dall'immagine dell'etichetta.
 */
export async function extractDataFromImage(base64Image: string, mimeType: string, isSmart: boolean = false): Promise<ExtractedData> {
  try {
    // Rimuovi il prefisso data:image/...;base64, se presente
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const promptBase = "Analizza attentamente questa etichetta industriale e estrai i seguenti dati in formato JSON:\n" +
    "- Codice Prodotto: Cerca il codice alfanumerico principale (spesso vicino a 'Codice:' o sotto un codice a barre).\n" +
    "- Descrizione: Estrai l'INTERA descrizione testuale, inclusi codici di revisione (REV), norme (STD) e specifiche tecniche. Non troncare il testo.\n" +
    "- Lotto: Cerca il numero di lotto o batch. DEVE ESSERE UN NUMERO DI ESATTAMENTE 6 CIFRE (es. 250173, 250258). Cerca numeri isolati di 6 cifre in alto, vicino a codici a barre secondari o date di produzione. Se non trovi un numero di 6 cifre, restituisci una stringa vuota.\n" +
    "- Quantità: Estrai solo il valore numerico (es. da '500,00 PZ' estrai 500).\n\n";

    const smartPrompt = promptBase + 
    "AGGIUNGI ANALISI INTELLIGENTE:\n" +
    "- Categoria: Suggerisci una categoria merceologica (es. Viteria, Elettronica, Plastica, Chimico).\n" +
    "- Scadenza: Cerca date di scadenza (EXP, SCAD, USE BY) in formato YYYY-MM-DD.\n" +
    "- Unità: Identifica l'unità di misura (PZ, KG, M, LT).\n" +
    "- Traduzione: Se la descrizione è in inglese o tedesco, traducila accuratamente in ITALIANO tecnico.\n" +
    "- Pericolo: Se vedi simboli o testi di pericolo (GHS, infiammabile, tossico), segnalalo brevemente.\n\n" +
    "Sii estremamente preciso. Se un campo è assente o illeggibile, usa una stringa vuota (o 1 per quantità). Non inventare dati.";

    const normalPrompt = promptBase + "Sii estremamente preciso. Se un campo è assente o illeggibile, usa una stringa vuota (o 1 per quantità). Non inventare dati.";

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
            text: isSmart ? smartPrompt : normalPrompt
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
            quantita: { type: Type.NUMBER },
            categoria: { type: Type.STRING },
            scadenza: { type: Type.STRING },
            unita: { type: Type.STRING },
            traduzione: { type: Type.STRING },
            pericolo: { type: Type.STRING },
            confidence: {
              type: Type.OBJECT,
              properties: {
                codice: { type: Type.NUMBER },
                descrizione: { type: Type.NUMBER },
                lotto: { type: Type.NUMBER },
                quantita: { type: Type.NUMBER },
                categoria: { type: Type.NUMBER },
                scadenza: { type: Type.NUMBER }
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
      const data = JSON.parse(text) as ExtractedData;
      data.isSmartAnalysis = isSmart;
      return data;
    }
    throw new Error("Nessun dato estratto dall'immagine");
  } catch (error) {
    console.error("Errore durante l'OCR con Gemini:", error);
    throw error;
  }
}
