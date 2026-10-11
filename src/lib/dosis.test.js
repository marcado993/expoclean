import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularDosis } from './dosis.js';

test('piso de 100 m² normal: 5 L de solución a 1:100', () => {
  const d = calcularDosis({ area_m2: 100, superficie: 'piso', suciedad: 'normal' });
  assert.equal(d.cargas, 1);
  assert.equal(d.porCarga.quimico_ml, 49.5);
  assert.equal(d.porCarga.agua_ml + d.porCarga.quimico_ml, 5000);
});

test('área pequeña usa el mínimo del recipiente', () => {
  const d = calcularDosis({ area_m2: 2, superficie: 'piso' });
  assert.equal(d.porCarga.agua_ml + d.porCarga.quimico_ml, 3000);
});

test('área grande se divide en varias cargas que caben en el balde', () => {
  const d = calcularDosis({ area_m2: 400, superficie: 'piso' });
  assert.equal(d.cargas, 3);
  assert.ok(d.porCarga.agua_ml + d.porCarga.quimico_ml <= 8000);
});

test('más suciedad = más concentrado, mismo volumen', () => {
  const a = calcularDosis({ area_m2: 50, superficie: 'bano', suciedad: 'ligera' });
  const b = calcularDosis({ area_m2: 50, superficie: 'bano', suciedad: 'pesada' });
  assert.ok(b.porCarga.quimico_ml > a.porCarga.quimico_ml);
  assert.equal(a.porCarga.agua_ml + a.porCarga.quimico_ml, b.porCarga.agua_ml + b.porCarga.quimico_ml);
});

test('rechaza área inválida', () => {
  assert.throws(() => calcularDosis({ area_m2: 0, superficie: 'piso' }));
});

test('sanitarios van en botella de 1 L, vidrios en chisguete', () => {
  const s = calcularDosis({ area_m2: 20, superficie: 'sanitario', suciedad: 'pesada' });
  assert.equal(s.recipiente, 'botella');
  assert.equal(s.porCarga.agua_ml + s.porCarga.quimico_ml, 500);
  assert.equal(calcularDosis({ area_m2: 8, superficie: 'vidrio' }).recipiente, 'spray');
});
