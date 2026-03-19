# Audio Folder

Drop your game audio files in this folder. The game will try to load these filenames automatically, and if a file is missing it will simply stay silent for that sound.

## Supported filenames

- `background-music.mp3`
  Looping background music for gameplay.
- `player-shoot.mp3`
  Player basic shot sound.
- `dash.mp3`
  Dash skill sound.
- `snare.mp3`
  Q snare skill sound.
- `burst.mp3`
  E burst skill sound.
- `ultimate.mp3`
  R ultimate sound.
- `ultimate-explosion.mp3`
  Played on every ultimate pulse.
- `player-hit.mp3`
  Sound when the player takes damage.
- `player-get-buff.mp3`
  Played when the player picks up a buff or extra life.
- `enemy-die.mp3`
  Played when an enemy or boss dies.
- `lose.mp3`
  Played when the run ends in a loss.
- `explosion.mp3`
  Enemy or ship explosion sound.

## Notes

- `.mp3` is the default expected format right now.
- Audio usually starts only after a keyboard press or mouse click because browsers block autoplay until the player interacts with the page.
