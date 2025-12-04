import { GoogleGenAI } from "@google/genai";
import { MenuItem } from "../types";
import { getGoogleApiKey } from "./storageService";

export const askChefAI = async (query: string, currentItem: MenuItem | null): Promise<string> => {
  try {
    // 1. Retrieve the Key dynamically (Priority: Customer Settings > System Env)
    // process.env.API_KEY acts as a fallback/global key if you want to provide one default key
    const apiKey = getGoogleApiKey() || process.env.API_KEY;
    
    if (!apiKey) {
        return "⚠️ Configurazione AI mancante. Vai nelle Impostazioni > AI Intelligence e inserisci la tua Google API Key.";
    }

    // 2. Initialize Client on the fly
    const ai = new GoogleGenAI({ apiKey });

    const context = currentItem 
      ? `Il cliente sta chiedendo informazioni sul piatto: "${currentItem.name}". Descrizione: ${currentItem.description || 'Nessuna descrizione specifica'}. Allergeni noti: ${currentItem.allergens?.join(', ') || 'Nessuno specificato'}.` 
      : 'Il cliente sta facendo una domanda generale sul menu.';

    const prompt = `
      Sei un assistente chef esperto e cortese in un ristorante italiano.
      Contesto: ${context}
      Domanda del cliente: "${query}"
      
      Rispondi in modo conciso (max 2 frasi), professionale e invitante. 
      Se chiedono allergeni e non sei sicuro basandoti sulla descrizione, consiglia di chiedere allo chef in cucina per sicurezza assoluta.
      Usa un tono cordiale.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Mi dispiace, non riesco a recuperare questa informazione al momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Errore di connessione AI. Verifica la validità della tua API Key nelle impostazioni.";
  }
};