import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildViewportMetaContent,
  computeViewportScaleMetrics,
  parseCustomViewportWidth,
} from './viewportWidth';

test('parseCustomViewportWidth handles auto, empty, minimum 240, and unbounded high widths', () => {
  assert.equal(parseCustomViewportWidth(''), null);
  assert.equal(parseCustomViewportWidth('auto'), null);
  assert.equal(parseCustomViewportWidth('0'), null);
  assert.equal(parseCustomViewportWidth(120), 240);
  assert.equal(parseCustomViewportWidth('390'), 390);
  assert.equal(parseCustomViewportWidth('2400dp'), 2400);
  assert.equal(parseCustomViewportWidth(9999), 9999);
});

test('computeViewportScaleMetrics computes exact zoom & effective height for wide developer widths', () => {
  const autoMetrics = computeViewportScaleMetrics({
    customWidth: null,
    nativeWidth: 1440,
    nativeHeight: 900,
  });
  assert.equal(autoMetrics.isActive, false);
  assert.equal(autoMetrics.scale, 1);
  assert.equal(autoMetrics.effectiveHeight, 900);

  const wideMetrics = computeViewportScaleMetrics({
    customWidth: 2400,
    nativeWidth: 1200,
    nativeHeight: 800,
  });
  assert.equal(wideMetrics.isActive, true);
  assert.equal(wideMetrics.customWidth, 2400);
  assert.equal(wideMetrics.scale, 0.5);
  assert.equal(wideMetrics.effectiveHeight, 1600);
});

test('buildViewportMetaContent builds device-width when null and explicit px width when active', () => {
  assert.equal(buildViewportMetaContent(null), 'width=device-width, initial-scale=1.0');
  assert.equal(buildViewportMetaContent(2400), 'width=2400, initial-scale=1.0');
});
