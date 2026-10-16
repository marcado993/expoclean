import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stock, porEspacio, porOperario, operarioMasLibre } from './traza.js';
import { semanaDeEjemplo, OPERARIOS } from './semilla.js';
import { mlProducto } from './catalogo.js';

const AHORA = new Date('2026-10-16T18:00:00Z').getTime();
const reg = (operarioId, espacioId, productoId, ml, dia = 0) => ({
  operarioId, espacioId, productoId, ml_producto: ml, estado: 'hecha',
  fecha: new Date(AHORA - dia * 86400000).toISOString(),
});

test('stock marca vacío, por acabarse y sin producto', () => {
  const s = stock([
    { producto: 'cloro5', nivel_ml: 4000, capacidad_ml: 5000 },
    { producto: 'desengr', nivel_ml: 500, capacidad_ml: 5000 },
    { producto: 'neutro', nivel_ml: 0, capacidad_ml: 5000 },
    { producto: null, nivel_ml: 0, capacidad_ml: 5000 },
  ]);
  assert.deepEqual(s.map((x) => x.estado), ['ok', 'bajo', 'vacio', 'sin']);
});

test('porOperario detecta quien gasta de más y quien se queda corto', () => {
  const ops = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const rs = [
    reg('a', 'e1', 'cloro5', 100), reg('a', 'e2', 'cloro5', 100),
    reg('b', 'e1', 'cloro5', 100), reg('b', 'e1', 'cloro5', 100), reg('b', 'e2', 'cloro5', 200), // 200 por limpieza
    reg('c', 'e1', 'cloro5', 40), reg('c', 'e2', 'cloro5', 40),
  ];
  const f = Object.fromEntries(porOperario(rs, ops, { ahora: AHORA }).map((x) => [x.operario.id, x.veredicto]));
  assert.deepEqual(f, { a: 'normal', b: 'mucho', c: 'poco' });
});

test('porEspacio avisa qué espacios se quedaron sin su producto', () => {
  const comps = [
    { producto: 'cloro5', nivel_ml: 4000, capacidad_ml: 5000 },
    { producto: 'vidrios', nivel_ml: 0, capacidad_ml: 5000 },
  ];
  const espacios = [{ id: 'e1' }, { id: 'e2' }];
  const r = porEspacio([reg('a', 'e1', 'cloro5', 100), reg('a', 'e2', 'vidrios', 50)], espacios, comps, { ahora: AHORA });
  assert.deepEqual(r.find((x) => x.espacio.id === 'e2').sinProducto, ['vidrios']);
  assert.deepEqual(r.find((x) => x.espacio.id === 'e1').sinProducto, []);
});

test('porEspacio ignora dosis de hace más de 7 días', () => {
  const r = porEspacio([reg('a', 'e1', 'cloro5', 100, 10)], [{ id: 'e1' }], [], { ahora: AHORA });
  assert.equal(r[0].ml, 0);
});

test('operarioMasLibre elige al que tiene menos tareas pendientes', () => {
  const ops = [{ id: 'a' }, { id: 'b' }];
  const t = [{ operarioId: 'a', estado: 'pendiente' }, { operarioId: 'b', estado: 'hecha' }];
  assert.equal(operarioMasLibre(ops, t).id, 'b');
});

test('la semana de ejemplo muestra a Luis gastando de más y a Carmen corta', () => {
  const v = Object.fromEntries(porOperario(semanaDeEjemplo(AHORA), OPERARIOS, { ahora: AHORA }).map((x) => [x.operario.nombre, x.veredicto]));
  assert.equal(v['Luis Guamán'], 'mucho');
  assert.equal(v['Carmen Andrade'], 'poco');
});

test('mlProducto respeta la dilución y sirve poco aceite puro', () => {
  assert.equal(mlProducto('cloro5', 'balde'), Math.round(8000 / 51));
  assert.equal(mlProducto('aceite', 'balde'), 250);
});
