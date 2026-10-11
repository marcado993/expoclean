import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarLugar, interpretarLugar, detectarSuperficie } from './intencion.js';

const AREAS = [
  { id: 'a1', nombre: 'Baño 1er piso', superficie: 'bano' },
  { id: 'a5', nombre: 'Baño 2do piso', superficie: 'bano' },
  { id: 'a2', nombre: 'Pasillo central', superficie: 'piso' },
  { id: 'a6', nombre: 'Recepción', superficie: 'piso' },
  { id: 'a3', nombre: 'Ventanas lobby', superficie: 'vidrio' },
  { id: 'a4', nombre: 'Comedor', superficie: 'mesa' },
];

const primero = (t) => buscarLugar(t, AREAS);

test('entiende el piso por número hablado', () => {
  const r = primero('voy a limpiar el baño del segundo piso');
  assert.equal(r.candidatos[0].area.id, 'a5');
  assert.ok(r.seguro);
});

test('sin tildes y con sinónimos', () => {
  assert.equal(primero('los sanitarios del primer piso').candidatos[0].area.id, 'a1');
  assert.equal(primero('me toca la recepcion').candidatos[0].area.id, 'a6');
  assert.equal(primero('limpiar las ventanas').candidatos[0].area.id, 'a3');
});

test('"baño" a secas no es seguro: hay dos', () => {
  const r = primero('el baño');
  assert.equal(r.seguro, false);
  assert.equal(r.candidatos.length, 2);
});

test('"segundo piso" no se confunde con tipo piso', () => {
  assert.equal(detectarSuperficie('baño del segundo piso'), 'bano');
  assert.equal(detectarSuperficie('trapear el piso'), 'piso');
});

test('nada que ver → sin candidatos', () => {
  assert.equal(primero('hola buenos días').candidatos.length, 0);
});

test('supervisor dicta un lugar nuevo', () => {
  assert.deepEqual(interpretarLugar('Baño del segundo piso, 25 metros, muy sucio'), {
    area_m2: 25, suciedad: 'pesada', superficie: 'bano', nombre: 'Baño del segundo piso',
  });
  const v = interpretarLugar('ventanas de la entrada 40 m2');
  assert.equal(v.area_m2, 40);
  assert.equal(v.superficie, 'vidrio');
  assert.equal(v.nombre, 'Ventanas de la entrada');
});
