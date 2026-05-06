/**
 * @file lib/errors/codes.ts
 * @created 2025-10-24 (FID-20251024-PROD: Production Readiness)
 * @overview Standardized error codes for API responses
 * 
 * OVERVIEW:
 * Centralized error code enum for consistent error handling across all API routes.
 * Provides structured error responses with codes, messages, and optional details.
 * Improves frontend error handling and user experience.
 * 
 * FEATURES:
 * - Unique error codes for each failure scenario
 * - Categorized by domain (AUTH, RESOURCE, BATTLE, etc.)
 * - Type-safe error responses
 * - Sanitized production errors (no stack traces)
 * - Development-friendly error details
 * 
 * USAGE:
 * import { ErrorCode, createErrorResponse } from '@/lib/errors';
 * 
 * return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
 *   required: { metal: 500 },
 *   available: { metal: 250 }
 * });
 */

/**
 * Standardized error codes for API responses
 * Format: CATEGORY_SPECIFIC_ERROR
 */
export enum ErrorCode {
  // ============================================================================
  // AUTHENTICATION & AUTHORIZATION (AUTH_*)
  // ============================================================================
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',
  AUTH_USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND',
  AUTH_EMAIL_ALREADY_EXISTS = 'AUTH_EMAIL_ALREADY_EXISTS',
  AUTH_USERNAME_ALREADY_EXISTS = 'AUTH_USERNAME_ALREADY_EXISTS',
  AUTH_ADMIN_REQUIRED = 'AUTH_ADMIN_REQUIRED',

  // ============================================================================
  // VALIDATION (VALIDATION_*)
  // ============================================================================
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  VALIDATION_MISSING_FIELD = 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE = 'VALIDATION_OUT_OF_RANGE',
  VALIDATION_INVALID_COORDINATES = 'VALIDATION_INVALID_COORDINATES',

  // ============================================================================
  // RESOURCES (RESOURCE_*)
  // ============================================================================
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  INSUFFICIENT_METAL = 'INSUFFICIENT_METAL',
  INSUFFICIENT_ENERGY = 'INSUFFICIENT_ENERGY',
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  INSUFFICIENT_RP = 'INSUFFICIENT_RP',
  RESOURCE_CAPACITY_EXCEEDED = 'RESOURCE_CAPACITY_EXCEEDED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  BANK_BALANCE_INSUFFICIENT = 'BANK_BALANCE_INSUFFICIENT',
  BANK_INVALID_LOCATION = 'BANK_INVALID_LOCATION',

  // ============================================================================
  // BATTLE (BATTLE_*)
  // ============================================================================
  BATTLE_COOLDOWN_ACTIVE = 'BATTLE_COOLDOWN_ACTIVE',
  BATTLE_INSUFFICIENT_UNITS = 'BATTLE_INSUFFICIENT_UNITS',
  BATTLE_TARGET_NOT_FOUND = 'BATTLE_TARGET_NOT_FOUND',
  BATTLE_CANNOT_ATTACK_SELF = 'BATTLE_CANNOT_ATTACK_SELF',
  BATTLE_TARGET_PROTECTED = 'BATTLE_TARGET_PROTECTED',
  BATTLE_INVALID_UNITS = 'BATTLE_INVALID_UNITS',

  // ============================================================================
  // UNITS (UNIT_*)
  // ============================================================================
  UNIT_BUILD_FAILED = 'UNIT_BUILD_FAILED',
  UNIT_TYPE_NOT_FOUND = 'UNIT_TYPE_NOT_FOUND',
  UNIT_TIER_LOCKED = 'UNIT_TIER_LOCKED',
  UNIT_LIMIT_REACHED = 'UNIT_LIMIT_REACHED',
  UNIT_INVALID_QUANTITY = 'UNIT_INVALID_QUANTITY',

  // ============================================================================
  // MOVEMENT (MOVE_*)
  // ============================================================================
  MOVE_COOLDOWN_ACTIVE = 'MOVE_COOLDOWN_ACTIVE',
  MOVE_INVALID_DIRECTION = 'MOVE_INVALID_DIRECTION',
  MOVE_OUT_OF_BOUNDS = 'MOVE_OUT_OF_BOUNDS',
  MOVE_BLOCKED = 'MOVE_BLOCKED',

  // ============================================================================
  // HARVEST (HARVEST_*)
  // ============================================================================
  HARVEST_COOLDOWN_ACTIVE = 'HARVEST_COOLDOWN_ACTIVE',
  HARVEST_NO_RESOURCES = 'HARVEST_NO_RESOURCES',
  HARVEST_INVALID_TILE = 'HARVEST_INVALID_TILE',
  HARVEST_DEPLETED = 'HARVEST_DEPLETED',

  // ============================================================================
  // CLAN (CLAN_*)
  // ============================================================================
  CLAN_NOT_FOUND = 'CLAN_NOT_FOUND',
  CLAN_NAME_TAKEN = 'CLAN_NAME_TAKEN',
  CLAN_TAG_TAKEN = 'CLAN_TAG_TAKEN',
  CLAN_ALREADY_MEMBER = 'CLAN_ALREADY_MEMBER',
  CLAN_NOT_MEMBER = 'CLAN_NOT_MEMBER',
  CLAN_INSUFFICIENT_PERMISSION = 'CLAN_INSUFFICIENT_PERMISSION',
  CLAN_LEADER_CANNOT_LEAVE = 'CLAN_LEADER_CANNOT_LEAVE',
  CLAN_INVITATION_INVALID = 'CLAN_INVITATION_INVALID',
  CLAN_FULL = 'CLAN_FULL',

  // ============================================================================
  // AUCTION (AUCTION_*)
  // ============================================================================
  AUCTION_NOT_FOUND = 'AUCTION_NOT_FOUND',
  AUCTION_EXPIRED = 'AUCTION_EXPIRED',
  AUCTION_BID_TOO_LOW = 'AUCTION_BID_TOO_LOW',
  AUCTION_CANNOT_BID_OWN = 'AUCTION_CANNOT_BID_OWN',
  AUCTION_INVALID_ITEM = 'AUCTION_INVALID_ITEM',
  AUCTION_CREATION_FAILED = 'AUCTION_CREATION_FAILED',
  AUCTION_BUYOUT_FAILED = 'AUCTION_BUYOUT_FAILED',

  // ============================================================================
  // FACTORY (FACTORY_*)
  // ============================================================================
  FACTORY_NOT_FOUND = 'FACTORY_NOT_FOUND',
  FACTORY_NO_SLOTS = 'FACTORY_NO_SLOTS',
  FACTORY_SLOT_OCCUPIED = 'FACTORY_SLOT_OCCUPIED',
  FACTORY_BUILD_FAILED = 'FACTORY_BUILD_FAILED',

  // ============================================================================
  // VIP (VIP_*)
  // ============================================================================
  VIP_REQUIRED = 'VIP_REQUIRED',
  VIP_EXPIRED = 'VIP_EXPIRED',
  VIP_GRANT_FAILED = 'VIP_GRANT_FAILED',
  VIP_REVOKE_FAILED = 'VIP_REVOKE_FAILED',

  // ============================================================================
  // PAYMENT (PAYMENT_*)
  // ============================================================================
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_CANCELLED = 'PAYMENT_CANCELLED',
  PAYMENT_INVALID_AMOUNT = 'PAYMENT_INVALID_AMOUNT',
  PAYMENT_WEBHOOK_INVALID = 'PAYMENT_WEBHOOK_INVALID',

  // ============================================================================
  // ADMIN (ADMIN_*)
  // ============================================================================
  ADMIN_ACCESS_REQUIRED = 'ADMIN_ACCESS_REQUIRED',
  ADMIN_PLAYER_NOT_FOUND = 'ADMIN_PLAYER_NOT_FOUND',
  ADMIN_BOT_NOT_FOUND = 'ADMIN_BOT_NOT_FOUND',
  ADMIN_INVALID_BOT_SPECIALIZATION = 'ADMIN_INVALID_BOT_SPECIALIZATION',
  ADMIN_INVALID_BOT_TIER = 'ADMIN_INVALID_BOT_TIER',
  ADMIN_INVALID_POSITION = 'ADMIN_INVALID_POSITION',
  ADMIN_BAN_REASON_TOO_SHORT = 'ADMIN_BAN_REASON_TOO_SHORT',
  ADMIN_CANNOT_BAN_ADMIN = 'ADMIN_CANNOT_BAN_ADMIN',
  ADMIN_FLAG_NOT_FOUND = 'ADMIN_FLAG_NOT_FOUND',
  ADMIN_NOTES_REQUIRED = 'ADMIN_NOTES_REQUIRED',
  ADMIN_HOTKEY_INVALID_FORMAT = 'ADMIN_HOTKEY_INVALID_FORMAT',
  ADMIN_RP_ADJUSTMENT_FAILED = 'ADMIN_RP_ADJUSTMENT_FAILED',

  // ============================================================================
  // RATE LIMITING (RATE_*)
  // ============================================================================
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // ============================================================================
  // SYSTEM (SYSTEM_*)
  // ============================================================================
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * HTTP status codes for error responses
 */
export const ErrorStatusCodes: Record<ErrorCode, number> = {
  // Authentication - 401 Unauthorized
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCode.AUTH_TOKEN_MISSING]: 401,
  [ErrorCode.AUTH_TOKEN_INVALID]: 401,
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCode.AUTH_UNAUTHORIZED]: 401,
  [ErrorCode.AUTH_USER_NOT_FOUND]: 401,

  // Authorization - 403 Forbidden
  [ErrorCode.AUTH_FORBIDDEN]: 403,
  [ErrorCode.AUTH_ADMIN_REQUIRED]: 403,

  // Conflict - 409
  [ErrorCode.AUTH_EMAIL_ALREADY_EXISTS]: 409,
  [ErrorCode.AUTH_USERNAME_ALREADY_EXISTS]: 409,
  [ErrorCode.CLAN_NAME_TAKEN]: 409,
  [ErrorCode.CLAN_TAG_TAKEN]: 409,
  [ErrorCode.CLAN_ALREADY_MEMBER]: 409,

  // Bad Request - 400
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.VALIDATION_MISSING_FIELD]: 400,
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 400,
  [ErrorCode.VALIDATION_OUT_OF_RANGE]: 400,
  [ErrorCode.VALIDATION_INVALID_COORDINATES]: 400,
  [ErrorCode.INSUFFICIENT_RESOURCES]: 400,
  [ErrorCode.INSUFFICIENT_METAL]: 400,
  [ErrorCode.INSUFFICIENT_ENERGY]: 400,
  [ErrorCode.INSUFFICIENT_CREDITS]: 400,
  [ErrorCode.INSUFFICIENT_RP]: 400,
  [ErrorCode.RESOURCE_CAPACITY_EXCEEDED]: 400,
  [ErrorCode.RESOURCE_NOT_FOUND]: 400,
  [ErrorCode.BANK_BALANCE_INSUFFICIENT]: 400,
  [ErrorCode.BANK_INVALID_LOCATION]: 400,
  [ErrorCode.BATTLE_COOLDOWN_ACTIVE]: 400,
  [ErrorCode.BATTLE_INSUFFICIENT_UNITS]: 400,
  [ErrorCode.BATTLE_CANNOT_ATTACK_SELF]: 400,
  [ErrorCode.BATTLE_TARGET_PROTECTED]: 400,
  [ErrorCode.BATTLE_INVALID_UNITS]: 400,
  [ErrorCode.UNIT_BUILD_FAILED]: 400,
  [ErrorCode.UNIT_TIER_LOCKED]: 400,
  [ErrorCode.UNIT_LIMIT_REACHED]: 400,
  [ErrorCode.UNIT_INVALID_QUANTITY]: 400,
  [ErrorCode.MOVE_COOLDOWN_ACTIVE]: 400,
  [ErrorCode.MOVE_INVALID_DIRECTION]: 400,
  [ErrorCode.MOVE_OUT_OF_BOUNDS]: 400,
  [ErrorCode.MOVE_BLOCKED]: 400,
  [ErrorCode.HARVEST_COOLDOWN_ACTIVE]: 400,
  [ErrorCode.HARVEST_NO_RESOURCES]: 400,
  [ErrorCode.HARVEST_INVALID_TILE]: 400,
  [ErrorCode.HARVEST_DEPLETED]: 400,
  [ErrorCode.CLAN_NOT_MEMBER]: 400,
  [ErrorCode.CLAN_INSUFFICIENT_PERMISSION]: 400,
  [ErrorCode.CLAN_LEADER_CANNOT_LEAVE]: 400,
  [ErrorCode.CLAN_INVITATION_INVALID]: 400,
  [ErrorCode.CLAN_FULL]: 400,
  [ErrorCode.AUCTION_EXPIRED]: 400,
  [ErrorCode.AUCTION_BID_TOO_LOW]: 400,
  [ErrorCode.AUCTION_CANNOT_BID_OWN]: 400,
  [ErrorCode.AUCTION_INVALID_ITEM]: 400,
  [ErrorCode.AUCTION_CREATION_FAILED]: 400,
  [ErrorCode.AUCTION_BUYOUT_FAILED]: 400,
  [ErrorCode.FACTORY_NO_SLOTS]: 400,
  [ErrorCode.FACTORY_SLOT_OCCUPIED]: 400,
  [ErrorCode.FACTORY_BUILD_FAILED]: 400,
  [ErrorCode.VIP_REQUIRED]: 400,
  [ErrorCode.VIP_EXPIRED]: 400,
  [ErrorCode.VIP_GRANT_FAILED]: 400,
  [ErrorCode.VIP_REVOKE_FAILED]: 400,
  [ErrorCode.PAYMENT_CANCELLED]: 400,
  [ErrorCode.PAYMENT_INVALID_AMOUNT]: 400,
  [ErrorCode.PAYMENT_WEBHOOK_INVALID]: 400,

  // Admin Actions - 400/403/404
  [ErrorCode.ADMIN_ACCESS_REQUIRED]: 403,
  [ErrorCode.ADMIN_PLAYER_NOT_FOUND]: 404,
  [ErrorCode.ADMIN_BOT_NOT_FOUND]: 404,
  [ErrorCode.ADMIN_INVALID_BOT_SPECIALIZATION]: 400,
  [ErrorCode.ADMIN_INVALID_BOT_TIER]: 400,
  [ErrorCode.ADMIN_INVALID_POSITION]: 400,
  [ErrorCode.ADMIN_BAN_REASON_TOO_SHORT]: 400,
  [ErrorCode.ADMIN_CANNOT_BAN_ADMIN]: 403,
  [ErrorCode.ADMIN_FLAG_NOT_FOUND]: 404,
  [ErrorCode.ADMIN_NOTES_REQUIRED]: 400,
  [ErrorCode.ADMIN_HOTKEY_INVALID_FORMAT]: 400,
  [ErrorCode.ADMIN_RP_ADJUSTMENT_FAILED]: 400,

  // Not Found - 404
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.BATTLE_TARGET_NOT_FOUND]: 404,
  [ErrorCode.UNIT_TYPE_NOT_FOUND]: 404,
  [ErrorCode.CLAN_NOT_FOUND]: 404,
  [ErrorCode.AUCTION_NOT_FOUND]: 404,
  [ErrorCode.FACTORY_NOT_FOUND]: 404,

  // Method Not Allowed - 405
  [ErrorCode.METHOD_NOT_ALLOWED]: 405,

  // Too Many Requests - 429
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,

  // Internal Server Error - 500
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.PAYMENT_FAILED]: 500,

  // Service Unavailable - 503
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

/**
 * User-friendly error messages
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  // Authentication
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
  [ErrorCode.AUTH_TOKEN_MISSING]: 'Authentication required',
  [ErrorCode.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Session expired, please login again',
  [ErrorCode.AUTH_UNAUTHORIZED]: 'You must be logged in to access this',
  [ErrorCode.AUTH_FORBIDDEN]: 'You do not have permission to perform this action',
  [ErrorCode.AUTH_USER_NOT_FOUND]: 'User not found',
  [ErrorCode.AUTH_EMAIL_ALREADY_EXISTS]: 'Email address already in use',
  [ErrorCode.AUTH_USERNAME_ALREADY_EXISTS]: 'Username already taken',
  [ErrorCode.AUTH_ADMIN_REQUIRED]: 'Administrator access required',

  // Validation
  [ErrorCode.VALIDATION_FAILED]: 'Invalid request data',
  [ErrorCode.VALIDATION_MISSING_FIELD]: 'Required field is missing',
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 'Invalid data format',
  [ErrorCode.VALIDATION_OUT_OF_RANGE]: 'Value out of valid range',
  [ErrorCode.VALIDATION_INVALID_COORDINATES]: 'Invalid map coordinates',

  // Resources
  [ErrorCode.INSUFFICIENT_RESOURCES]: 'Insufficient resources',
  [ErrorCode.INSUFFICIENT_METAL]: 'Not enough metal',
  [ErrorCode.INSUFFICIENT_ENERGY]: 'Not enough energy',
  [ErrorCode.INSUFFICIENT_CREDITS]: 'Not enough credits',
  [ErrorCode.INSUFFICIENT_RP]: 'Not enough RP',
  [ErrorCode.RESOURCE_CAPACITY_EXCEEDED]: 'Resource capacity exceeded',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Resource not found',
  [ErrorCode.BANK_BALANCE_INSUFFICIENT]: 'Insufficient bank balance',
  [ErrorCode.BANK_INVALID_LOCATION]: 'Invalid bank location',

  // Battle
  [ErrorCode.BATTLE_COOLDOWN_ACTIVE]: 'Battle cooldown active, please wait',
  [ErrorCode.BATTLE_INSUFFICIENT_UNITS]: 'Not enough units to attack',
  [ErrorCode.BATTLE_TARGET_NOT_FOUND]: 'Target player not found',
  [ErrorCode.BATTLE_CANNOT_ATTACK_SELF]: 'Cannot attack yourself',
  [ErrorCode.BATTLE_TARGET_PROTECTED]: 'Target is protected from attacks',
  [ErrorCode.BATTLE_INVALID_UNITS]: 'Invalid unit selection',

  // Units
  [ErrorCode.UNIT_BUILD_FAILED]: 'Failed to build unit',
  [ErrorCode.UNIT_TYPE_NOT_FOUND]: 'Unit type not found',
  [ErrorCode.UNIT_TIER_LOCKED]: 'Unit tier locked, upgrade required',
  [ErrorCode.UNIT_LIMIT_REACHED]: 'Unit limit reached',
  [ErrorCode.UNIT_INVALID_QUANTITY]: 'Invalid unit quantity',

  // Movement
  [ErrorCode.MOVE_COOLDOWN_ACTIVE]: 'Movement cooldown active',
  [ErrorCode.MOVE_INVALID_DIRECTION]: 'Invalid movement direction',
  [ErrorCode.MOVE_OUT_OF_BOUNDS]: 'Cannot move outside map boundaries',
  [ErrorCode.MOVE_BLOCKED]: 'Movement blocked',

  // Harvest
  [ErrorCode.HARVEST_COOLDOWN_ACTIVE]: 'Harvest cooldown active',
  [ErrorCode.HARVEST_NO_RESOURCES]: 'No resources available to harvest',
  [ErrorCode.HARVEST_INVALID_TILE]: 'Invalid tile for harvesting',
  [ErrorCode.HARVEST_DEPLETED]: 'Resource node depleted',

  // Clan
  [ErrorCode.CLAN_NOT_FOUND]: 'Clan not found',
  [ErrorCode.CLAN_NAME_TAKEN]: 'Clan name already taken',
  [ErrorCode.CLAN_TAG_TAKEN]: 'Clan tag already taken',
  [ErrorCode.CLAN_ALREADY_MEMBER]: 'Already a clan member',
  [ErrorCode.CLAN_NOT_MEMBER]: 'Not a clan member',
  [ErrorCode.CLAN_INSUFFICIENT_PERMISSION]: 'Insufficient clan permissions',
  [ErrorCode.CLAN_LEADER_CANNOT_LEAVE]: 'Clan leader must transfer leadership before leaving',
  [ErrorCode.CLAN_INVITATION_INVALID]: 'Invalid or expired invitation',
  [ErrorCode.CLAN_FULL]: 'Clan is full',

  // Auction
  [ErrorCode.AUCTION_NOT_FOUND]: 'Auction not found',
  [ErrorCode.AUCTION_EXPIRED]: 'Auction has expired',
  [ErrorCode.AUCTION_BID_TOO_LOW]: 'Bid amount too low',
  [ErrorCode.AUCTION_CANNOT_BID_OWN]: 'Cannot bid on your own auction',
  [ErrorCode.AUCTION_INVALID_ITEM]: 'Invalid auction item',
  [ErrorCode.AUCTION_CREATION_FAILED]: 'Failed to create auction',
  [ErrorCode.AUCTION_BUYOUT_FAILED]: 'Failed to buyout auction',

  // Factory
  [ErrorCode.FACTORY_NOT_FOUND]: 'Factory not found',
  [ErrorCode.FACTORY_NO_SLOTS]: 'No factory slots available',
  [ErrorCode.FACTORY_SLOT_OCCUPIED]: 'Factory slot already occupied',
  [ErrorCode.FACTORY_BUILD_FAILED]: 'Factory build failed',

  // VIP
  [ErrorCode.VIP_REQUIRED]: 'VIP membership required',
  [ErrorCode.VIP_EXPIRED]: 'VIP membership expired',
  [ErrorCode.VIP_GRANT_FAILED]: 'Failed to grant VIP',
  [ErrorCode.VIP_REVOKE_FAILED]: 'Failed to revoke VIP',

  // Payment
  [ErrorCode.PAYMENT_FAILED]: 'Payment processing failed',
  [ErrorCode.PAYMENT_CANCELLED]: 'Payment was cancelled',
  [ErrorCode.PAYMENT_INVALID_AMOUNT]: 'Invalid payment amount',
  [ErrorCode.PAYMENT_WEBHOOK_INVALID]: 'Invalid payment webhook',

  // Admin
  [ErrorCode.ADMIN_ACCESS_REQUIRED]: 'Administrator access required',
  [ErrorCode.ADMIN_PLAYER_NOT_FOUND]: 'Player not found',
  [ErrorCode.ADMIN_BOT_NOT_FOUND]: 'Bot not found',
  [ErrorCode.ADMIN_INVALID_BOT_SPECIALIZATION]: 'Invalid bot specialization',
  [ErrorCode.ADMIN_INVALID_BOT_TIER]: 'Invalid bot tier (must be 1-6)',
  [ErrorCode.ADMIN_INVALID_POSITION]: 'Invalid map position',
  [ErrorCode.ADMIN_BAN_REASON_TOO_SHORT]: 'Ban reason must be at least 10 characters',
  [ErrorCode.ADMIN_CANNOT_BAN_ADMIN]: 'Cannot ban administrator accounts',
  [ErrorCode.ADMIN_FLAG_NOT_FOUND]: 'Flag not found',
  [ErrorCode.ADMIN_NOTES_REQUIRED]: 'Admin notes are required (minimum 10 characters)',
  [ErrorCode.ADMIN_HOTKEY_INVALID_FORMAT]: 'Invalid hotkey configuration format',
  [ErrorCode.ADMIN_RP_ADJUSTMENT_FAILED]: 'Failed to adjust RP balance',

  // Rate Limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests, please slow down',

  // System
  [ErrorCode.DATABASE_ERROR]: 'Database error occurred',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.METHOD_NOT_ALLOWED]: 'Method not allowed',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
};

/**
 * FOOTER:
 * This error code system provides consistent, user-friendly error messages
 * across all API routes. Error codes are categorized by domain for easy
 * identification and handling.
 * 
 * Frontend can use error codes for:
 * - Internationalization (translate based on code)
 * - Custom error UI (show different components per error type)
 * - Analytics (track common error patterns)
 * - Retry logic (retry on specific errors like DATABASE_ERROR)
 */
