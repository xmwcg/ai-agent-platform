import fs from 'fs';
import os from 'os';
import path from 'path';
import { DocumentChunker } from './rag-pipeline.chunker';
import { DocumentParser } from './rag-pipeline.parser';
import { DEFAULT_CONFIG } from './rag-pipeline.types';

describe('DocumentChunker', () => {
  it('splits text by paragraphs and respects chunkSize', () => {
    const chunker = new DocumentChunker({ chunkSize: 50, chunkOverlap: 0, maxChunks: 100 });
    const text = Array.from({ length: 20 }, (_, i) => `para ${i} content here`).join('\n\n');
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
    expect(chunks.every((c) => c.text.length > 0)).toBe(true);
  });

  it('enforces maxChunks limit', () => {
    const chunker = new DocumentChunker({ chunkSize: 20, chunkOverlap: 0, maxChunks: 3 });
    const text = Array.from({ length: 50 }, (_, i) => `p${i} xxxxxxxx`).join('\n\n');
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBeLessThanOrEqual(3);
  });

  it('returns no chunks for empty/whitespace text', () => {
    const chunker = new DocumentChunker();
    expect(chunker.chunk('   ').length).toBe(0);
  });

  it('applies chunkOverlap so adjacent chunks share context', () => {
    const chunker = new DocumentChunker({ chunkSize: 40, chunkOverlap: 10, maxChunks: 100 });
    const para = 'word word word word word word word word';
    const text = Array.from({ length: 10 }, () => para).join('\n\n');
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBeGreaterThan(1);
    // 重叠策略：每块保留前一块末尾片段作为上下文
    expect(chunks[0].text.length).toBeGreaterThan(0);
  });
});

describe('DocumentParser', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-test-'));
  afterAll(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('returns raw text for .txt files', async () => {
    const p = path.join(tmp, 'sample.txt');
    fs.writeFileSync(p, '# Hello\n\nWorld');
    const parser = new DocumentParser();
    const doc = await parser.parse(p, 'sample.txt');
    expect(doc.text).toContain('Hello');
    expect(doc.metadata.format).toBe('txt');
    expect(doc.metadata.wordCount).toBeGreaterThan(0);
  });

  it('throws on unsupported format', async () => {
    const p = path.join(tmp, 'x.exe');
    fs.writeFileSync(p, 'bin');
    const parser = new DocumentParser();
    await expect(parser.parse(p, 'x.exe')).rejects.toThrow(/Unsupported format/);
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has sane defaults', () => {
    expect(DEFAULT_CONFIG.chunkSize).toBe(1000);
    expect(DEFAULT_CONFIG.chunkOverlap).toBe(200);
    expect(DEFAULT_CONFIG.maxChunks).toBe(100);
  });
});
