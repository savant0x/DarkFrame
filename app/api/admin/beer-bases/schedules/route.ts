/**
 * Beer Base Dynamic Schedules API
 * Created: 2025-10-25
 * Feature: FID-20251025-003 - Dynamic Schedules
 * 
 * OVERVIEW:
 * Provides CRUD operations for managing multiple Beer Base respawn schedules.
 * Supports timezone-aware scheduling with flexible spawn percentages.
 * 
 * ENDPOINTS:
 * - GET: List all schedules
 * - POST: Create new schedule
 * - PUT: Update existing schedule
 * - DELETE: Remove schedule
 * 
 * VALIDATION:
 * - dayOfWeek: 0-6 (0=Sunday, 6=Saturday)
 * - hour: 0-23
 * - spawnPercentage: 1-200 (allows combined schedules >100%)
 * - timezone: Valid IANA timezone string
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { addSchedule, updateSchedule, deleteSchedule, getSchedules } from '@/lib/beerBaseService';
import type { RespawnSchedule } from '@/lib/beerBaseService';

/**
 * GET /api/admin/beer-bases/schedules
 * List all respawn schedules
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const user = await getAuthenticatedUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const schedules = await getSchedules();

    return NextResponse.json({
      success: true,
      schedules,
      count: schedules.length
    });

  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/beer-bases/schedules
 * Create a new respawn schedule
 * 
 * Request body:
 * {
 *   enabled: boolean,
 *   dayOfWeek: number (0-6),
 *   hour: number (0-23),
 *   spawnPercentage: number (1-200),
 *   timezone: string (IANA timezone),
 *   name?: string (optional friendly name)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin session
    const user = await getAuthenticatedUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validation
    const errors: string[] = [];

    if (typeof body.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }

    if (typeof body.dayOfWeek !== 'number' || body.dayOfWeek < 0 || body.dayOfWeek > 6) {
      errors.push('dayOfWeek must be 0-6 (0=Sunday, 6=Saturday)');
    }

    if (typeof body.hour !== 'number' || body.hour < 0 || body.hour > 23) {
      errors.push('hour must be 0-23');
    }

    if (typeof body.spawnPercentage !== 'number' || body.spawnPercentage < 1 || body.spawnPercentage > 200) {
      errors.push('spawnPercentage must be 1-200');
    }

    if (!body.timezone || typeof body.timezone !== 'string') {
      errors.push('timezone is required (IANA timezone string)');
    } else {
      // Validate timezone
      try {
        Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
      } catch {
        errors.push(`Invalid timezone: ${body.timezone}`);
      }
    }

    if (body.name && typeof body.name !== 'string') {
      errors.push('name must be a string');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    // Create schedule
    const schedule = await addSchedule({
      enabled: body.enabled,
      dayOfWeek: body.dayOfWeek,
      hour: body.hour,
      spawnPercentage: body.spawnPercentage,
      timezone: body.timezone,
      name: body.name
    });

    return NextResponse.json({
      success: true,
      schedule,
      message: 'Schedule created successfully'
    });

  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/beer-bases/schedules
 * Update an existing respawn schedule
 * 
 * Request body:
 * {
 *   id: string (required),
 *   enabled?: boolean,
 *   dayOfWeek?: number (0-6),
 *   hour?: number (0-23),
 *   spawnPercentage?: number (1-200),
 *   timezone?: string (IANA timezone),
 *   name?: string
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify admin session
    const user = await getAuthenticatedUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validation
    const errors: string[] = [];

    if (!body.id || typeof body.id !== 'string') {
      errors.push('id is required');
    }

    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }

    if (body.dayOfWeek !== undefined && (typeof body.dayOfWeek !== 'number' || body.dayOfWeek < 0 || body.dayOfWeek > 6)) {
      errors.push('dayOfWeek must be 0-6 (0=Sunday, 6=Saturday)');
    }

    if (body.hour !== undefined && (typeof body.hour !== 'number' || body.hour < 0 || body.hour > 23)) {
      errors.push('hour must be 0-23');
    }

    if (body.spawnPercentage !== undefined && (typeof body.spawnPercentage !== 'number' || body.spawnPercentage < 1 || body.spawnPercentage > 200)) {
      errors.push('spawnPercentage must be 1-200');
    }

    if (body.timezone !== undefined) {
      if (typeof body.timezone !== 'string') {
        errors.push('timezone must be a string');
      } else {
        // Validate timezone
        try {
          Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
        } catch {
          errors.push(`Invalid timezone: ${body.timezone}`);
        }
      }
    }

    if (body.name !== undefined && body.name !== null && typeof body.name !== 'string') {
      errors.push('name must be a string or null');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    // Extract updates (exclude id)
    const { id, ...updates } = body;

    // Update schedule
    const schedule = await updateSchedule(id, updates);

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      schedule,
      message: 'Schedule updated successfully'
    });

  } catch (error) {
    console.error('Error updating schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/beer-bases/schedules
 * Delete a respawn schedule
 * 
 * Query parameter:
 * - id: Schedule ID to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin session
    const user = await getAuthenticatedUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const deleted = await deleteSchedule(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. TIMEZONE HANDLING:
 *    - Uses IANA timezone strings (e.g., 'America/New_York')
 *    - Validated using Intl.DateTimeFormat
 *    - Stored as-is in database for flexibility
 * 
 * 2. SPAWN PERCENTAGE:
 *    - Allows 1-200% to support combined schedules
 *    - Example: Two 50% schedules = 100% total spawn
 *    - Can intentionally exceed 100% for bonus spawns
 * 
 * 3. VALIDATION STRATEGY:
 *    - Strict type checking for all parameters
 *    - Comprehensive error messages
 *    - Returns all validation errors at once (not just first)
 * 
 * 4. BACKWARD COMPATIBILITY:
 *    - Legacy respawnDay/respawnHour still work
 *    - Dynamic schedules only active when schedulesEnabled=true
 *    - Default config includes single schedule matching legacy behavior
 * 
 * 5. SECURITY:
 *    - Requires admin authentication
 *    - No SQL injection risk (MongoDB + typed interface)
 *    - Timezone validation prevents malicious input
 */
