import { expect, test } from 'bun:test';
import { runEda } from './eda-service';
import { profileTable } from './profiling-service';

test('EDA retains continuous numeric measurements even when every value is unique', () => {
  const table = { headers: ['sensor', 'id'], rows: Array.from({ length: 40 }, (_, i) => ({ sensor: i + .5, id: i })) };
  const summary = profileTable(table, { name: 'measurements.csv', source: 'CSV', sizeLabel: '1 KB' });
  const result = runEda(table, summary);
  expect(result.numeric.map(n => n.column)).toEqual(['sensor']);
  expect(result.numeric[0]?.mean).toBe(20);
  expect(result.numeric[0]?.histogram.reduce((total, bin) => total + bin.count, 0)).toBe(40);
});