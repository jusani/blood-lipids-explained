import { describe, expect, it } from 'vitest';
import { itemsToLines, parseLabText, readLine } from '../src/lib/readSheet';

describe('reading lab sheet text (photo/PDF prototype)', () => {
  it('reads Lithuanian and English names, keeps the number as printed', () => {
    const text = [
      'LABORATORINIŲ TYRIMŲ ATSAKYMAS',
      'Mėginio Nr. 482913 Data: 2026-09-14',
      'Gliukozė 5,4 mmol/l 3,9 - 6,1',
      'Cholesterolis 6,32 mmol/l < 5,2',
      'MTL cholesterolis 4,15 mmol/l < 3,0',
      'DTL-C 1,28 mmol/l > 1,0',
      'Trigliceridai 1,94 mmol/l < 1,7',
    ].join('\n');
    expect(parseLabText(text)).toEqual({
      total: { text: '6,32', unit: 'mmol/L' },
      ldl: { text: '4,15', unit: 'mmol/L' },
      hdl: { text: '1,28', unit: 'mmol/L' },
      tg: { text: '1,94', unit: 'mmol/L' },
    });
  });

  it('matches names without accents, as photo reading often drops them', () => {
    expect(readLine('Mazo tankio lipoproteinu cholesterolis 3.5 mmol/L')?.id).toBe('ldl');
    expect(readLine('Triacilgliceroliai | 3,05 | mmol/l')).toEqual({ id: 'tg', value: { text: '3,05', unit: 'mmol/L' } });
  });

  it('"MTL cholesterolis" is LDL, never total cholesterol', () => {
    expect(readLine('MTL cholesterolis 4,1')?.id).toBe('ldl');
    expect(readLine('Cholesterolis bendras 6,1')?.id).toBe('total');
  });

  it('notes mg/dL when the line says so', () => {
    expect(readLine('LDL-C 160 mg/dL')).toEqual({ id: 'ldl', value: { text: '160', unit: 'mg/dL' } });
  });

  it('leaves out numbers that cannot be a real value, and lines without a known name', () => {
    expect(readLine('HDL-C 55 mmol/l')).toBeNull();           // 55 mmol/L is impossible
    expect(readLine('Gliukozė 5,4 mmol/l')).toBeNull();
    expect(readLine('ALT 22 U/l')).toBeNull();
    expect(readLine('TGF 2,1')).toBeNull();                    // a longer word is not "TG"
  });

  it('keeps the first reading of each value', () => {
    expect(parseLabText('TG 1,2\nTrigliceridai 9,9').tg?.text).toBe('1,2');
  });

  it('puts PDF text pieces back into lines', () => {
    const lines = itemsToLines([
      { x: 260, y: 700, text: '4,15' }, { x: 60, y: 700, text: 'MTL cholesterolis' },
      { x: 60, y: 722, text: 'Cholesterolis' }, { x: 260, y: 721, text: '6,32' },
    ]);
    expect(lines).toEqual(['Cholesterolis 6,32', 'MTL cholesterolis 4,15']);
  });
});
