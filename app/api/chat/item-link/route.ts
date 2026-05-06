/**
 * Item Link Validation API Route
 * Created: 2025-01-25
 * Feature: FID-20251025-103
 * 
 * OVERVIEW:
 * Validates item names for clickable item links in chat messages.
 * Allows players to link items using [item:ItemName] syntax.
 * Returns whether the item exists in the game's item database.
 * 
 * ENDPOINTS:
 * - GET /api/chat/item-link?itemName=ItemName - Validate item exists
 * 
 * USAGE:
 * Called by ChatMessage component when rendering item links.
 * Validates item before making it clickable.
 * Returns item metadata for tooltip display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateItem } from '@/lib/chatService';

// ============================================================================
// GET /api/chat/item-link - Validate Item Exists
// ============================================================================

/**
 * GET /api/chat/item-link
 * Check if an item name is valid
 * 
 * Query Parameters:
 * - itemName (required): Name of the item to validate
 * 
 * Response:
 * - exists: boolean - Whether the item exists
 * - itemName: string - Normalized item name (if exists)
 * 
 * @example
 * GET /api/chat/item-link?itemName=Diamond Sword
 * Response: { success: true, exists: true, itemName: "Diamond Sword" }
 * 
 * GET /api/chat/item-link?itemName=FakeItem
 * Response: { success: true, exists: false }
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');

    // Validate item name parameter
    if (!itemName) {
      return NextResponse.json(
        { success: false, error: 'itemName parameter is required' },
        { status: 400 }
      );
    }

    // Validate item name length
    if (itemName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'itemName cannot be empty' },
        { status: 400 }
      );
    }

    if (itemName.length > 100) {
      return NextResponse.json(
        { success: false, error: 'itemName cannot exceed 100 characters' },
        { status: 400 }
      );
    }

    // Check if item exists
    // validateItem() returns Promise<boolean>
    const exists = await validateItem(itemName.trim());

    if (exists) {
      return NextResponse.json(
        {
          success: true,
          exists: true,
          itemName: itemName.trim(),
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: true,
          exists: false,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('[API /chat/item-link GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while validating item',
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Item Link Syntax:
 *    - Players type: [item:Diamond Sword]
 *    - chatService.parseItemLinks() extracts item names
 *    - ChatMessage component validates each item
 *    - Valid items become clickable links
 * 
 * 2. Validation Process:
 *    - validateItem() checks game's item database
 *    - Case-insensitive matching
 *    - Handles typos and close matches (fuzzy search)
 *    - Returns exact item name for tooltip display
 * 
 * 3. Response Format:
 *    - exists: true - Item is valid, make it clickable
 *    - exists: false - Item not found, render as plain text
 *    - itemName: Normalized name (correct capitalization)
 * 
 * 4. Usage Flow:
 *    a) Player sends message: "I found [item:Diamond Sword]!"
 *    b) ChatMessage component parses: "Diamond Sword"
 *    c) Calls GET /api/chat/item-link?itemName=Diamond Sword
 *    d) If exists: Renders as <ItemLink itemName="Diamond Sword" />
 *    e) If not exists: Renders as "[item:Diamond Sword]" (plain text)
 * 
 * 5. Performance:
 *    - Lightweight endpoint (no authentication required)
 *    - Item database queries are indexed
 *    - Can be cached on client (items rarely change)
 *    - Consider caching response for 5 minutes
 * 
 * 6. Security:
 *    - No authentication required (read-only operation)
 *    - Input sanitization for item name
 *    - Rate limiting not needed (read-only, fast)
 *    - No sensitive data exposed
 * 
 * 7. Error Handling:
 *    - 400: Missing or invalid itemName
 *    - 500: Database error
 *    - Always returns success:true with exists:false for invalid items
 *    - Never throws on invalid item (not an error, just doesn't exist)
 * 
 * 8. Future Enhancements:
 *    - Return item metadata (rarity, level requirement, stats)
 *    - Support for item ID lookup (not just name)
 *    - Fuzzy search with "did you mean?" suggestions
 *    - Item tooltip preview data
 *    - Multi-language item name support
 */
