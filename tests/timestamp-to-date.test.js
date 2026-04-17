import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import unixToDateTime from '../frontend/utils/timestamp-to-date.js';

// 时间戳到本地日期字符串的转换依赖运行时 locale + TZ。
// 这里尽量用格式宽松的断言（正则），避免 CI 环境 locale 差异导致假失败。
describe('unixToDateTime(timestamp)', () => {
  it('accepts a numeric timestamp and returns a non-empty string', () => {
    const out = unixToDateTime(1704067200000); // 2024-01-01 UTC
    assert.equal(typeof out, 'string');
    assert.ok(out.length > 0);
  });

  it('accepts a numeric-string timestamp (coerced via Number())', () => {
    const out = unixToDateTime('1704067200000');
    assert.equal(typeof out, 'string');
    assert.ok(out.length > 0);
  });

  it('output contains the year', () => {
    const epochYearZero = unixToDateTime(1704067200000); // 2024 boundary
    assert.ok(/2023|2024/.test(epochYearZero), `expected 2023 or 2024 in output, got "${epochYearZero}"`);
  });

  it('different timestamps produce different strings', () => {
    const a = unixToDateTime(1704067200000); // 2024
    const b = unixToDateTime(1767225600000); // 2026 UTC
    assert.notEqual(a, b);
  });
});
