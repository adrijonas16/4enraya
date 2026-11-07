# Diseño

Idea: un juego de mesa de verdad sobre una mesa de noche. El tablero de plástico con las fichas detrás de la placa es el protagonista; todo lo demás (paneles de cristal, fondo con luces) acompaña y no compite.

## Color (`css/variables.css`)

| Token | Valor | Uso |
| --- | --- | --- |
| `--felt` / `--felt-deep` / `--felt-light` | `#173a40` / `#0f2a2f` / `#22525a` | Mesa y fondos de hojas |
| `--cobalt`, `--cobalt-hi`, `--cobalt-lo` | `#1f4fd8`, `#3c6cf0`, `#12319a` | Plástico del estilo Clásico y logo |
| `--red`, `--red-hi`, `--red-lo` | `#e5342a`, `#ff8a74`, `#8f150f` | Jugador rojo |
| `--amber`, `--amber-hi`, `--amber-lo` | `#f5b915`, `#ffe58a`, `#a76d00` | Jugador amarillo y acción principal |
| `--bone`, `--bone-dim` | `#f1ebdd`, `#b9c4bf` | Texto y texto secundario |
| `--ink` | `#1b1a17` | Texto sobre ámbar y cinta de peligro |
| `--ice`, `--danger`, `--ok` | `#bfe6ff`, `#ff6b5e`, `#7fe3a2` | Hielo, errores, conectado |
| `--mood` | rojo o ámbar según el turno | Luz de ambiente del fondo y del tablero |

Rojo y amarillo nunca cambian de significado entre estilos de tablero: siempre son los dos jugadores.

## Tipografía

- **Archivo** variable, incluida en `fonts/` (pesos 100–900, ancho 62–125 %). Una sola familia; el carácter sale del ancho.
- Titulares y números grandes: ancho 62 %, peso 850–900 (`4 en raya`, marcador, nombre del evento).
- Interfaz: ancho 75–88 %, peso 700–800 (botones, nombres).
- Texto: ancho normal, peso 400–600.
- Escala: `--step--1` 0,8125 rem · `--step-0` 1 rem · `--step-1` 1,25 · `--step-2` 1,5625 · `--step-3` 1,953 · `--step-4` 2,441 · `--step-5` 3,052.

## Forma

- Radios: `--radius-s` 8 px (filas de lista), `--radius-m` 14 px (botones de poder, campos), `--radius-l` 22 px (paneles y hojas). Botones de acción: píldora.
- **Paneles de cristal:** degradado blanco muy suave + fondo oscuro translúcido + `backdrop-filter: blur(14px)` + borde interior de 1 px. Clase utilitaria `.glass`.
- Botón principal ámbar con «escalón» inferior (`box-shadow: 0 4px 0 var(--amber-lo)`); se hunde al pulsar.

## Movimiento

- Curvas: `--ease-out` para entradas, `--ease-spring` para confirmaciones (marcador, tarjetas).
- Lo que provoca el jugador se anima siempre: caída con rebote, deslizamiento, explosión, hielo, línea ganadora.
- Lo ambiental es lento y discreto: auroras de 40 s, fichas del fondo, brillo del tablero cada 9 s.
- Un solo momento llamativo a la vez: la cinta de peligro de los eventos.
- `prefers-reduced-motion`: animaciones casi instantáneas y fondo quieto.

## Estilos de tablero (`css/skins.css`)

Cada estilo es un bloque `[data-skin="id"]` que solo define variables; la forma del tablero es común:

| Variable | Qué pinta |
| --- | --- |
| `--sk-frame` | Marco exterior |
| `--sk-plate` | Placa con agujeros (se le aplica la máscara) |
| `--sk-hole`, `--sk-hole-shade` | Fondo de los agujeros vacíos |
| `--sk-rim-dark`, `--sk-rim-light`, `--sk-rim-w` | Sombra y brillo del borde de cada agujero |
| `--sk-hi`, `--sk-outline`, `--sk-edge` | Brillo superior, contorno y canto inferior |
| `--sk-feet` | Patas |
| `--sk-glow` | Luz en el suelo |
| `--sk-extra` | Sombra adicional opcional (resplandor de Neón o Lava) |

Reglas: buen contraste entre ficha y agujero vacío, y entre agujero y placa. Se pueden añadir efectos a las fichas solo con `filter` y solo dentro del estilo.

## Accesibilidad

- Contraste AA para texto. Foco visible ámbar de 3 px.
- Todo se puede jugar con teclado: `←` `→` apuntar, `Espacio`/`Enter` soltar, `1`–`4` poderes, `Esc` cancelar.
- El estado del turno se anuncia en una región `aria-live`.
- Objetivos táctiles de al menos 34 px.
