// MongoDB client has been replaced with Supabase.
// This file provides backward-compatible stubs for scripts
// that haven't been fully migrated.

/** @deprecated Use createServiceClient() from @/lib/supabase/server instead */
export async function connectToDatabase(): Promise<any> {
  throw new Error('MongoDB has been replaced with Supabase. Use createServiceClient() from @/lib/supabase/server.');
}

/** @deprecated Use supabase.from(tableName) instead */
export function getCollection(name: string, _db?: any): any {
  throw new Error('MongoDB has been replaced with Supabase. Use supabase.from(tableName) instead.');
}

/** @deprecated Use createServiceClient() from @/lib/supabase/server instead */
export function getDatabase(): any {
  throw new Error('MongoDB has been replaced with Supabase. Use createServiceClient() from @/lib/supabase/server.');
}

/** @deprecated Use createServiceClient() from @/lib/supabase/server instead */
export async function testConnection(): Promise<boolean> {
  throw new Error('MongoDB has been replaced with Supabase. Use createServiceClient() from @/lib/supabase/server.');
}

/** @deprecated Use createServiceClient() from @/lib/supabase/server instead */
export async function getClientAndDatabase(): Promise<{ client: any; db: any }> {
  throw new Error('MongoDB has been replaced with Supabase. Use createServiceClient() from @/lib/supabase/server.');
}

/** @deprecated */
export default async function clientPromise(): Promise<any> {
  throw new Error('MongoDB has been replaced with Supabase. Use createServiceClient() from @/lib/supabase/server.');
}
