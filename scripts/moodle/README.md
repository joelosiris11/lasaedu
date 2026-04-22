# Moodle → lasaedu importer

Converts the Moodle `lasaedu_db.sql` dump into lasaedu Firestore documents
(courses, modules, lessons, sections). No users, quiz attempts, submissions,
or grades are imported.

## 1. Load the dump

```bash
docker run -d --name moodle-import -p 3307:3306 \
  -e MYSQL_ROOT_PASSWORD=moodle -e MYSQL_DATABASE=moodle \
  mariadb:11.4

# Wait ~10s for it to boot, then:
mysql -h 127.0.0.1 -P 3307 -uroot -pmoodle --default-character-set=utf8mb4 \
  moodle < lasaedu_db.sql
```

The dump declares `utf8mb4` but its string bytes are Latin1 — the importer
fixes that automatically by connecting with `charset: 'latin1'` and calling
`Buffer.from(str, 'binary').toString('utf8')` on every field.

## 2. Install deps

```bash
npm i --save-dev mysql2
```

`firebase-admin` is already a project dep.

## 3. Env vars

| Var | Required | Purpose |
|---|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | yes | Path to the Firebase Admin SA JSON |
| `INSTRUCTOR_EMAIL` | no | Defaults to `a.rosario@t-ecogroup.net` |
| `MOODLE_DB_HOST` / `PORT` / `USER` / `PASS` / `NAME` | no | Defaults to the docker command above (`127.0.0.1:3307`, `root`/`moodle`, db=`moodle`) |
| `MOODLE_TABLE_PREFIX` | no | Defaults to `mdlsv_` |
| `FILE_SERVER_URL` | yes for file migration | e.g. `https://files.lasaedu.cloudteco.com` |
| `FILE_SERVER_TOKEN` | no | Bearer token if the file server requires auth |
| `MOODLEDATA_DIR` | one of these | Path to a mirror of the Moodle `filedir/` tree |
| `MOODLE_WWWROOT` + `MOODLE_WS_TOKEN` | one of these | Alternative: pull files via `pluginfile.php` + web service token |
| `DRY_RUN=1` | no | Print the plan, write nothing to Firestore |
| `MOODLE_IMPORT_WARNINGS` | no | Path for the warnings log (default `./moodle-import-warnings.log`) |

Without `MOODLEDATA_DIR` or `MOODLE_WWWROOT+MOODLE_WS_TOKEN`, lessons are
still imported but their attachments are skipped.

## 4. Run

There's a thin entrypoint per course (preferred), plus an all-courses wrapper.

```bash
# Dry run — inspect the plan for a single course without writing
node scripts/import-moodle-course-2.mjs --dry-run

# Import a single course (run any of these)
node scripts/import-moodle-course-2.mjs   # Electrónica Básica
node scripts/import-moodle-course-3.mjs   # Maquina PMB
node scripts/import-moodle-course-5.mjs   # Curso Basico (prueba)
node scripts/import-moodle-course-6.mjs   # Electrónica Básica - Segundo Grupo
node scripts/import-moodle-course-10.mjs  # Electrónica Básica - Segunda Generación
node scripts/import-moodle-course-11.mjs  # Programa Integral de Calidad

# All courses in one run
node scripts/import-moodle.mjs

# All-courses wrapper also accepts one-off course ids
node scripts/import-moodle.mjs --course=11
```

## 5. What gets created

| Firestore collection | doc id pattern | Notes |
|---|---|---|
| `courses` | `mdl_course_{moodleId}` | One per Moodle course (id>1) |
| `modules` | `mdl_mod_{sectionid}` | One per non-empty Moodle course_section |
| `lessons` | `mdl_lsn_{cmid}` | Dispatched by activity type (see below) |

**Sections are NOT created by the importer** — manage them in the admin UI after the course exists.

Every write uses `set(..., { merge: true })` with deterministic IDs, so
re-runs update existing docs without duplicating.

## 6. Activity → lasaedu lesson type

| Moodle | lasaedu | Notes |
|---|---|---|
| `quiz` | `quiz` | slots → question_references → question_versions → question |
| `assign` | `tarea` | `intro` → instructions, `grade` → totalPoints, `introattachment` → referenceFiles |
| `page` | `texto` | `content` rewritten via @@PLUGINFILE@@ |
| `book` | `texto` | chapters concatenated with `<hr/>` |
| `lesson` | `texto` | pages concatenated |
| `label` | `texto` | `intro` |
| `resource` | `recurso` | `mdlsv_files` filearea=content → files[] |
| `folder` | `recurso` | folder contents → files[] |
| `url` | `recurso` | `externalurl` → files[].url |
| `forum` | `foro` | prompt only; posts not migrated |
| `h5p`, `scorm`, `lti`, `workshop`, `choice`, `feedback`, `survey`, `chat`, `wiki`, `data`, `glossary`, `imscp`, `bigbluebuttonbn`, `subsection` | — | Skipped with warning |

Quiz `qtype` mapping is in `qtype-mapping.mjs`. `calculated*`, `essay`, and
`ddwtos`-family approximations produce warnings — review them in the editor.

## 7. Limitations (by design)

- No users, passwords, quiz attempts, submissions, grades.
- Forum posts not migrated.
- `passingScore` defaults to 70% (Moodle's `gradepass` isn't in this dump).
- Complex `qtype`s approximate to `open_answer`; check them manually.
- File migration requires either moodledata access or a webservice token —
  otherwise lessons import without attachments.
