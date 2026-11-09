import { describe, expect, test } from 'bun:test';
import { assessMl, inspectFeatures, partitionRows, type ExperimentConfig } from './ml-advisor';
import { profileTable } from './profiling-service';

const table = {
  headers: ['signal', 'label', 'copy', 'future_result', 'date', 'entity'],
  rows: Array.from({ length: 120 }, (_, i) => ({ signal: (i * 17) % 31, label: i % 2 ? 'yes' : 'no', copy: i % 2 ? 'yes' : 'no', future_result: i, date: `2026-01-${String(1 + Math.floor(i / 5)).padStart(2, '0')}`, entity: `group-${Math.floor(i / 4)}` })),
};
const config: ExperimentConfig = { problem: 'classification', target: 'label', features: ['signal'], timeColumn: '', groupColumn: '', testFraction: .2, k: 3 };
const summary = profileTable(table, { name: 'uploaded.csv', source: 'CSV', sizeLabel: '1 KB' });

describe('ML methodological safeguards', () => {
  test('target cannot be a feature', () => {
    expect(inspectFeatures(table, summary, 'label').find(f => f.column === 'label')?.eligible).toBe(false);
  });
  test('exact target copies are excluded', () => {
    expect(inspectFeatures(table, summary, 'label').find(f => f.column === 'copy')?.eligible).toBe(false);
  });
  test('future information is excluded', () => {
    expect(inspectFeatures(table, summary, 'label').find(f => f.column === 'future_result')?.eligible).toBe(false);
  });
  test('train and test are disjoint and reproducible for every model', () => {
    const split = partitionRows(table, config);
    expect(split.test).toHaveLength(24);
    expect(split.train).toHaveLength(96);
    expect(split.train.filter(i => split.test.includes(i))).toHaveLength(0);
    expect(partitionRows(table, config)).toEqual(split);
  });
  test('temporal training precedes all test records including tied dates', () => {
    const split = partitionRows(table, { ...config, timeColumn: 'date' });
    const dates = (indices: number[]) => indices.map(i => Date.parse(table.rows[i]?.date ?? ''));
    expect(Math.max(...dates(split.train))).toBeLessThan(Math.min(...dates(split.test)));
  });
  test('entities never occur in both partitions', () => {
    const split = partitionRows(table, { ...config, groupColumn: 'entity' });
    const groups = new Set(split.test.map(i => table.rows[i]?.entity));
    expect(split.train.filter(i => groups.has(table.rows[i]?.entity))).toHaveLength(0);
  });
  test('ML evaluates the user rule on the real dataset', () => {
    const assessment = assessMl(table, summary, [{ id: 'positive', kind: 'min', column: 'signal', min: 10, critical: true }], config);
    expect(assessment.quality.results[0]?.failed).toBe(table.rows.filter(r => r.signal < 10).length);
    expect(assessment.blockers.length).toBeGreaterThan(0);
  });
});