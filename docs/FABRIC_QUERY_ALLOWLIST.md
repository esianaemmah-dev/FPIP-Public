# Growing the Fabric SQL query allowlist

`agent-service/app/fabric_client.py` deliberately does not let the LLM construct
SQL. Agents may only invoke one of a small set of named, pre-written query
templates in `_ALLOWED_QUERIES`, with parameter values substituted through
`pyodbc`'s parameterized `?` placeholders. This is what stands between a
prompt-injected user message and arbitrary reads against the bank's Fabric
Lakehouse — the allowlist is a security boundary, not a convenience cache, so
it must not grow casually.

## When a new query shape is needed

An analyst persona (Executive, Finance, Spend, Risk, ...) will eventually ask
for a data shape the current four templates can't answer. When that happens:

1. **Open a PR that adds exactly one named template** to `_ALLOWED_QUERIES` in
   `fabric_client.py`. Do not bundle unrelated template additions — each one
   gets independent review because each one is a new door into OneLake data.
2. **The template must be a single read-only `SELECT`.** No `INSERT`,
   `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `EXEC`/`EXECUTE`, multiple
   statements separated by `;`, or dynamic SQL built by string formatting.
   `test_fabric_client.py::test_every_allowlisted_query_is_a_single_readonly_select`
   enforces this shape automatically in CI — a PR that violates it fails the
   build, it doesn't rely on a reviewer noticing.
3. **Parameters are positional `?` placeholders only**, bound through
   `pyodbc`'s parameter list — never interpolated into the SQL string. If the
   template needs a parameter, add it as a `?` and document the expected type
   and order in the template's tool docstring
   (`fabric_sql_query_tool` in `tools.py`).
4. **State which agent(s) should get access** to the new query name. A query
   is added to a specific agent's toolset via `agents_config.py`'s
   `allowed_tools` / grounding — do not widen every agent's access as a side
   effect of adding one new template. If the fabric tool itself needs
   per-query gating in the future (not just per-agent tool gating), that's a
   separate, larger change — flag it in the PR rather than working around it.
5. **Add a test** asserting the new query name is reachable through
   `run_fabric_query` and rejected when misspelled/absent, following the
   existing tests in `test_fabric_client.py`.
6. **Reviewer sign-off required from whoever owns the Fabric/Dataverse data
   boundary** (not just a general code reviewer) before merge, since this is
   the one file that decides what SQL can ever reach the bank's lake.

## What does *not* require a new template

Filtering, sorting, or renaming within an *already-approved* result shape
(e.g., a different `TOP N`, a different `ORDER BY` direction on an existing
template) is a parameter, not a new template — add a `?` parameter to the
existing entry instead of duplicating it with a hardcoded variant.

## Explicit non-goals

- No template may accept a raw table name, column name, or SQL fragment as a
  parameter — that reopens the dynamic-SQL hole this design exists to close.
- No template may return more than what the requesting agent's `_AGENT_TABLES`
  scope in `dataverse_client.py` would already allow it to see conceptually —
  the Fabric allowlist and the Dataverse table allowlist should tell the same
  story about what each persona can read.
