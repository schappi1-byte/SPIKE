# SPIKE status

The original Figma screens are saved in `archive/original-figma-ui`. Copy those files back over the project root to restore that UI. See `archive/original-figma-ui/RESTORE.txt`.

## Works locally

- Landing, coach workspace, and player workspace share one roster.
- Saving an evaluation updates that athlete's rating, feedback, history, and training plan.
- Completing an exercise updates training progress for the current evaluation cycle.
- Lineups can be edited, saved, reloaded, and deleted. The court draft is kept in the browser.
- Suggest placement ranks athletes by the skill each spot needs.

## Simulated

- Gemini is not connected. Training priorities are rules based on saved ratings.
- Snowflake is not connected. History is local.
- MediaPipe is not connected. There is no camera or pose tracking.
- The lineup optimizer is not connected. Suggest placement is not an optimizer result.

## Persistence

Player records, evaluations, completed exercises, and lineups are stored in `localStorage` under `spike-athlete-store-v1`.

## Still needed

Gemini API credentials, a Snowflake connection, a MediaPipe capture workflow, and a lineup optimizer endpoint are not configured.
