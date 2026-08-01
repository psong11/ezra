import { describe, it, expect } from 'vitest';
import { verifyOccurrencesAgainstCorpus, VerseLoader } from '../verifyOccurrences';
import { Occurrence } from '../schema';

// Miniature corpus: Deut 7:2 (the studied verse), Psalm 123 with the
// Masoretic-style off-by-one (target text lives at verse 4, cited as 3),
// and Ezekiel 5:11 which does NOT contain the root חנן.
const CORPUS: Record<string, string> = {
  'deuteronomy:7:2': 'הַחֲרֵם תַּחֲרִים אֹתָם לֹא תִכְרֹת לָהֶם בְּרִית וְלֹא תְחָנֵּם',
  'psalms:123:4': 'חָנֵּנוּ יְהוָה חָנֵּנוּ כִּי רַב שָׂבַעְנוּ בוּז',
  'ezekiel:5:11': 'וְגַם אֲנִי אֶגְרַע וְלֹא תָחוֹס עֵינִי וְגַם אֲנִי לֹא אֶחְמוֹל',
};

const loadVerse: VerseLoader = async (bookId, chapter, verse) =>
  CORPUS[`${bookId}:${chapter}:${verse}`] ?? null;

const occ = (book: string, chapter: number, verse: number): Occurrence => ({
  book,
  chapter,
  verse,
  snippet: 'MODEL SNIPPET — must never survive verification',
  translation: 'and you shall not **show mercy** to them',
});

const OPTS = { word: 'תְחָנֵּם', root: 'חנן', loadVerse };

describe('verifyOccurrencesAgainstCorpus', () => {
  it('rebuilds the snippet from the actual verse text with the real token bolded', async () => {
    const out = await verifyOccurrencesAgainstCorpus([occ('Deuteronomy', 7, 2)], OPTS);
    expect(out).toHaveLength(1);
    expect(out[0].snippet).toContain('**תְחָנֵּם**');
    expect(out[0].snippet).not.toContain('MODEL SNIPPET');
  });

  it('corrects the verse number when versification is off by one', async () => {
    const out = await verifyOccurrencesAgainstCorpus([occ('Psalm', 123, 3)], OPTS);
    expect(out).toHaveLength(1);
    expect(out[0].verse).toBe(4);
    expect(out[0].snippet).toContain('**חָנֵּנוּ**');
  });

  it('drops a citation whose verse does not contain the root (synonym conflation)', async () => {
    const out = await verifyOccurrencesAgainstCorpus([occ('Ezekiel', 5, 11)], OPTS);
    expect(out).toHaveLength(0);
  });

  it('drops hallucinated books and out-of-corpus verses', async () => {
    const out = await verifyOccurrencesAgainstCorpus(
      [occ('Book of Enoch', 1, 1), occ('Deuteronomy', 7, 30)],
      OPTS
    );
    expect(out).toHaveLength(0);
  });

  it('keeps and tightens the model translation on verified citations', async () => {
    const out = await verifyOccurrencesAgainstCorpus([occ('Deuteronomy', 7, 2)], OPTS);
    expect(out[0].translation).toContain('**show mercy**');
  });
});
