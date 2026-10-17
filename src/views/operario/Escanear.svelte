<script>
  import Icono3D from '../../components/Icono3D.svelte';
  // Escanear área: foto del lugar + zona + tipo de limpieza → dosificación recomendada.
  // Los m² vienen del espacio que registró el administrador (con su croquis o a mano).
  import { fly } from 'svelte/transition';
  import Icono from '../../components/Icono.svelte';
  import { dur, tic } from '../../lib/movimiento.js';
  import { datos, espacioPorId } from '../../lib/nube.svelte.js';
  import { recomendar, TIPOS_LIMPIEZA, PRODUCTOS, RECIPIENTES } from '../../lib/catalogo.js';
  import { RECIPIENTE_3D } from '../../lib/ui.js';

  let { params = {} } = $props();

  let espacioId = $state(params.e ?? null);
  let tipo = $state('diaria');
  let foto = $state(null);
  let eligiendo = $state(!params.e);

  const espacio = $derived(espacioPorId(espacioId));
  const receta = $derived(espacio ? recomendar(espacio, tipo, datos.compartimentos) : null);

  function tomar(e) {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    if (foto) URL.revokeObjectURL(foto);
    foto = URL.createObjectURL(f);
  }
  $effect(() => () => foto && URL.revokeObjectURL(foto));

  const ml = (x) => (x >= 1000 ? `${+(x / 1000).toFixed(1)} L` : `${x} ml`);
  const litros = (x) => (x >= 1000 ? `${x / 1000} ${x === 1000 ? 'Litro' : 'Litros'}` : `${x} ml`);
  const continuar = $derived(
    receta?.compartimento ? `#op/dosificar?e=${espacioId}&tl=${tipo}${params.t ? `&t=${params.t}` : ''}` : null
  );
</script>

<div class="escanear">
  <div>
    <h1 class="titulo">{espacio ? 'Área escaneada' : '¿Qué área?'}</h1>
  </div>

  <label class="foto" class:con-foto={foto}>
    <input type="file" accept="image/*" capture="environment" onchange={tomar} />
    {#if foto}
      <img src={foto} alt="Foto del área" />
    {:else}
      <span class="foto-vacia"><Icono nombre="camara" size={34} trazo={1.8} /> Tomar foto del área</span>
    {/if}
    {#if espacio}<span class="m2">{espacio.area_m2} m²</span>{/if}
  </label>

  {#if eligiendo || !espacio}
    <div class="zonas">
      {#each datos.espacios as e (e.id)}
        <button class="zona-op" class:elegida={espacioId === e.id} onclick={() => { espacioId = e.id; eligiendo = false; }}>{e.nombre}</button>
      {:else}
        <p class="vacio">No hay zonas registradas. Pide al administrador que las cree.</p>
      {/each}
    </div>
  {:else}
    <button class="zona" onclick={() => (eligiendo = true)}>
      <Icono nombre="lugar" size={26} trazo={2} />
      <span class="z-texto"><small>Zona</small><strong>{espacio.nombre}</strong></span>
      <span class="z-m2">{espacio.area_m2} m²</span>
      <span class="cambiar">Cambiar</span>
    </button>

    <p class="sub">Tipo de limpieza</p>
    <div class="tipos" role="radiogroup" aria-label="Tipo de limpieza">
      {#each Object.entries(TIPOS_LIMPIEZA) as [k, t]}
        <button class="tipo" class:elegido={tipo === k} role="radio" aria-checked={tipo === k} onclick={() => { tic(); tipo = k; }}>
          <Icono3D nombre={{ diaria: 'brillo', profunda: 'burbujas', desinfeccion: 'escudo' }[k]} size={30} />
          <span>{t.nombre}</span>
        </button>
      {/each}
    </div>

    <p class="sub">Dosificación recomendada</p>
    {#if receta.compartimento}
      {#key tipo}
      <div class="dosis" in:fly={{ y: 10, duration: dur(240) }}>
        <div class="cifra rosa"><Icono3D nombre="botella" size={34} /><span><small>Producto</small><strong>{ml(receta.ml_producto)}</strong></span></div>
        <div class="cifra azul"><Icono3D nombre="gota" size={34} /><span><small>Agua</small><strong>{ml(receta.ml_agua)}</strong></span></div>
      </div>
      <div class="total">
        <Icono3D nombre={RECIPIENTE_3D[receta.recipiente]} size={36} />
        <span><small>{`Total en ${RECIPIENTES[receta.recipiente].nombre.toLowerCase()} con ${PRODUCTOS[receta.productoId].nombre}`}</small><strong>{litros(receta.total_ml)}{receta.cargas > 1 ? ` × ${receta.cargas}` : ''}</strong></span>
      </div>
      {/key}
    {:else}
      <p class="falta">No hay {receta.falta.toLowerCase()} cargado. Cárgalo en <a href="#op/config">Configuración</a>.</p>
    {/if}

    <a class="boton verde continuar" class:inactivo={!continuar} href={continuar ?? undefined} aria-disabled={!continuar}>
      Continuar a dosificación <Icono nombre="flecha" size={22} trazo={2.2} />
    </a>
  {/if}
</div>

<style>
  .escanear { height: 100%; display: flex; flex-direction: column; gap: 10px; }
  .foto {
    position: relative; flex: 1 1 140px; min-height: 96px; max-height: 210px; overflow: hidden; display: grid; place-items: center; cursor: pointer;
    border-radius: var(--radio-tarjeta); background: var(--superficie-2); border: 2px dashed var(--linea-fuerte);
  }
  .foto.con-foto { border: 0; }
  .foto input { position: absolute; opacity: 0; width: 0; height: 0; }
  .foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .foto-vacia { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--tinta-suave); font-weight: 700; }
  .m2 { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 8px 14px; border-radius: 10px; background: var(--blanco); font-weight: 700; font-size: 1.1rem; box-shadow: var(--sombra); }
  .foto:not(.con-foto) .m2 { top: auto; bottom: 10px; transform: translateX(-50%); }

  .zonas { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 8px; }
  .zona-op { height: 44px; padding: 0 14px; border: 1.5px solid var(--linea-fuerte); border-radius: 999px; background: var(--blanco); font-weight: 700; cursor: pointer; }
  .zona-op.elegida { border-color: var(--verde-marca); background: var(--t-verde); }
  .vacio { margin: 0; color: var(--tinta-suave); }

  .zona {
    flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 14px; cursor: pointer; text-align: left;
    border: 1px solid var(--linea); border-radius: var(--radio); background: var(--blanco); color: var(--azul);
  }
  .z-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; color: var(--tinta); }
  .z-texto small { font-size: 0.8rem; color: var(--tinta-suave); }
  .z-texto strong { font-size: 1.15rem; font-weight: 700; }
  .z-m2 { color: var(--tinta-suave); font-weight: 500; }
  .cambiar { font-size: 0.85rem; font-weight: 700; }

  .sub { flex: none; margin: 2px 0 0; font-weight: 700; font-size: 1rem; }
  .tipos { flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .tipo {
    height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer;
    border: 1.5px solid var(--linea); border-radius: var(--radio); background: var(--blanco); color: var(--tinta-suave); font-weight: 700; font-size: 0.82rem;
  }
  .tipo { transition: transform 0.12s ease, background 0.15s ease; }
  .tipo:active { transform: scale(0.95); }
  .tipo.elegido { border: 2px solid var(--verde-marca); background: var(--t-verde); color: var(--verde-oscuro); }

  .dosis { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .cifra, .total { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radio); }
  .cifra span, .total span { display: flex; flex-direction: column; }
  .cifra small, .total small { font-size: 0.82rem; color: var(--tinta-suave); }
  .cifra strong { font-size: 1.5rem; font-weight: 700; line-height: 1.1; }
  .rosa { background: var(--t-rosa); color: var(--i-rosa); }
  .azul { background: var(--t-azul); color: var(--i-azul); }
  .rosa strong { color: #B8285A; }
  .azul strong { color: var(--azul-oscuro); }
  .total { flex: none; justify-content: center; background: var(--t-azul); color: var(--i-azul); }
  .total strong { font-size: 1.3rem; font-weight: 700; color: var(--tinta); }
  .falta { flex: none; margin: 0; padding: 12px; border-radius: var(--radio); background: var(--t-rojo); color: #8A1F1F; font-weight: 500; }

  .continuar { flex: none; width: 100%; height: 56px; margin-top: auto; }
  .continuar.inactivo { opacity: 0.4; pointer-events: none; }
</style>
