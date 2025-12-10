import { GoogleGenAI } from "@google/genai";
import { MenuItem } from "../types";
import { getGoogleApiKey } from "./storageService";

export const askChefAI = async (query: string, currentItem: MenuItem | null): Promise<string> => {
  try {
    const apiKey = getGoogleApiKey() || process.env.API_KEY;
    if (!apiKey) {
        return "⚠️ Configurazione AI mancante. Vai nelle Impostazioni > AI Intelligence e inserisci la tua Google API Key.";
    }

    const ai = new GoogleGenAI({ apiKey });

    const context = currentItem 
      ? `Il cliente sta chiedendo informazioni sul piatto: "${currentItem.name}". Ingredienti: ${currentItem.ingredients || 'Non specificati'}. Descrizione: ${currentItem.description || 'Nessuna'}. Allergeni: ${currentItem.allergens?.join(', ') || 'Nessuno'}.` 
      : 'Il cliente sta facendo una domanda generale sul menu.';

    const prompt = `
      Sei un assistente chef esperto e cortese in un ristorante italiano.
      Contesto: ${context}
      Domanda del cliente: "${query}"
      
      Rispondi in modo conciso (max 2 frasi), professionale e invitante. 
      Se chiedono allergeni e non sei sicuro, consiglia di chiedere allo chef.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Non riesco a rispondere al momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Errore AI. Verifica la chiave API.";
  }
};

export const generateRestaurantAnalysis = async (stats: any, date: string): Promise<string> => {
    try {
        const apiKey = getGoogleApiKey() || process.env.API_KEY;
        if (!apiKey) return "⚠️ Chiave API mancante.";

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            Sei un Consulente Ristorazione. Analizza i dati del ${date}:
            - Incasso: € ${stats.totalRevenue.toFixed(2)}
            - Piatti: ${stats.totalItems}
            - Attesa Media: ${stats.avgWait} min
            - Top Piatti: ${JSON.stringify(stats.topDishes)}

            Fornisci un report breve (max 100 parole) con:
            1. Valutazione performance.
            2. Consiglio per migliorare incasso o efficienza domani.
            Usa emoji.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "Analisi non disponibile.";

    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return "Errore analisi AI.";
    }
};

export const generateDishIngredients = async (dishName: string): Promise<string> => {
    try {
        const apiKey = getGoogleApiKey() || process.env.API_KEY;
        if (!apiKey) return "";

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            Sei uno Chef. 
            Elenca SOLO gli ingredienti principali per il piatto "${dishName}", separati da virgola.
            Non scrivere nient'altro. Solo elenco ingredienti.
            Esempio: Pasta, Uova, Guanciale, Pecorino, Pepe.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text ? response.text.replace(/\n/g, " ").trim() : "";
    } catch (error) {
        console.error("Ingredients Gen Error:", error);
        return "";
    }
};

export const generateDishDescription = async (dishName: string, ingredients: string): Promise<string> => {
    try {
        const apiKey = getGoogleApiKey() || process.env.API_KEY;
        if (!apiKey) return "";

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            Sei uno Chef stellato che scrive il menu.
            Scrivi una descrizione breve (max 20 parole), invitante e poetica per il piatto: "${dishName}".
            Considera questi ingredienti: ${ingredients}.
            Non elencare di nuovo gli ingredienti, descrivi l'esperienza di gusto.
            Tono elegante. Niente virgolette.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "";
    } catch (error) {
        console.error("Description Gen Error:", error);
        return "";
    }
};