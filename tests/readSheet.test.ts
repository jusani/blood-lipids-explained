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

describe('QA PR1/PR2: lines that must not fill a value', () => {
  it.each([
    'Cholesterolis/DTL santykis 4,5',
    'Cholesterolis / DTL 4,5',
    'LDL/HDL ratio 2.5',
    'TG/HDL 3,1',
    'Aterogeninis indeksas 3,2',
    'Cholesterolis ne DTL 4,1 mmol/l',
    'Non-HDL cholesterol 4.1',
  ])('%s', (line) => expect(readLine(line)).toBeNull());

  it('skips a limit or range printed before the result', () => {
    expect(readLine('Cholesterolis < 5,2 6,4 mmol/l')?.value.text).toBe('6,4');
    expect(readLine('DTL > 1,0 1,4')?.value.text).toBe('1,4');
    expect(readLine('Trigliceridai 0,5 - 1,7 2,3')?.value.text).toBe('2,3');
    expect(readLine('Gliukozė 3,9 – 6,1 5,4')).toBeNull();
  });

  it('leaves the field empty when two figures could be the result', () => {
    expect(readLine('Trigliceridai 1.7 2,3')).toBeNull();
    expect(readLine('MTL cholesterolis 4,1 3,8 mmol/l')).toBeNull();      // a previous result alongside
  });

  it('still reads the usual result, unit and limit layout', () => {
    expect(readLine('MTL cholesterolis 4,15 mmol/l < 3,0')).toEqual({ id: 'ldl', value: { text: '4,15', unit: 'mmol/L' } });
    expect(readLine('Gliukozė 5,4 mmol/l 3,9 - 6,1')).toBeNull();
  });
});

describe('names as Lithuanian labs print them (Antėja and Medicina practica test lists, Oct 2026)', () => {
  // No real report is public, so these lines use the names, abbreviations and limits the labs
  // print on their own pages, in the usual name, result, unit, limit order.
  const sheet = [
    'Tyrimas Rezultatas Vnt. Orientacinės reikšmės',
    'CHOL Cholesterolis bendras 6,4 mmol/l < 5,2',
    'DTL (α) cholesterolis 1,12 mmol/l > 1,0',
    'MTL (β) cholesterolis 4,3 mmol/l < 3,0',
    'TGL Trigliceridai 2,1 mmol/l < 1,7',
    'Ne DTL cholesterolis 5,28 mmol/l',
    'Aterogeniškumo indeksas (AI) 4,7',
  ].join('\n');

  it('reads every value and nothing from the calculated lines', () => {
    expect(parseLabText(sheet)).toEqual({
      total: { text: '6,4', unit: 'mmol/L' },
      hdl: { text: '1,12', unit: 'mmol/L' },
      ldl: { text: '4,3', unit: 'mmol/L' },
      tg: { text: '2,1', unit: 'mmol/L' },
    });
  });

  it('reads "Cholesterolis (CHOL)" and "TRIG"', () => {
    expect(readLine('Cholesterolis (CHOL) 5,9 mmol/l')?.id).toBe('total');
    expect(readLine('TRIG 1,45 mmol/L 0,0 - 1,7')).toEqual({ id: 'tg', value: { text: '1,45', unit: 'mmol/L' } });
  });
});
