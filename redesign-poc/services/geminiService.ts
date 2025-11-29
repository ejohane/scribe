import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export const generateTextContinuation = async (currentText: string): Promise<string> => {
  try {
    const aiInstance = getAI();
    // Using gemini-2.5-flash for fast text generation
    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a helpful writing assistant. Continue the following text naturally, maintaining the tone and style. Keep it concise (max 2 paragraphs). Return ONLY the continuation text, no preamble.
      
      Text so far:
      "${currentText}"`,
    });
    
    return response.text || "";
  } catch (error) {
    console.error("Error generating text:", error);
    return " (AI generation failed. Please check your API key.)";
  }
};

export const summarizeText = async (text: string): Promise<string> => {
  try {
    const aiInstance = getAI();
    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Summarize the following text in one brief paragraph:\n\n"${text}"`,
    });
    return response.text || "";
  } catch (error) {
    console.error("Error summarizing text:", error);
    return " (AI summarization failed.)";
  }
};