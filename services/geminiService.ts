import { GoogleGenAI } from "@google/genai";
import { MenuItem } from "../types";

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const askChefAI = async (query: string, currentItem: MenuItem | null): Promise<string> => {
  try {
    const context = currentItem 
      ? `Il cliente sta chiedendo informazioni sul piatto: "${currentItem.name}". Descrizione: ${currentItem.description || 'Nessuna descrizione specifica'}.` 
      : 'Il cliente sta facendo una domanda generale sul menu.';

    const prompt = `
      Sei un assistente chef esperto e cortese in un ristorante italiano.
      Contesto: ${context}
      Domanda del cliente: "${query}"
      
      Rispondi in modo conciso (max 2 frasi), professionale e invitante. Se chiedono allergeni e non sei sicuro, consiglia di chiedere allo chef in cucina per sicurezza.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Mi dispiace, non riesco a recuperare questa informazione al momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Errore di connessione con l'Assistente Chef.";
  }
};
