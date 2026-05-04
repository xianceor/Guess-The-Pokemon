# Who's That Pokémon? Game

A browser-based guessing game inspired by the classic "Who's That Pokémon?" format. The player chooses a difficulty, game mode, and input style, then identifies Pokémon from hidden silhouettes.

![Who's That Pokémon preview](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjFuMzcxZHpidjByNHVqaGU3NGJ2aGduZmt4MXQxdGlnbHRlcHB0bSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Ssts7rvD7E01O/giphy.gif)

## Features

- Difficulty options for Gen 1, Gen 1-4, and all supported Pokémon.
- Classic, Speed Run, and Survival game modes.
- Typed answer and multiple choice input styles.
- Score, streak, timer, lives, and end-game summary screens.
- Local leaderboard saved in the browser with `localStorage`.
- Retro-style menu animation and generated chiptune background music.
- Pokémon data loaded from the public PokeAPI.

## Project Structure

```text
Guess-the-pokemon/
|-- README.md
|-- whos_that_pokemon_game.html
`-- assets/
    |-- audio/
    |-- css/
    |   `-- styles.css
    |-- images/
    `-- js/
        `-- game.js
```

## Requirements

- A modern web browser.
- Internet access for PokeAPI, Google Fonts, the menu wallpaper, and the Pokémon logo.
- No package installation is required.

## How to Run

Open `whos_that_pokemon_game.html` directly in a browser.

If your browser blocks any network request from a local file, run a local server from the project folder:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/whos_that_pokemon_game.html
```

## Files

- `whos_that_pokemon_game.html` contains the page structure.
- `assets/css/styles.css` contains all visual styles and animations.
- `assets/js/game.js` contains game state, API calls, scoring, leaderboard logic, and generated music.
- `assets/images/` is reserved for local image files.
- `assets/audio/` is reserved for local audio files.

## Notes

The game uses externally hosted image assets and API data. If the device is offline, the page may load but Pokémon data and external visuals may not appear correctly.

The background music is generated in the browser with Web Audio. It starts only after the first user interaction because browsers prevent audio from autoplaying.
