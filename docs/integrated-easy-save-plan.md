# Integrated EASY CPU save refactor

The temporary play-v2/v3/v4 wrappers exposed timing and nested-iframe cache problems on iOS.

The next implementation moves the following directly into `easy.html` so only one iframe remains:

- EASY/NORMAL toggle
- last-move highlight
- short move history
- captured-piece display
- local W/L/D record
- one-turn undo
- local game auto-save and restore
- visible SAVE READY / SAVED / RESTORED state

Rollback point before this refactor: `checkpoint/save-v3-failed`.
