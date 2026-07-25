# Reword Progress Log

Tracks progress on rewording every question in `data/questions.json`'s `regular` array
(554 total questions, indices 0-553 in file order as of 2026-07-25).

Rules being followed for each question:
- `id`, `topic`, `domain`, `type` are left untouched.
- The correct answer's *meaning* is unchanged (index may shift if choice order is reshuffled, but must be updated to match).
- Full scenario (`q`) and all `choices` are rewritten — new names/phrasing/scenario framing, same underlying concept and difficulty.
- `exp` is rewritten to match the new choices while preserving the same explanation content.
- Exam-style wording preserved (Security+ SY0-701 tone).

Part 2 (25 new PBQ questions) and Part 3 (PBQ-only practice mode) are already complete — see session notes; this log only tracks Part 1.

## Batches complete

- [x] Batch 1: indices 0-49 (ids vpn_types_1 .. ocsp_stapling_2)
- [x] Batch 2: indices 50-99 (ids conflict_of_interest_1 .. certificate_types_(dv)_2)
- [x] Batch 3: indices 100-149 (ids threat_actor_motivation_1 .. allow_lists_and_deny_lists_2)
- [x] Batch 4: indices 150-199 (ids pki_fundamentals_1 .. brute_force_attacks_2)
- [x] Batch 5: indices 200-249 (ids ddos_amplification_1 .. fail-open_vs_fail-closed_design_2)
- [x] Batch 6: indices 250-299 (ids platform_diversity_and_multi-cloud_1 .. legal_hold_2)
- [x] Batch 7: indices 300-349 (ids web_and_dns_filtering_1 .. wtls_2)
- [x] Batch 8: indices 350-399 (ids peap_1 .. dll_injection_2)
- [x] Batch 9: indices 400-449 (ids insider_threats_1 .. bug_bounty_programs_2)
- [x] Batch 10: indices 450-499 (ids red_team_vs_blue_team_vs_purple_team_1 .. cyber_liability_insurance_2)
- [x] Batch 11: indices 500-553 (ids change_management_approval_workflow_1 .. containerization_vs_virtual_machines_2)
- [x] Cleanup pass: after batches 1-11, an automated check found 223 questions (mostly non-scenario "which of the following" style, concentrated in batches 3-4 and 7-11) where only `exp` had been lightly touched and `q`/`choices` were left identical to the original. Fixed all 223 in four ID-targeted sub-batches (70 + 83 + 43 + 27). Verified via script against the pre-session committed file that 0 of 554 `q` fields remain unchanged.

## PART 1 STATUS: COMPLETE (554/554 reworded, verified)

Final verification (run 2026-07-25): regular count 554, pbq count 33, 0 unchanged `q` fields vs original, 0 duplicate IDs, 0 id/topic/domain/type mismatches, 0 correct-answer shape mismatches. Remaining identical `choices` arrays (512/554) are expected and fine — they're cases where the distractors are canonical technical terms (protocol names, RAID levels, tool names) that have no meaningful rewording without changing their meaning; the scenario/stem (`q`) was rewritten in 100% of cases.

## Batches remaining

None. All 554 regular questions are reworded and verified.
