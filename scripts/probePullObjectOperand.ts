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
import { connectToDatabase } from '@/lib/mongodb';

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

  // The verified replacement shape for the shim-hardening follow-up: rebuild the
  // array with jsonb_agg over elements NOT deep-equal to the operand.
  let rewriteOk = false;
  try {
    const rewrite = await db.execute(
      sql`SELECT coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(${arr}) e WHERE e <> ${unitOperand}), '[]'::jsonb) AS remaining`
    );
    const rewriteRows = rewrite.rows as Array<{ remaining: unknown }>; 
    const rem = rewriteRows[0]?.remaining;
    rewriteOk =
      Array.isArray(rem) &&
      rem.length === 1 &&
      (rem[0] as { unitId?: string }).unitId === 'U2';
    console.log(
      rewriteOk
        ? 'probe: jsonb_agg rewrite CONFIRMED — drop-in $pull replacement for the shim-hardening follow-up'
        : 'probe: jsonb_agg rewrite produced an unexpected shape — re-inspect before adopting'
    );
  } catch (err) {
    console.log('probe: jsonb_agg rewrite probe failed:', err instanceof Error ? err.message : String(err));
  }

  process.exit(removedStructurally && rewriteOk ? 0 : 1);
}

void main();
