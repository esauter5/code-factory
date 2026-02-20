# Stage Prompt Contracts

Reference for prompt authors and pipeline maintainers. Describes what each stage
receives, must produce, and how the pipeline evaluates success or failure.

## Variable Injection Model

Templates use `{{token}}` syntax. `renderTemplate()` replaces tokens with values
from the orchestrator. Missing keys render as empty strings.

### Always Available
| Variable | Source | Description |
|----------|--------|-------------|
| `run_id` | RunRecord | Unique run identifier |
| `ticket` | RunRecord | Full ticket text |
| `repo_path` | RunRecord | Absolute path to the repository |
| `repo_context` | RunRecord | Repository summary (tech stack, structure) |
| `progress_path` | RunRecord | Path to progress tracking file |
| `feedback` | buildFeedback() | Markdown summary of prior failed attempts |

### Stage-Specific
| Variable | Available In | Source |
|----------|-------------|--------|
| `plan_artifact` | Implement, Verify, PR, Review | Plan stage output |
| `implementation_artifact` | Verify, Test, PR, Review | Implement stage output |
| `test_report` | PR, Review | Test stage output (currently: "Tests passed" or "Tests failed" + logs) |
| `pr_artifact` | Review | PR stage output |
| `pr_instructions` | PR | Pipeline-generated PR creation instructions |
| `pr_url` | Review | Extracted PR URL (from PR stage output) |

## Success Criteria Model

The pipeline evaluates stage output using `successCriteria` defined in
`pipeline-templates.ts`. These are **not** controlled by prompts -- they are
infrastructure-level checks. Prompts must produce output compatible with them.

| Check | Used By | Behavior |
|-------|---------|----------|
| `failIfOutputContains: "BLOCKER:"` | Verify | Case-insensitive substring match. Any match = stage failure. |
| `failIfOutputContainsAny: ["CRITICAL:", "MAJOR:"]` | Review | Case-insensitive match on any entry. Any match = stage failure. |
| `extractUrlPattern` | PR | Regex extraction. Captured URL saved as `run.prUrl`. |
| *(exit code 0)* | Test | Shell command success. No output parsing. |

## Failure & Retry Model

Stages with `onFailure.revertTo` auto-revert to a prior stage on failure.
`buildFeedback()` includes:
- **Same-stage failures**: Prior attempts of this stage (error + first 2000 chars of output)
- **Downstream failures**: Later-stage failures that caused revert (error + output/log previews)

Feedback is injected into the `{{feedback}}` variable and rendered inside `<feedback>` tags.

## Status Convention

All prompt stages end their output with a status declaration:

```
STATUS: done    -- Stage completed its work successfully
STATUS: retry   -- Stage could not complete; needs another attempt with adjusted approach
STATUS: failed  -- Stage encountered an unrecoverable problem
```

In v1 this is informational only -- the pipeline uses `successCriteria` for pass/fail.
The status line establishes a convention for future contract enforcement.

## Per-Stage Contracts

### Plan (Stage 1 of 6)
- **Type**: claude-prompt
- **Inputs**: ticket, repo_context, feedback, progress_path
- **Output**: Structured markdown plan (see plan.txt output_format)
- **Success**: No criteria -- always passes if the LLM returns output
- **Consumed by**: Implement (as plan_artifact), Verify, PR, Review

### Implement (Stage 2 of 6)
- **Type**: claude-prompt
- **Inputs**: ticket, plan_artifact, repo_context, feedback, progress_path
- **Output**: Code changes + structured markdown implementation summary
- **Success**: No criteria -- always passes if the LLM returns output
- **Consumed by**: Verify (as implementation_artifact), Test, PR, Review

### Verify (Stage 3 of 6)
- **Type**: claude-prompt
- **Inputs**: ticket, plan_artifact, implementation_artifact, feedback, progress_path
- **Output**: Blocker findings or "No blocker findings."
- **Success**: Fails if output contains "BLOCKER:" (case-insensitive)
- **On failure**: Reverts to Implement (max 3 cycles)

### Test (Stage 4 of 6)
- **Type**: shell-command
- **Inputs**: Shell command from run.testCommand or pipeline config
- **Output**: "Tests passed" or "Tests failed" (generic string). Raw stdout/stderr in logs field.
- **Success**: Exit code 0
- **On failure**: Reverts to Implement (max 3 cycles)
- **Note**: test_report variable contains the generic output string, not full logs. This is a known gap.

### PR (Stage 5 of 6)
- **Type**: claude-prompt
- **Inputs**: ticket, plan_artifact, implementation_artifact, test_report, feedback, pr_instructions, progress_path
- **Output**: PR creation output containing a GitHub PR URL
- **Success**: URL extracted via regex pattern

### Review (Stage 6 of 6)
- **Type**: claude-prompt
- **Inputs**: ticket, plan_artifact, implementation_artifact, test_report, pr_artifact, repo_context, feedback, pr_url, progress_path
- **Output**: Severity-classified findings or "No critical or major findings."
- **Success**: Fails if output contains "CRITICAL:" or "MAJOR:" (case-insensitive)
- **On failure**: Reverts to Implement (max 3 cycles)
