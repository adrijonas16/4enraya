---
name: agregar-evento
description: Añadir o cambiar un evento de caos (remolino, terremoto, meteorito…), o cambiar cuándo ocurren. Úsala cuando pidan eventos nuevos o ajustar su frecuencia.
---

# Añadir un evento de caos

Los eventos son una sorpresa: **nunca se anuncian** antes de ocurrir. El motor sortea cuál ocurre en el momento (`rollEvent`) y la espera entre eventos es aleatoria (`eventGap`).

## Pasos

1. **Definición** en `js/engine.js`, objeto `EVENTS`:
   ```js
   tornado: { icon: '🌪', name: 'Tornado', desc: 'Lo que pasa, en una frase.' },
   ```
   `name` y `desc` salen en la cinta amarilla y negra cuando ocurre.
2. **Efecto** en `applyEvent(s, id)`, con un bloque `if (id === 'tornado') { … }`:
   - Termina siempre con `settle(s)` si mueves fichas.
   - Las fichas quitadas van a `info.removed` (con `r` y `c`) para que exploten.
   - Las columnas afectadas, en `info.cols`. Datos extra para la animación, en `info` (como `info.center` del meteorito).
   - Todo lo que guardes en `info` viaja al rival: datos pequeños y serializables.
3. **Animación** en `App.playEventEffects` (`js/components/game.js`): sonido (`sound.play`), sacudida del tablero (`v.jolt`) y partículas si encaja.
4. **Fondo** en `Scene.storm(id)` (`js/scene.js`): destello (`white`, `ice`, `fire`), remolino (`this.swirl`) o temblor.
5. **Pruebas:** la prueba «deja todas las fichas apoyadas» de `tests/unit/engine.test.js` recorre todos los eventos sola. Si el evento quita o añade fichas, añádelo a la excepción del recuento y comprueba la cantidad esperada.
6. **Documentación:** el evento aparece solo en el motor; si cambias la frecuencia (`eventGap`), actualiza la descripción de los mapas en `MAPS` y las pruebas del rango.

## Comprobar

- `npm run check`
- Fuerza el evento a mano en la consola para verlo: `app.state.nextEventAt = app.state.moves + 1` y tira; o llama `Engine.applyEvent(app.state, 'tornado')` y `app.view.render(app.state)`.
- No dejes ningún texto que revele el próximo evento.
