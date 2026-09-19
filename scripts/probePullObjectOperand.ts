/**
 * FID-20260914-003 §5 (finding 7): verify the `jsonb - jsonb` semantic the shim's
 * $pull relies on for object operands.
 *
 * lib/mongodb.ts $pull handler emits:  coalesce(col, '[]'::jsonb) - <value>::jsonb
 * For a ScalarValue operand that is a nested object (auction unit escrow removal:
 * { units: unitObject }), pg's `-` operator on jsonb does STRUCTURAL EQUALITY matching
 * (docs: "Delete the key (and its value) from a JSON object, or matching multiple
 * values/keys from the left operand" — for arrays, elements equal to the right operand
 * are removed; jsonb equality is deep/structural, key order-insensitive).
 *
 * PROBE IS STRICTLY READ-ONLY: every statement is a SELECT over composed literals —
 * no table is opened, no row is written, nothing to clean up. Run:
 *   npx tsx -r dotenv/config scripts/probePullObjectOperand.ts dotenv_config_path=.env.local
 */
import { sql, type SQL } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/db/connection';

async function main(): Promise<void> {
  const db = await connectToDatabase();

  // The exact SQL shape the shim emits, composed over literal jsonb values.
  // arr = a two-element units array; unit = the object operand to $pull.
  const arr = sql`'[{"unitId":"U1","name":"Grunt"},{"unitId":"U2","name":"Scout"}]'::jsonb`;
  const unitOperand = sql`'{"unitId":"U1","name":"Grunt"}'::jsonb`;
  const scalarOperand = sql`'"U1"'::jsonb`;

  // Each leg is independently caught: the shim-shape SQL is EXPECTED to fail on
  // engines without the jsonb - jsonb operator, and that failure is itself the
  // finding — the probe must record it, not die on it.
  async function probeOne(label: string, q: SQL): Promise<{ rows: Array<Record<string, unknown>> } | null> {
    try {
      const r = await db.execute(q);
      console.log(`probe: ${label} →`, JSON.stringify((r.rows as Array<Record<string, unknown>>)[0]?.remaining));
      return { rows: r.rows as Array<Record<string, unknown>> };
    } catch (err) {
      console.log(`probe: ${label} → FAILED:`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  const structural = await probeOne('shim-shape object operand (jsonb - jsonb)', sql`SELECT ${arr} - ${unitOperand} AS remaining`);
  const byValue = await probeOne('scalar string operand (jsonb - jsonb)', sql`SELECT ${arr} - ${scalarOperand} AS remaining`);
  await probeOne('no-match object operand (jsonb - jsonb)', sql`SELECT ${arr} - '{"unitId":"MISSING"}'::jsonb AS remaining`);

  const removedStructurally = (() => {
    if (!structural) return false;
    const remaining = structural.rows[0]?.remaining;
    return Array.isArray(remaining)
      ? !remaining.some((u) => (u as { unitId?: string }).unitId === 'U1')
      : false;
  })();
  const scalarUnmatched = (() => {
    if (!byValue) return true; // operator missing → scalar path equally dead
    const remaining = byValue.rows[0]?.remaining;
    return Array.isArray(remaining) ? (remaining as unknown[]).length === 2 : false;
  })();

  console.log(
    removedStructurally
      ? 'probe: CONFIRMED — object operands match by STRUCTURAL (deep) equality; unit escrow $pull removes the exact unit row'
      : 'probe: REFUTED — shim-shape $pull SQL is invalid on this engine (jsonb - jsonb operator absent); NO production path may rely on $pull'
  );
  console.log(
    scalarUnmatched
      ? 'probe: scalar-operand path consistent (either unmatched or equally invalid)'
      : 'probe: unexpected scalar-operand behavior — re-inspect'
  );

  // ── FID-20260914-004: the SHIPPED shim fragments (post-implementation) ──
  // The shim now emits exactly these shapes; each is verified against the live
  // engine so the shipped SQL is machine-proven, not hand-asserted.

  // (1) Shipped $pull shape, object operand over the units array.
  let rewriteOk = false;
  try {
    const rewrite = await db.execute(
      sql`SELECT coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(${arr}) e WHERE e <> ${unitOperand}), '[]'::jsonb) AS remaining`
    );
    const rem = (rewrite.rows as Array<{ remaining: unknown }>)[0]?.remaining;
    rewriteOk =
      Array.isArray(rem) &&
      rem.length === 1 &&
      (rem[0] as { unitId?: string }).unitId === 'U2';
    console.log(
      rewriteOk
        ? 'probe: shipped $pull (object operand) CONFIRMED — jsonb_agg deep-equality removal'
        : 'probe: shipped $pull (object operand) unexpected shape — re-inspect'
    );
  } catch (err) {
    console.log('probe: shipped $pull (object operand) failed:', err instanceof Error ? err.message : String(err));
  }

  // (2) Shipped $pull shape, scalar operand (match → removed; no-match → kept).
  let pullScalarOk = false;
  try {
    const scalarArr = sql`'["alpha","beta"]'::jsonb`;
    const alpha = sql`'"alpha"'::jsonb`;
    const r = await db.execute(
      sql`SELECT coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(${scalarArr}) e WHERE e <> ${alpha}), '[]'::jsonb) AS remaining`
    );
    const rem = (r.rows as Array<{ remaining: unknown }>)[0]?.remaining;
    pullScalarOk = Array.isArray(rem) && rem.length === 1 && rem[0] === 'beta';
    console.log(
      pullScalarOk
        ? 'probe: shipped $pull (scalar operand) CONFIRMED'
        : `probe: shipped $pull (scalar operand) unexpected: ${JSON.stringify(rem)}`
    );
  } catch (err) {
    console.log('probe: shipped $pull (scalar operand) failed:', err instanceof Error ? err.message : String(err));
  }

  // (3) JSON-null element case (FID-004 loop-2 probe hardening): JSON null in the
  // array is the jsonb value 'null' (never SQL NULL), so `e <> operand` is total
  // and the null element is PRESERVED, not dropped.
  let nullElementOk = false;
  try {
    const nullArr = sql`'["alpha", null, "beta"]'::jsonb`;
    const alpha = sql`'"alpha"'::jsonb`;
    const r = await db.execute(
      sql`SELECT coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(${nullArr}) e WHERE e <> ${alpha}), '[]'::jsonb) AS remaining`
    );
    const rem = (r.rows as Array<{ remaining: unknown }>)[0]?.remaining;
    nullElementOk =
      Array.isArray(rem) && rem.length === 2 && rem[0] === null && rem[1] === 'beta';
    console.log(
      nullElementOk
        ? 'probe: JSON-null element preserved through the $pull rewrite CONFIRMED'
        : `probe: JSON-null element case unexpected: ${JSON.stringify(rem)}`
    );
  } catch (err) {
    console.log('probe: JSON-null element case failed:', err instanceof Error ? err.message : String(err));
  }

  // (4) Shipped $addToSet shape: containment guard — absent appends, present
  // (scalar or object, deep equality) leaves the array untouched.
  let addToSetOk = false;
  try {
    const setBase = sql`'["x","y"]'::jsonb`;
    const elZ = sql`'["z"]'::jsonb`;
    const elY = sql`'["y"]'::jsonb`;
    const absent = await db.execute(
      sql`SELECT (CASE WHEN coalesce(${setBase}, '[]'::jsonb) @> ${elZ} THEN coalesce(${setBase}, '[]'::jsonb) ELSE coalesce(${setBase}, '[]'::jsonb) || ${elZ} END) AS out`
    );
    const present = await db.execute(
      sql`SELECT (CASE WHEN coalesce(${setBase}, '[]'::jsonb) @> ${elY} THEN coalesce(${setBase}, '[]'::jsonb) ELSE coalesce(${setBase}, '[]'::jsonb) || ${elY} END) AS out`
    );
    const objBase = sql`'[{"a":1}]'::jsonb`;
    const objSame = sql`'[{"a":1}]'::jsonb`;
    const objDiff = sql`'[{"a":2}]'::jsonb`;
    const objPresent = await db.execute(
      sql`SELECT (CASE WHEN coalesce(${objBase}, '[]'::jsonb) @> ${objSame} THEN coalesce(${objBase}, '[]'::jsonb) ELSE coalesce(${objBase}, '[]'::jsonb) || ${objSame} END) AS out`
    );
    const objAbsent = await db.execute(
      sql`SELECT (CASE WHEN coalesce(${objBase}, '[]'::jsonb) @> ${objDiff} THEN coalesce(${objBase}, '[]'::jsonb) ELSE coalesce(${objBase}, '[]'::jsonb) || ${objDiff} END) AS out`
    );
    const a = (absent.rows as Array<{ out: unknown }>)[0]?.out;
    const p = (present.rows as Array<{ out: unknown }>)[0]?.out;
    const op = (objPresent.rows as Array<{ out: unknown }>)[0]?.out;
    const oa = (objAbsent.rows as Array<{ out: unknown }>)[0]?.out;
    addToSetOk =
      Array.isArray(a) && a.length === 3 && a[2] === 'z' &&
      Array.isArray(p) && p.length === 2 &&
      Array.isArray(op) && op.length === 1 &&
      Array.isArray(oa) && oa.length === 2;
    console.log(
      addToSetOk
        ? 'probe: shipped $addToSet containment guard CONFIRMED (scalar + object, absent/present)'
        : `probe: shipped $addToSet guard unexpected: ${JSON.stringify({ a, p, op, oa })}`
    );
  } catch (err) {
    console.log('probe: shipped $addToSet guard failed:', err instanceof Error ? err.message : String(err));
  }

  // Exit semantics (fixed from the FID-003 era, whose pipe masked the true code):
  // 0 iff every SHIPPED fragment is verified live. The legacy jsonb-minus probes
  // above are documentation of the pre-FID-004 dead shape and no longer gate exit.
  const allShippedOk = rewriteOk && pullScalarOk && nullElementOk && addToSetOk;
  console.log(
    allShippedOk
      ? 'probe: ALL SHIPPED FRAGMENTS VERIFIED (FID-20260914-004)'
      : 'probe: SHIPPED FRAGMENT VERIFICATION FAILED'
  );
  process.exit(allShippedOk ? 0 : 1);
}

void main();
