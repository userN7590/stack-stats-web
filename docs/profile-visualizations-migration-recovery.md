# Visualization migration state and recovery

The reported production schema has `public.profile_layout_is_valid(jsonb)`
with the original v1 body, and `public.update_profile_layout(jsonb)`, but no
`public.profile_layout_v1_is_valid(jsonb)`.

This is the pre-visualization state. It is not evidence of a broken v2 dispatcher
with only a missing helper. The read-only preflight below compares the full v1
body, ignoring whitespace, rather than relying on the function names or excerpts.

## Migration contract

- `20260924000000_profile_layout.sql` creates the generic **v1-only** validator,
  the profile CHECK that calls it, and the owner-scoped invoker update RPC. It does
  not create or need a separately named v1 helper.
- `20260925000000_profile_visualizations.sql` first creates the separate v1
  helper, then replaces the generic validator **in place** with the v1/v2
  dispatcher, then sets authenticated-only helper/validator execution grants.
  The dispatcher uses the helper for both v1 validation and v2 core validation.
- The CHECK retains the generic validator's OID. The update RPC remains unchanged
  and calls that same validator. RLS and table grants remain unchanged.
- The post-visualization verifier correctly requires the helper. Removing that
  assertion would conceal an unapplied upgrade or a missing runtime dependency.

The entire visualization file is enclosed in `begin;` / `commit;`. A failed
statement in the complete transaction rolls back the helper, dispatcher change,
and grants. A successful commit of this exact file cannot leave the original
v1 validator and no helper. The reported state therefore does **not** show a
successfully installed visualization migration or a committed partial upgrade.
It cannot identify whether execution failed and rolled back, never ran in this
project, ran only a selection, used different SQL, or was later reverted. That
requires execution history; catalog definitions alone do not establish it.

References: [PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
and [function dependency tracking](https://www.postgresql.org/docs/16/ddl-depend.html).
The latter also explains why a v2 function defined with a string body can survive
removal of a helper, which the verifier regression tests explicitly cover.

## Exact hosted SQL Editor sequence

Use the intended project and run **each entire file**, with no selected fragment:

1. `supabase/verify-profile-visualizations-preflight.sql` — read-only. Requires
   the original v1 implementation, absence of the exact helper, the validated
   CHECK still depending on the validator, an invoker update RPC, enabled profile
   RLS, and layouts compatible with v1. If it refuses, stop and inspect the error;
   do not skip the guard or change validation to pass it.
2. **Only after that passes:** `supabase/migrations/20260925000000_profile_visualizations.sql`.
   From those verified prerequisites, applying this complete existing migration
   is the appropriate upgrade; an additive helper-only repair is insufficient
   and no additive repair migration is required. The file changes functions and
   their execution grants only; it does not rewrite profile data.
3. `supabase/verify-production.sql` — run the entire existing read-only verifier.
   This checks both versions, rejects invalid visualization/version choices, and
   checks profile RLS, owner-scoped write policies, public reads, and role grants.

The original visualization migration is **not generally idempotent**: its helper
uses `CREATE FUNCTION`, so replaying it after a successful application encounters
an already-existing function. The preflight refuses that state. Do not replay
it repeatedly or run only the `CREATE OR REPLACE` section. If migration history
claims it was applied while this preflight confirms v1, retain that discrepancy
for investigation; do not delete history entries to conceal it.

Until the upgrade, existing v1/default layouts remain supported and v2 layouts
are rejected by the v1 validator. The missing helper in this v1-only state does
not itself create a validation bypass or weaken RLS. The full production verifier
must pass after the upgrade before treating the visualization rollout as ready.
No production permission audit or migration execution was performed by the agent.

## Regression coverage

`scripts/test-profile-visualization-upgrade.mjs`, called by `npm run test:db`,
starts at the actual v1 point in the migration chain with a saved v1 profile:

- the preflight accepts that state;
- the updated verifier reproduces the exact missing-helper error;
- an injected error after the visualization statements rolls all changes back;
- applying the complete unmodified file creates the helper and accepts valid
  v1/v2 layouts while rejecting invalid visualization pairs;
- saved rows/timestamps, CHECK binding, RPC definition/OID, policies and table
  grants remain unchanged;
- the preflight rejects an already upgraded schema.

`scripts/test-production-verifier.mjs` additionally rejects missing/renamed
helpers, a `json` overload without the required `jsonb` signature, and missing
owner execution permission. All existing SQL tests run after the upgrade.

No applied migration or verifier assertion was changed for this investigation.
