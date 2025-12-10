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

export const generateRestaurantAnalysis = async (stats: any, date: string): Promise<string> => {
    try {
        const apiKey = getGoogleApiKey() || process.env.API_KEY;
        if (!apiKey) return "⚠️ Chiave API mancante. Configurala nella sezione AI.";

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            Sei un Consulente Esperto di Gestione Ristoranti e Data Analyst.
            Analizza i seguenti dati del ristorante per la giornata del ${date}:

            DATI METRICI:
            - Incasso Totale: € ${stats.totalRevenue.toFixed(2)}
            - Totale Piatti Venduti: ${stats.totalItems}
            - Tempo Medio di Attesa: ${stats.avgWait} minuti
            - Picco di lavoro (traffico orario): ${JSON.stringify(stats.chartHours.filter((h: any) => h.count > 0).map((h: any) => `${h.hour}:00 (${h.count} ordini)`))}
            - Top 5 Piatti più venduti: ${JSON.stringify(stats.topDishes)}

            OBIETTIVO:
            Fornisci un report breve, strategico e motivante (max 150 parole).
            Struttura la risposta così:
            1. 📊 Valutazione Generale: Un commento sulla performance (Ottima, Buona, Critica) basato su incasso e attesa.
            2. ⏱️ Efficienza: Commenta i tempi di attesa. Se > 20 min, suggerisci miglioramenti.
            3. 💡 Suggerimento Menu: Un consiglio basato sui piatti più venduti (es. promuovere varianti, o se l'incasso è basso spingere piatti più costosi).
            
            Usa un tono professionale ma diretto. Usa emoji per rendere la lettura piacevole.
            Non inventare dati non presenti.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "Analisi non disponibile.";

    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return "Errore durante l'analisi AI. Riprova più tardi.";
    }
};

export const generateDishDescription = async (dishName: string): Promise<string> => {
    try {
        const apiKey = getGoogleApiKey() || process.env.API_KEY;
        if (!apiKey) return ""; // Fail silently or handle in UI

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            Sei uno Chef stellato che scrive il menu.
            Scrivi una descrizione breve, invitante e appetitosa per il piatto: "${dishName}".
            Elenca gli ingredienti principali in modo discorsivo.
            Usa un tono elegante ma chiaro. Max 25 parole.
            Non mettere virgolette.
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