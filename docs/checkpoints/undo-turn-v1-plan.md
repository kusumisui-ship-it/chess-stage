# Undo turn v1 plan

Goal: reuse the former board-flip button as an `UNDO` control in CPU mode.

Behavior:

- White remains fixed at the bottom.
- If the CPU has already replied, undo the player's move and the CPU reply together.
- If the CPU is still thinking, undo only the player's latest move and cancel the pending CPU move.
- Rebuild the position from the starting FEN and retained move history.
- Clear selection, promotion, timers, and result overlays before rendering.
