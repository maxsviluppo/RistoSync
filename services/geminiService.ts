
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

export const generateRestaurantAnalysis = async (stats: any, date: string, location: string, topIngredients: string[]): Promise<string> => {
    try {
        const apiKey = getGoogleApiKey() || process.env.API_KEY;
        if (!apiKey) return "⚠️ Chiave API mancante. Configurala nelle impostazioni.";

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            Sei un Senior Restaurant Consultant specializzato in Efficienza Operativa e Supply Chain.
            
            DATI DEL RISTORANTE (Data: ${date}):
            - Località: ${location || "Italia (Generico)"}
            - Incasso: € ${stats.totalRevenue.toFixed(2)}
            - Scontrino Medio: € ${stats.avgOrder.toFixed(2)}
            - Tavoli Serviti: ${stats.totalTablesServed}
            - Tempo Medio Attesa (Creazione -> Servizio): ${stats.avgWaitTime} minuti
            - Materie Prime Più Usate: ${topIngredients.join(', ')}
            
            OBIETTIVO:
            Fornisci una consulenza strategica focalizzata su Efficienza e Food Cost (Max 250 parole).
            
            STRUTTURA RISPOSTA:
            1. ⚡ **Efficienza & Struttura**: Analizza il "Tempo Medio Attesa" (${stats.avgWaitTime} min) in relazione ai "Tavoli Serviti" (${stats.totalTablesServed}). La cucina è veloce o lenta? Se lenta (>30min), suggerisci come migliorare il pass o la linea.
            2. 📉 **Analisi Food Cost**: Commenta la redditività basandoti sui consumi.
            3. 🚚 **Sourcing Locale**: Dato che il locale è a "${location}", consiglia fornitori specifici per gli ingredienti top (es. ${topIngredients.slice(0,2).join(', ')}).
            4. 💡 **Action Item**: Un consiglio pratico immediato per lo staff.

            Usa emoji professionali. Sii diretto e costruttivo.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "Analisi non disponibile.";

    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return "Errore analisi AI. Verifica la connessione.";
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

export const generateRestaurantDescription = async (restaurantName: string): Promise<string> => {
    try {
        const apiKey = getGoogleApiKey() || process.env.API_KEY;
        if (!apiKey) return "";

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            Sei un esperto copywriter per la ristorazione.
            Scrivi una "Bio" (descrizione breve) accattivante ed elegante per il ristorante chiamato "${restaurantName}".
            Massimo 30 parole.
            Usa un tono invitante che faccia venire fame.
            Usa 1 o 2 emoji appropriate.
            Non usare virgolette.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "";
    } catch (error) {
        console.error("Restaurant Bio Gen Error:", error);
        return "";
    }
};
