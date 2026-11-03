# Launch operations and recovery

The Site remains owner-private. These controls do not constitute approval to open registration to children, publish source materials, or claim educational efficacy or WCAG conformance.

## External alerts

`GET /api/operations` with the existing maintenance bearer key and `X-Mosaic-Maintenance: health-v1` returns only named checks and booleans. It checks D1, NoCodeBackend reads, R2 listing, the media worker heartbeat, failed/stalled media work, and a recent **completed** retention sweep. The Sites service credential remains independently required by private hosting. It never returns learner data, provider errors, credentials, file names or account identifiers.

Baldur runs `mosaic-alerts.timer` every five minutes. Two consecutive failures generate an incident email to `contact@graysongames.com`; a recovery generates one follow-up. Identical incidents are deduplicated in `~/.local/state/mosaic-alerts/production.json`. An ambiguous SMTP acknowledgement is retained as pending, with at most one retry per hour and a stable Message-ID; mail providers may still deliver a duplicate. A failed/stale daily backup also raises an alert.

Rehearsals use a separate named state and explicitly labelled messages:

```sh
python3 ~/.local/lib/mosaic-operations/monitor.py --rehearsal example-test --inject failure
python3 ~/.local/lib/mosaic-operations/monitor.py --rehearsal example-test --inject failure
python3 ~/.local/lib/mosaic-operations/monitor.py --rehearsal example-test --inject healthy
```

Mail credentials stay in the existing Baldur secret store. A test is complete only after matching Message-IDs are found in the recipient mailbox, not merely after SMTP accepts a message. This monitor shares the Baldur operations host; an independent off-host uptime monitor is still needed to detect loss of that entire host or its mail route.

## Backup and restore

`recovery-v1` is authenticated and GET-only. There is deliberately no HTTP restore operation. A D1 transaction exports the nine application tables and their SQL schema. The export is bounded at 10,000 rows/table, 5,000 file objects, and 8 MB JSON; it refuses overflow rather than claiming a truncated backup is complete. The operator downloads each original/narration/rendered object, checks lengths and hashes, and verifies the content inventory has not changed. An active deletion or data-mutation lease stops the rehearsal.

The operations scripts are `scripts/operations/ncb_recovery.py`, `site_recovery.py`, and `backup_runner.py`. They run on Baldur. `mosaic-backup.timer` schedules 04:15 Europe/London daily, after the retention task. Encrypted bundles contain the Site snapshot, R2 bytes and NoCodeBackend backup. Encrypted Site bundles and the NCB intermediate are scheduled for removal after seven days, even if the next backup fails. Hosts that are offline perform expiry when the scheduled service next runs. The current NCB intermediate backup is replaced each run. Backup credentials/keys are never committed or embedded in reports.

- Encryption key: `~/.config/mosaic-pilot/recovery.key` (0600).
- Encrypted backups and content-free receipts: `~/.local/state/mosaic-recovery/` (0700).
- Daily status: `backup-last.json`; failed jobs preserve prior backups.
- Each file is limited to 64 MB, total files 256 MB. Increase bounds or move to streaming backup before exceeding them.
- Every Site backup is decrypted and restored to independent in-memory SQLite, checks every table hash and integrity, and checks decoded file hashes.
- The provider rehearsal creates a separate private NoCodeBackend database and restores the two business-data tables with the slot/version uniqueness constraint, then compares exact rows. It must never point to `34968_mosaic_learning` as a restore target.
- Production identity/session/password/OAuth/SMTP records are included in the encrypted recovery source and tested offline. They are not activated in a second online auth service. A production disaster recovery must invalidate sessions and rotate affected credentials, then test sign-in and recovery email before admitting learners.

D1, R2 and NoCodeBackend are separate services, not one atomic transaction. The operator verifies stability across reads; this is not a zero-data-loss guarantee under concurrent activity. Restoring a historical copy over current data could resurrect deleted records. Before any real cutover, reconcile deletion receipts and retention with the latest surviving state, quarantine ambiguous AI requests, restore into an isolated target, verify tenant boundaries, and only then authorise the cutover. Never replay provider submissions automatically from a backup.

## Educational release gate

`evaluation/educational-v1.json` remains a retrieval/citation/access regression suite. `evaluation/semantic-v1.json` adds live-model cases for revenue/profit, numerical transfer, missing evidence, history causality, fraction language, younger-reader support and source injection. `evaluation/run-semantic.mjs` uses the real configured Muse Wonder adapter, checkpoints provider IDs, and resumes polling rather than resubmitting ambiguous requests. Run only with an explicitly authorised test budget; it incurs provider usage.

Reports record the exact outputs, criteria, model and usage. Editorial review by an AI agent is labelled as such. Human subject/age/language review and measured outcomes with representative learners remain required for educational claims. A correct citation alone never proves a correct explanation; game completion never proves mastery.

## Accessibility release gate

Retain keyboard, focus return, reflow, reduced-motion and text alternatives as regression checks. Record the actual browser, screen size and assistive technology state. A DOM/AX tree is not proof of spoken announcement quality. VoiceOver running during a keyboard check is not the same as verifying all speech. Physical iOS/Android, NVDA and TalkBack require the corresponding available devices and assistive technology; do not mark them passed through desktop emulation.

The approved Mac mini mirrors completed encrypted Site bundles and the recovery key into separate protected directories using `scripts/operations/mirror_backup.py`. It validates the archive name and compares the encrypted archive's SHA-256 against Baldur. Its receipt is `~/.local/share/mosaic-recovery/mirror-last.json`; the key is `~/.config/mosaic-recovery/recovery.key`. A changed key is refused until the previous key is preserved. The mirror retains seven days and does not hold NoCodeBackend, Sites or mail API credentials. A mirror does not replace a test of the production identity cutover.
