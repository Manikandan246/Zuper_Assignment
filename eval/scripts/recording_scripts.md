# STT Evaluation — Recording Scripts

You will record 10 short audio clips reading these scripts. Aim for natural technician-on-roof delivery. Keep your phone or laptop microphone ~6-12 inches away — closer than a podcast mic, further than direct mouth contact. Record each as a separate file in `eval/clips/`.

## Setup

- Use your phone's voice memo app, or QuickTime on Mac (File → New Audio Recording).
- Save as WAV or M4A. Filename must match the clip ID exactly (e.g. `clip01_clean_baseline.m4a`).
- Speak naturally. Mistakes during reading are fine — they make the eval more realistic. Just don't restart the clip; keep the mistake.
- Target duration: 25–40 seconds per clip.

## The 10 clips

### `clip01_clean_baseline.m4a` — Indoor, quiet
> "Onsite at the Pereira job. I'm seeing lifted shingles near the ridge on the south slope. The bathroom vent boot has visible rust at the collar, looks like the prior caulk has cracked. No active dripping but the decking around the vent shows discoloration. Roof is fourteen years old, asphalt three-tab. Recommending we pull the vent boot and inspect underneath before deciding repair versus partial reroof."

### `clip02_clean_terminology_dense.m4a` — Indoor, quiet
> "Quick walk of the roof. Drip edge is fine. Step flashing along the chimney looks intact, but I'm noticing significant granule loss in the valley where it transitions to the ridge cap. Underlayment may be exposed. The ice and water shield on the eaves is past its service life. Soffit and fascia look okay from below but I'd want to check from the attic side."

### `clip03_outdoor_with_traffic.m4a` — Outdoors, near a road if possible
> "I'm on the back slope. Three damaged shingles directly above the bay window, looks like wind lift, not impact. The pipe boot here was replaced in the last visit, that one's holding fine. But the next vent over, the collar has separated from the flange. That's the most likely water entry point given the stain location below."

### `clip04_outdoor_wind_or_fan.m4a` — Outdoors with wind, or with a fan blowing nearby
> "Wind's picking up so I'm going to wrap this up. Ridge cap shingles are flapping on the east side. I count six that are loose. Two on the west. There's also a section of valley flashing that doesn't look properly sealed. Going to come down and finish the rest of the inspection from inside the attic."

### `clip05_indian_english_natural.m4a` — Read in your natural Indian English accent
> "Customer mentioned that the leak appears only after heavy rain, not during light rain or drizzle. That suggests the entry point is a small breach that only floods under high water volume. Could be the vent boot, could be the ridge vent gasket, could be a hairline crack in step flashing. I'm going to mark four areas to test with a hose."

### `clip06_partial_interrupted.m4a` — Quiet, but stop mid-sentence
> "Okay so I just got up here and the first thing I want to call out is — hold on, let me grab my — okay. The first thing is the vent boot is definitely failing. The rubber collar has a tear about half an inch long. I don't know if I can patch it or if we need a full — let me check the part number."

### `clip07_quiet_but_proper_names.m4a` — Quiet
> "Customer is Linda Pereira, address four-one-two-seven Cedar Lane, Worthington. Asset is a residential pitched roof, fourteen years old, asphalt three-tab. Prior visits by Carlos Mendez, dates September twelfth and December fourth, twenty twenty-five."

### `clip08_quiet_homeowner_audible.m4a` — Quiet, but speak in two voices, simulating homeowner faintly in background
> Background (your normal voice, faint): "So is the whole roof gonna need replacing?"
> Foreground (technician voice, clear): "She's asking about full replacement. I'm not ready to commit to that. We've got localized failures around two penetrations and some lifted ridge cap. I'd say we have a real repair option here, but I want to inspect the attic side first before I tell her anything."

### `clip09_short_command_style.m4a` — Quiet, terse
> "Vent boot. Failed. Two cracked shingles, ridge. One missing nail, drip edge. Need new pipe boot, color black, three-inch. Sealant. Schedule follow-up if leak continues after fix."

### `clip10_long_narrative.m4a` — Quiet, longer
> "So summarizing the inspection: the recurring leak appears to be a combination of two failures, not one. The bathroom vent boot, which Carlos previously caulked, has now developed an actual material failure — the rubber collar has cracked and torn. Caulking won't fix it; we need to replace the boot. Separately, the ridge cap on the north slope has six lifted shingles, likely due to wind events over the past winter. That ridge issue is a secondary water entry path and may have been contributing all along. Recommendation to the homeowner: replace the vent boot today if I have the part, address the ridge cap on a follow-up visit, monitor for one rain event before considering broader replacement. Roof is fourteen years old so we should also have the conversation about service life, but I don't want to push replacement when targeted repair is reasonable."

## Reference transcript file format

For each clip, the verbatim text above is the **reference transcript**. The eval harness will compare each STT provider's output against the reference and compute Word Error Rate (WER). Reference transcripts are stored in `eval/scripts/references.json` — already populated for you.
