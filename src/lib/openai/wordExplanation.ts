/**
 * Word Explanation Prompt Generation and Logic
 */

import { getOpenAIClient, OPENAI_MODEL, MAX_TOKENS, TEMPERATURE } from './client';
import { WordExplanationRequest, WordExplanationResponse } from './types';

/**
 * Generate the biblical language guide prompt
 */
export function generateWordExplanationPrompt(request: WordExplanationRequest): string {
  const { word, language, verse, bookName, chapterNum, verseNum } = request;
  
  const verseContext = bookName && chapterNum && verseNum
    ? `${bookName} ${chapterNum}:${verseNum}`
    : 'Biblical text';

  return `You are a biblical scholar providing detailed linguistic analysis of the ${language} word "${word}". Format your response with clear sections using the following structure:

**Word**
[Show the ${language} word "${word}" in its original script]
[Provide the transliteration]

**Grammar**
[Root, Part of speech, gender, number, case (if Greek)]

**English Translation**
[Provide the closest English translation(s) of the Root, then the ${word}]

**Biblical Occurrences**
[Cite this word's first occurrence in the Bible with just the relevant snippet containing the word in the original ${language} script, followed by as many (max 5) other relevant appearances that show the nuances of the word. For each occurrence, provide:
1. The reference (book chapter:verse)
2. The snippet in original ${language} containing the word
3. The English translation of that snippet
Format each occurrence as: Reference - ${language} snippet → English translation]

Keep each section concise and scholarly yet accessible. NO FLUFF. Remember: the word being analyzed is "${word}" in ${language}.`;
}

/**
 * Call OpenAI API to get word explanation
 */
export async function getWordExplanation(
  request: WordExplanationRequest
): Promise<WordExplanationResponse> {
  const client = getOpenAIClient();
  const prompt = generateWordExplanationPrompt(request);

  console.log('🤖 Requesting word explanation from OpenAI...');
  console.log(`   Word: "${request.word}" (${request.language})`);

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a biblical scholar specializing in linguistic analysis, grammar, and historical context. You provide detailed, structured explanations of biblical words with academic rigor.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 600, // Increased for detailed structured response
      temperature: TEMPERATURE,
    });

    const explanation = completion.choices[0]?.message?.content || 'No explanation available.';

    console.log('✅ OpenAI explanation received');

    // Format the explanation for better display
    const formattedExplanation = formatExplanation(explanation.trim());

    return {
      word: request.word,
      language: request.language,
      verse: request.verse,
      explanation: formattedExplanation,
      cached: false,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('❌ OpenAI API error:', error.message);
    throw new Error(`Failed to get word explanation: ${error.message}`);
  }
}

/**
 * Format the explanation for HTML display
 * Converts markdown-style formatting to HTML
 */
export function formatExplanation(text: string): string {
  return text
    // Bold section headers (**Text** -> <strong>Text</strong>)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic text (*Text* -> <em>Text</em>)
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Double line breaks to paragraph spacing
    .replace(/\n\n/g, '<br><br>')
    // Single line breaks to line breaks
    .replace(/\n/g, '<br>')
    // Preserve verse references in brackets [Book X:Y]
    .replace(/\[([^\]]+)\]/g, '<span class="text-amber-600 font-medium">[$1]</span>');
}
