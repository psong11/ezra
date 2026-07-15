import { describe, it, expect } from 'vitest';
import { chunkText, isSSML, concatenateAudioBuffers } from '../chunking';

describe('TTS Chunking Utilities', () => {
  describe('isSSML', () => {
    it('should detect SSML input', () => {
      expect(isSSML('<speak>Hello world</speak>')).toBe(true);
      expect(isSSML('  <speak>Hello</speak>')).toBe(true);
    });

    it('should not detect plain text as SSML', () => {
      expect(isSSML('Hello world')).toBe(false);
      expect(isSSML('This is <speak> not SSML')).toBe(false);
    });
  });

  describe('chunkText', () => {
    it('should not chunk text shorter than max length', () => {
      const text = 'This is a short text.';
      const chunks = chunkText(text, 100);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('should chunk long text at sentence boundaries', () => {
      const sentences = [];
      for (let i = 0; i < 10; i++) {
        sentences.push(`This is sentence ${i}. `.repeat(100));
      }
      const text = sentences.join('');
      
      const chunks = chunkText(text, 1000);
      
      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should be under max length
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(1000);
      });
    });

    it('should handle text with various punctuation', () => {
      const text = 'First sentence. Second sentence! Third sentence? Fourth sentence.';
      const chunks = chunkText(text, 30);
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeGreaterThan(0);
      });
    });

    it('should not chunk SSML text', () => {
      const ssml = '<speak>' + 'a'.repeat(6000) + '</speak>';
      const chunks = chunkText(ssml);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(ssml);
    });

    it('should handle very long single sentence by splitting words', () => {
      const longSentence = 'word '.repeat(2000); // Very long sentence
      const chunks = chunkText(longSentence, 100);
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(100);
      });
    });

    it('should preserve sentence structure', () => {
      const text = 'First. Second. Third.';
      const chunks = chunkText(text, 10);
      
      // Each chunk should contain complete sentences
      chunks.forEach(chunk => {
        expect(chunk.trim()).toMatch(/^[A-Z].*[.!?]$/);
      });
    });
  });

  describe('concatenateAudioBuffers', () => {
    it('should concatenate multiple buffers', () => {
      const buf1 = Buffer.from([1, 2, 3]);
      const buf2 = Buffer.from([4, 5, 6]);
      const buf3 = Buffer.from([7, 8, 9]);
      
      const result = concatenateAudioBuffers([buf1, buf2, buf3]);
      
      expect(result).toEqual(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    });

    it('should return empty buffer for empty array', () => {
      const result = concatenateAudioBuffers([]);
      
      expect(result).toEqual(Buffer.alloc(0));
      expect(result.length).toBe(0);
    });

    it('should return single buffer unchanged', () => {
      const buf = Buffer.from([1, 2, 3]);
      const result = concatenateAudioBuffers([buf]);
      
      expect(result).toEqual(buf);
    });
  });
});
