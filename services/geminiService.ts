import { GoogleGenAI } from "@google/genai";
import { MenuItem } from "../types";

// Safe API Key retrieval that won't crash the browser if process is undefined
const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore error
  }
  return '';
};

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: getApiKey() });

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
    return "Assistente Chef offline (Verifica API Key).";
  }
};