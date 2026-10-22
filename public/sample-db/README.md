# Sample DB: real photos, videos and audio for the demo

Drop your own files here and the web demo will show them instead of the
placeholder artwork. Everything in this folder is served by the app at
`/sample-db/...`. Use only photos, voices and videos you are allowed to share
(your own or from friends who agreed).

## How it works (3 steps)

1. **Name each file after the memory it belongs to** (table below) and put it in
   the matching folder.
2. Run `npm run sample-db` in the project folder. It writes `manifest.json`.
3. Refresh the page (`http://localhost:3000/app`).

No restart is needed. Memories without a file keep their placeholder.

## Folders

| Folder     | What goes in it                                                    | File types           |
| ---------- | ------------------------------------------------------------------ | -------------------- |
| `photos/`  | Photos. Also the cover image for a video (same name as the video). | jpg, jpeg, png, webp |
| `videos/`  | Short videos (aim for under 30 seconds and under 20 MB)            | mp4, webm, mov       |
| `audio/`   | Voice notes (aim for under 1 minute)                               | mp3, m4a, wav, ogg   |
| `avatars/` | Profile pictures for the demo people                               | jpg, jpeg, png, webp |

## File names to use

Name = the memory id, plus the right extension. Example: `photos/m-pier.jpg`.

| Memory id   | Zine                          | Type  | Title                 | Put it in                                         |
| ----------- | ----------------------------- | ----- | --------------------- | ------------------------------------------------- |
| `m-pier`    | Our First Year Away From Home | photo | Sunset on the pier    | `photos/`                                         |
| `m-boxes`   | Our First Year Away From Home | photo | Move-in day boxes     | `photos/`                                         |
| `m-voice`   | Our First Year Away From Home | voice | Last summer together  | `audio/`                                          |
| `m-beach`   | Our First Year Away From Home | video | Beach laughs          | `videos/` (+ optional cover `photos/m-beach.jpg`) |
| `m-kitchen` | Our First Year Away From Home | photo | Dorm kitchen disaster | `photos/`                                         |
| `m-bus`     | Our First Year Away From Home | photo | Night bus home        | `photos/`                                         |
| `m-library` | Our First Year Away From Home | photo | Library at 2am        | `photos/`                                         |
| `m-neon`    | Neon Summer Tour              | photo | Neon underpass        | `photos/`                                         |
| `m-crowd`   | Neon Summer Tour              | photo | Front row             | `photos/`                                         |

Stories (`m-home`, `m-setlist`) are text, so they have no file.

People (profile pictures), in `avatars/`:

| File name     | Person      |
| ------------- | ----------- |
| `p-maya.jpg`  | Maya Chen   |
| `p-leo.jpg`   | Leo Okafor  |
| `p-priya.jpg` | Priya Raman |
| `p-sam.jpg`   | Sam Rivera  |

## Tips

- Photos look best at roughly 4:5 (portrait) or 4:3. Anything works, it is cropped to fit.
- Keep each file under 10 MB. GitHub rejects files over 100 MB, so keep videos short.
- Use `npm run sample-db -- --list` to see what was found without writing anything.
- To go back to placeholders, delete the files and run `npm run sample-db` again.
- This is demo data. Nothing here is encrypted or protected.

## Sharing these files with the team

The photos, videos, audio and avatars are **ignored by git on purpose** (personal
media, and large files slow every clone). Share the folder contents through a
drive or chat, and have each teammate drop them into the same folders and run
`npm run sample-db`. Only this README and the `.gitkeep` placeholders are committed.
