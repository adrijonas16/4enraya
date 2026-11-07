# 4 en Raya

El clásico conecta cuatro para el navegador, con poderes, eventos de caos por sorpresa, una IA con tres niveles, siete estilos de tablero, amigos y partidas online. Funciona en computador y en celular.

**Jugar:** https://4enraya-steel.vercel.app

## Instalar

Requisitos: [Node.js](https://nodejs.org) 22 o superior.

```bash
git clone https://github.com/adrijonas16/4enraya.git
cd 4enraya
npm install
```

## Ejecutar en local

```bash
npm start
```

Abre http://localhost:8080. Para jugar sin cuenta, pulsa **Jugar como invitado**.

## Probar

```bash
npx playwright install chromium   # solo la primera vez
npm run check                     # lint, pruebas del motor y pruebas en el navegador
```

## Cómo se juega

- Toca una columna para soltar tu ficha. Gana quien conecte cuatro en horizontal, vertical o diagonal.
- Cada turno ganas una carga. Antes de tirar puedes gastarlas en un poder: ❄️ Hielo, 🌊 Ola, 💣 Bomba o ⚡ Doble.
- De vez en cuando ocurre un evento de caos por sorpresa: remolino, terremoto, meteorito…
- En la portada eliges: contra la IA, dos jugadores en el mismo dispositivo u online con un amigo (crea una sala y pásale el código).
- En el computador también puedes jugar con el teclado: `←` `→` para apuntar, `Espacio` para soltar y `1`–`4` para los poderes.

Para cambiar el código, empieza por [`CONTRIBUTING.md`](CONTRIBUTING.md).
