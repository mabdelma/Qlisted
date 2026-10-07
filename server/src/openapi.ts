import { z } from 'zod';

// ──────────────────────────────────────────
// Auth
// ──────────────────────────────────────────
export const RegisterInputSchema = z.object({
  tenantSlug: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['admin', 'manager', 'waiter', 'kitchen', 'cashier']).optional().default('waiter'),
});

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const ResendVerificationSchema = z.object({
  email: z.string().email(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

// ──────────────────────────────────────────
// Tenants
// ──────────────────────────────────────────
export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  phone: z.string().optional(),
  adminName: z.string().min(1).max(100),
  adminPassword: z.string().min(6).max(100),
});

// ──────────────────────────────────────────
// Menu
// ──────────────────────────────────────────
export const CategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['main', 'sub']).optional().default('main'),
  parentId: z.string().optional(),
  sortOrder: z.number().int().optional().default(0),
});

export const MenuItemSchema = z.object({
  categoryId: z.string().min(1),
  subCategoryId: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: z.string().optional(),
  available: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
  modifiers: z.string().optional(),
});

export const MenuReorderSchema = z.object({
  items: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })),
});

export const CategoryReorderSchema = z.object({
  categories: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })),
});

// ──────────────────────────────────────────
// Tables
// ──────────────────────────────────────────
export const TableSchema = z.object({
  number: z.number().int().positive(),
  capacity: z.number().int().positive().optional().default(2),
  xPos: z.number().optional(),
  yPos: z.number().optional(),
});

export const TableMergeSchema = z.object({
  sourceTableId: z.string().min(1),
  targetTableId: z.string().min(1),
});

export const TableSplitSchema = z.object({
  tableId: z.string().min(1),
  orderItemIds: z.array(z.string().min(1)),
});

export const TransferOrderSchema = z.object({
  orderId: z.string().min(1),
  targetTableId: z.string().min(1),
});

// ──────────────────────────────────────────
// Orders
// ──────────────────────────────────────────
export const OrderItemSchema = z.object({
  menuItemId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  notes: z.string().optional(),
  modifiers: z.string().optional(),
});

export const CreateOrderSchema = z.object({
  tableId: z.string().min(1),
  customerName: z.string().optional(),
  items: z.array(OrderItemSchema).min(1),
  notes: z.string().optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'delivered', 'cancelled']),
});

// ──────────────────────────────────────────
// Payments
// ──────────────────────────────────────────
export const CreatePaymentIntentSchema = z.object({
  orderId: z.string().min(1),
  tip: z.number().optional(),
});

export const CashPaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().min(0),
  tip: z.number().optional(),
});

export const SplitPaymentSchema = z.object({
  orderId: z.string().min(1),
  splits: z.array(z.object({
    method: z.enum(['card', 'cash', 'wallet']),
    amount: z.number().min(0),
    tip: z.number().optional(),
  })),
});

export const CreatePaymentLinkSchema = z.object({
  orderId: z.string().optional(),
  amount: z.number().min(0),
  description: z.string().optional(),
});

// ──────────────────────────────────────────
// Users
// ──────────────────────────────────────────
export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['admin', 'manager', 'waiter', 'kitchen', 'cashier']),
  phone: z.string().optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'manager', 'waiter', 'kitchen', 'cashier']).optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
});

export const UserStatusSchema = z.object({
  isActive: z.boolean(),
});

// ──────────────────────────────────────────
// Modifiers
// ──────────────────────────────────────────
export const ModifierGroupSchema = z.object({
  name: z.string().min(1),
  selectionType: z.enum(['single', 'multiple']).optional().default('single'),
  isRequired: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

export const ModifierOptionSchema = z.object({
  name: z.string().min(1),
  priceAdjustment: z.number().optional().default(0),
  maxSelectable: z.number().int().positive().optional().default(1),
  sortOrder: z.number().int().optional().default(0),
});

// ──────────────────────────────────────────
// Promos
// ──────────────────────────────────────────
export const CampaignSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['percentage', 'fixed', 'buy_x_get_y', 'happy_hour']),
  value: z.number().min(0),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  daysOfWeek: z.string().optional(),
  timeStart: z.string().optional(),
  timeEnd: z.string().optional(),
  usageLimit: z.number().int().positive().optional(),
});

export const ApplyPromoSchema = z.object({
  code: z.string().min(1),
});

// ──────────────────────────────────────────
// Inventory
// ──────────────────────────────────────────
export const StockItemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().optional().default('units'),
  currentStock: z.number().min(0).optional().default(0),
  minStock: z.number().min(0).optional().default(0),
  costPerUnit: z.number().min(0).optional().default(0),
});

export const StockMovementSchema = z.object({
  stockItemId: z.string().min(1),
  type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().min(0),
  reason: z.string().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

export const LinkIngredientSchema = z.object({
  stockItemId: z.string().min(1),
  quantity: z.number().min(0),
});

// ──────────────────────────────────────────
// Integrations
// ──────────────────────────────────────────
export const IntegrationSchema = z.object({
  name: z.string().min(1),
  provider: z.enum(['delivery', 'accounting', 'custom']),
  url: z.string().url(),
  events: z.string().optional().default('order_created,payment_completed'),
});

// ──────────────────────────────────────────
// Onboarding
// ──────────────────────────────────────────
export const OnboardingSignupSchema = z.object({
  restaurantName: z.string().min(1),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().optional().default('USD'),
  timezone: z.string().optional().default('UTC'),
});

export const PlanSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  maxMenus: z.number().int().optional(),
  maxTables: z.number().int().optional(),
  maxStaff: z.number().int().optional(),
  features: z.string().optional(),
});

// ──────────────────────────────────────────
// Demo
// ──────────────────────────────────────────
export const CreateDemoSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  restaurant: z.string().min(1).max(100),
  phone: z.string().optional(),
  size: z.string().optional(),
  message: z.string().optional(),
});

// ──────────────────────────────────────────
// Printer
// ──────────────────────────────────────────
export const CreatePrinterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['thermal', 'laser', 'network', 'browser']),
  address: z.string().optional(),
  port: z.number().int().positive().optional(),
  autoPrint: z.boolean().optional(),
});

// ──────────────────────────────────────────
// Groups
// ──────────────────────────────────────────
export const CreateGroupSchema = z.object({
  name: z.string().min(1),
  ownerUserId: z.string().optional(),
});

export const TenantStatusSchema = z.object({
  isActive: z.boolean(),
});

// ──────────────────────────────────────────
// Customers
// ──────────────────────────────────────────
export const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export const UpdateCustomerSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

// ──────────────────────────────────────────
// Common response schemas
// ──────────────────────────────────────────
export const ErrorResponseSchema = z.object({
  error: z.string(),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});

export const PaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export function paginatedResponse<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationMetaSchema,
  });
}

// ──────────────────────────────────────────
// OpenAPI 3.1 document
// ──────────────────────────────────────────
// Reused path parameter descriptors (hotel routes lean on these heavily).
const SLUG_PARAM = { name: 'slug', in: 'path', required: true, schema: { type: 'string' } } as const;
const ROOM_ID_PARAM = { name: 'roomId', in: 'path', required: true, schema: { type: 'string' } } as const;
const BOOKING_ID_PARAM = { name: 'bookingId', in: 'path', required: true, schema: { type: 'string' } } as const;
const ROOM_TOKEN_PARAM = {
  name: 'token', in: 'path', required: true, schema: { type: 'string' },
  description: 'A room\'s unguessable in-room service token, rotated at check-out.',
} as const;

export const openApiSchema = {
  openapi: '3.1.0',
  info: {
    title: 'Qlisted API',
    version: '1.0.0',
    description: `RESTful API for Qlisted — a QR code restaurant ordering and payment platform.

## Authentication
Most endpoints require a Bearer JWT token in the \`Authorization\` header.
Obtain tokens via \`POST /api/auth/login\`.

## Tenant-scoped routes
All resource routes under \`/api/r/{slug}/...\` require a restaurant slug in the URL path.
Public endpoints (menu browsing, order creation) don't need auth.
Admin/management endpoints require auth with appropriate roles.

## Venue types
Tenants declare a \`venueType\` of \`restaurant\`, \`hotel\`, or \`both\`. Hotel endpoints
(rooms, reservations, folios, in-room room service, hotel reporting) are gated by
\`requireVenue('hotel','both')\`, so a restaurant-only tenant receives \`403\` even with a
valid token. \`super_admin\` bypasses the venue check. Restaurant endpoints are available
to every venue type.`,
  },
  servers: [
    { url: 'https://api.qcart.app', description: 'Production server' },
    { url: 'http://localhost:3001', description: 'Local development' },
  ],
  paths: {
    // ── Health ──
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Verifies the API and database connection are operational.',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok'] },
                    db: { type: 'string', enum: ['up'] },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Database is down',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['degraded'] },
                    db: { type: 'string', enum: ['down'] },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Auth ──
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        operationId: 'registerUser',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } } },
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '400': { description: 'Validation error' },
          '409': { description: 'Email already in use' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        operationId: 'loginUser',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenResponse' } } },
          },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        operationId: 'refreshToken',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenInput' } } },
        },
        responses: {
          '200': {
            description: 'Token refreshed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenResponse' } } },
          },
          '401': { description: 'Invalid or expired refresh token' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout',
        operationId: 'logoutUser',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenInput' } } },
        },
        responses: {
          '200': { description: 'Logged out successfully' },
        },
      },
    },
    '/api/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email address',
        operationId: 'verifyEmail',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyEmailInput' } } },
        },
        responses: {
          '200': { description: 'Email verified' },
          '400': { description: 'Invalid or expired token' },
        },
      },
    },
    '/api/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Resend verification email',
        operationId: 'resendVerification',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResendVerificationInput' } } },
        },
        responses: {
          '200': { description: 'Verification email sent' },
        },
      },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset',
        operationId: 'forgotPassword',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordInput' } } },
        },
        responses: {
          '200': { description: 'Password reset email sent' },
        },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password',
        operationId: 'resetPassword',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordInput' } } },
        },
        responses: {
          '200': { description: 'Password reset successfully' },
          '400': { description: 'Invalid or expired token' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user',
        operationId: 'getCurrentUser',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current user profile',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } },
          },
          '401': { description: 'Authentication required' },
        },
      },
    },

    // ── Tenants ──
    '/api/tenants': {
      post: {
        tags: ['Tenants'],
        summary: 'Create a new tenant',
        operationId: 'createTenant',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTenantInput' } } },
        },
        responses: {
          '201': {
            description: 'Tenant created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TenantResponse' } } },
          },
          '409': { description: 'Slug or email conflict' },
        },
      },
    },
    '/api/tenants/{slug}': {
      get: {
        tags: ['Tenants'],
        summary: 'Get tenant by slug',
        operationId: 'getTenant',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Tenant details',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TenantResponse' } } },
          },
          '404': { description: 'Tenant not found' },
        },
      },
    },
    '/api/tenants/{slug}/settings': {
      put: {
        tags: ['Tenants'],
        summary: 'Update tenant settings',
        operationId: 'updateTenantSettings',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        responses: {
          '200': { description: 'Settings updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },

    // ── Menu ──
    '/api/r/{slug}/menu': {
      get: {
        tags: ['Menu'],
        summary: 'Get full menu for a restaurant',
        operationId: 'getMenu',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Menu with categories and items',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    categories: { type: 'array', items: { $ref: '#/components/schemas/MenuCategory' } },
                    items: { type: 'array', items: { $ref: '#/components/schemas/MenuItem' } },
                  },
                },
              },
            },
          },
          '404': { description: 'Restaurant not found' },
        },
      },
    },
    '/api/r/{slug}/menu/categories': {
      post: {
        tags: ['Menu'],
        summary: 'Create a menu category',
        operationId: 'createMenuCategory',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryInput' } } },
        },
        responses: {
          '201': { description: 'Category created' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/menu/categories/reorder': {
      put: {
        tags: ['Menu'],
        summary: 'Reorder menu categories',
        operationId: 'reorderCategories',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryReorderInput' } } },
        },
        responses: {
          '200': { description: 'Categories reordered' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/menu/categories/{categoryId}': {
      put: {
        tags: ['Menu'],
        summary: 'Update a menu category',
        operationId: 'updateMenuCategory',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryInput' } } },
        },
        responses: {
          '200': { description: 'Category updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
      delete: {
        tags: ['Menu'],
        summary: 'Delete a menu category',
        operationId: 'deleteMenuCategory',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Category deleted' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/menu/items': {
      post: {
        tags: ['Menu'],
        summary: 'Create a menu item',
        operationId: 'createMenuItem',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MenuItemInput' } } },
        },
        responses: {
          '201': { description: 'Menu item created' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/menu/reorder': {
      put: {
        tags: ['Menu'],
        summary: 'Reorder menu items',
        operationId: 'reorderMenuItems',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MenuReorderInput' } } },
        },
        responses: {
          '200': { description: 'Items reordered' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/menu/items/{itemId}': {
      put: {
        tags: ['Menu'],
        summary: 'Update a menu item',
        operationId: 'updateMenuItem',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        responses: {
          '200': { description: 'Menu item updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
      delete: {
        tags: ['Menu'],
        summary: 'Delete a menu item',
        operationId: 'deleteMenuItem',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Menu item deleted' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },

    // ── Tables ──
    // The scan target a printed QR actually points at: redirects a guest to the
    // ordering page. Documented because anyone reading this spec to build a
    // scanner needs the redirect, not the JSON resolver below.
    '/api/r/t/{qrToken}': {
      get: {
        tags: ['Tables'],
        summary: 'Open the guest menu for a QR token (302 redirect)',
        operationId: 'openTableByQrToken',
        parameters: [{ name: 'qrToken', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '302': { description: 'Redirect to /r/{slug}/table/{tableId}/menu, or to / for an unknown token' },
        },
      },
    },
    // The path was documented as /api/tables/resolve/{qrToken}, which is not
    // mounted — this router lives under /api/r.
    '/api/r/resolve/{qrToken}': {
      get: {
        tags: ['Tables'],
        summary: 'Resolve a table by QR token (JSON, for API clients)',
        operationId: 'resolveTableByQrToken',
        parameters: [{ name: 'qrToken', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Table details with tenant info',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TableResolveResponse' } } },
          },
          '404': { description: 'Table not found' },
        },
      },
    },
    '/api/r/{slug}/table/{qrToken}': {
      get: {
        tags: ['Tables'],
        summary: 'Get table info by QR token (scoped to tenant)',
        operationId: 'getTableByQrToken',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'qrToken', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Table info',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TableInfo' } } },
          },
          '404': { description: 'Table not found' },
        },
      },
    },
    '/api/r/{slug}/tables': {
      get: {
        tags: ['Tables'],
        summary: 'List all tables for a tenant',
        operationId: 'listTables',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'List of tables',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Table' } } } },
          },
          '401': { description: 'Authentication required' },
        },
      },
      post: {
        tags: ['Tables'],
        summary: 'Create a new table with QR code',
        operationId: 'createTable',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TableInput' } } },
        },
        responses: {
          '201': { description: 'Table created with QR code' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/tables/{tableId}': {
      put: {
        tags: ['Tables'],
        summary: 'Update a table',
        operationId: 'updateTable',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'tableId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        responses: {
          '200': { description: 'Table updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
      delete: {
        tags: ['Tables'],
        summary: 'Delete a table',
        operationId: 'deleteTable',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'tableId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Table deleted' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/tables/merge': {
      post: {
        tags: ['Tables'],
        summary: 'Merge two tables',
        operationId: 'mergeTables',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TableMergeInput' } } },
        },
        responses: {
          '200': { description: 'Tables merged' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/tables/split': {
      post: {
        tags: ['Tables'],
        summary: 'Split a table into two',
        operationId: 'splitTable',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TableSplitInput' } } },
        },
        responses: {
          '200': { description: 'Table split' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/tables/transfer-order': {
      post: {
        tags: ['Tables'],
        summary: 'Transfer an order to another table',
        operationId: 'transferOrder',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TransferOrderInput' } } },
        },
        responses: {
          '200': { description: 'Order transferred' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },

    // ── Orders ──
    '/api/r/{slug}/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Create a new order',
        operationId: 'createOrder',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrderInput' } } },
        },
        responses: {
          '201': {
            description: 'Order created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
          },
          '400': { description: 'Validation error' },
        },
      },
      get: {
        tags: ['Orders'],
        summary: 'List all orders for a tenant',
        operationId: 'listOrders',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Paginated order list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedOrders' } } },
          },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/table/{tableId}/orders': {
      get: {
        tags: ['Orders'],
        summary: 'Get orders for a specific table',
        operationId: 'getTableOrders',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'tableId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Table orders',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Order' } } } },
          },
        },
      },
    },
    '/api/r/{slug}/orders/{orderId}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order details',
        operationId: 'getOrderDetail',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Order detail',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
          },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/r/{slug}/orders/{orderId}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Update order status',
        operationId: 'updateOrderStatus',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateOrderStatusInput' } } },
        },
        responses: {
          '200': { description: 'Status updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/orders/server/{serverId}': {
      get: {
        tags: ['Orders'],
        summary: 'Get orders assigned to a server',
        operationId: 'getServerOrders',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'serverId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Server orders',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Order' } } } },
          },
        },
      },
    },

    // ── Payments ──
    '/api/r/{slug}/payments': {
      get: {
        tags: ['Payments'],
        summary: 'List payments for a tenant',
        operationId: 'listPayments',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Paginated payment list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedPayments' } } },
          },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/payments/create-intent': {
      post: {
        tags: ['Payments'],
        summary: 'Create a Stripe payment intent',
        operationId: 'createPaymentIntent',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePaymentIntentInput' } } },
        },
        responses: {
          '200': { description: 'Payment intent created' },
          '400': { description: 'Invalid request' },
        },
      },
    },
    '/api/r/{slug}/payments/cash': {
      post: {
        tags: ['Payments'],
        summary: 'Record a cash payment',
        operationId: 'recordCashPayment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CashPaymentInput' } } },
        },
        responses: {
          '201': { description: 'Cash payment recorded' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/payments/split': {
      post: {
        tags: ['Payments'],
        summary: 'Split a payment across multiple methods',
        operationId: 'splitPayment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SplitPaymentInput' } } },
        },
        responses: {
          '201': { description: 'Payment split recorded' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/payment-links': {
      post: {
        tags: ['Payments'],
        summary: 'Create a payment link',
        operationId: 'createPaymentLink',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePaymentLinkInput' } } },
        },
        responses: {
          '201': { description: 'Payment link created' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/payment-links/{token}': {
      get: {
        tags: ['Payments'],
        summary: 'Get a payment link by token',
        operationId: 'getPaymentLink',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Payment link details' },
          '404': { description: 'Payment link not found' },
        },
      },
    },
    '/api/webhooks/stripe': {
      post: {
        tags: ['Webhooks'],
        summary: 'Stripe webhook handler',
        operationId: 'stripeWebhook',
        responses: {
          '200': { description: 'Webhook processed' },
          '400': { description: 'Invalid payload or signature' },
        },
      },
    },

    // ── Users ──
    '/api/r/{slug}/users': {
      get: {
        tags: ['Users'],
        summary: 'List staff users for a tenant',
        operationId: 'listUsers',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Paginated user list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedUsers' } } },
          },
          '401': { description: 'Authentication required' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create a staff user',
        operationId: 'createUser',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserInput' } } },
        },
        responses: {
          '201': { description: 'User created' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
          '409': { description: 'Email already in use' },
        },
      },
    },
    '/api/r/{slug}/users/{userId}': {
      put: {
        tags: ['Users'],
        summary: 'Update a staff user',
        operationId: 'updateUser',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateUserInput' } } },
        },
        responses: {
          '200': { description: 'User updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
          '404': { description: 'User not found' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete a staff user',
        operationId: 'deleteUser',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'User deleted' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
          '404': { description: 'User not found' },
        },
      },
    },
    '/api/r/{slug}/users/{userId}/status': {
      patch: {
        tags: ['Users'],
        summary: 'Activate or deactivate a staff user',
        operationId: 'updateUserStatus',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserStatusInput' } } },
        },
        responses: {
          '200': { description: 'Status updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
          '404': { description: 'User not found' },
        },
      },
    },

    // ── Modifier Groups ──
    '/api/r/{slug}/modifier-groups': {
      get: {
        tags: ['Modifiers'],
        summary: 'List modifier groups',
        operationId: 'listModifierGroups',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'List of modifier groups' },
        },
      },
      post: {
        tags: ['Modifiers'],
        summary: 'Create a modifier group',
        operationId: 'createModifierGroup',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ModifierGroupInput' } } },
        },
        responses: {
          '201': { description: 'Modifier group created' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/modifier-groups/{groupId}': {
      put: {
        tags: ['Modifiers'],
        summary: 'Update a modifier group',
        operationId: 'updateModifierGroup',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'groupId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ModifierGroupInput' } } },
        },
        responses: {
          '200': { description: 'Modifier group updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
      delete: {
        tags: ['Modifiers'],
        summary: 'Delete a modifier group',
        operationId: 'deleteModifierGroup',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'groupId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Modifier group deleted' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/modifier-groups/{groupId}/options': {
      post: {
        tags: ['Modifiers'],
        summary: 'Add an option to a modifier group',
        operationId: 'addModifierOption',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'groupId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ModifierOptionInput' } } },
        },
        responses: {
          '201': { description: 'Option added' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/modifier-options/{optionId}': {
      put: {
        tags: ['Modifiers'],
        summary: 'Update a modifier option',
        operationId: 'updateModifierOption',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'optionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ModifierOptionInput' } } },
        },
        responses: {
          '200': { description: 'Option updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
      delete: {
        tags: ['Modifiers'],
        summary: 'Delete a modifier option',
        operationId: 'deleteModifierOption',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'optionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Option deleted' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/menu-items/{menuItemId}/modifiers': {
      get: {
        tags: ['Modifiers'],
        summary: 'Get modifiers for a menu item',
        operationId: 'getMenuItemModifiers',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'menuItemId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Modifier groups linked to item' },
        },
      },
    },
    '/api/r/{slug}/menu-items/{menuItemId}/modifiers/{groupId}': {
      post: {
        tags: ['Modifiers'],
        summary: 'Link a modifier group to a menu item',
        operationId: 'linkMenuItemModifier',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'menuItemId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'groupId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '201': { description: 'Modifier linked' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
      delete: {
        tags: ['Modifiers'],
        summary: 'Unlink a modifier group from a menu item',
        operationId: 'unlinkMenuItemModifier',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'menuItemId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'groupId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Modifier unlinked' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },

    // ── Promotions / Campaigns ──
    '/api/r/{slug}/campaigns': {
      get: {
        tags: ['Promotions'],
        summary: 'List promo campaigns',
        operationId: 'listCampaigns',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'List of campaigns' },
          '401': { description: 'Authentication required' },
        },
      },
      post: {
        tags: ['Promotions'],
        summary: 'Create a promo campaign',
        operationId: 'createCampaign',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CampaignInput' } } },
        },
        responses: {
          '201': { description: 'Campaign created' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/campaigns/{campaignId}': {
      put: {
        tags: ['Promotions'],
        summary: 'Update a promo campaign',
        operationId: 'updateCampaign',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'campaignId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CampaignInput' } } },
        },
        responses: {
          '200': { description: 'Campaign updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
      delete: {
        tags: ['Promotions'],
        summary: 'Delete a promo campaign',
        operationId: 'deleteCampaign',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'campaignId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Campaign deleted' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },
    '/api/r/{slug}/orders/{orderId}/apply-promo': {
      post: {
        tags: ['Promotions'],
        summary: 'Apply a promo code to an order',
        operationId: 'applyPromoCode',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApplyPromoInput' } } },
        },
        responses: {
          '200': { description: 'Promo applied' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },

    // ── Inventory ──
    '/api/r/{slug}/inventory': {
      get: {
        tags: ['Inventory'],
        summary: 'List stock items',
        operationId: 'listStockItems',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'List of stock items' },
          '401': { description: 'Authentication required' },
        },
      },
      post: {
        tags: ['Inventory'],
        summary: 'Create a stock item',
        operationId: 'createStockItem',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/StockItemInput' } } },
        },
        responses: {
          '201': { description: 'Stock item created' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/inventory/{itemId}': {
      put: {
        tags: ['Inventory'],
        summary: 'Update a stock item',
        operationId: 'updateStockItem',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/StockItemInput' } } },
        },
        responses: {
          '200': { description: 'Stock item updated' },
          '401': { description: 'Authentication required' },
        },
      },
      delete: {
        tags: ['Inventory'],
        summary: 'Delete a stock item',
        operationId: 'deleteStockItem',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Stock item deleted' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/inventory/low-stock': {
      get: {
        tags: ['Inventory'],
        summary: 'Get low stock items',
        operationId: 'getLowStockItems',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Low stock items' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/inventory/movements': {
      get: {
        tags: ['Inventory'],
        summary: 'Get stock movements',
        operationId: 'getStockMovements',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'stockItemId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Stock movements' },
          '401': { description: 'Authentication required' },
        },
      },
      post: {
        tags: ['Inventory'],
        summary: 'Record a stock movement',
        operationId: 'recordStockMovement',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/StockMovementInput' } } },
        },
        responses: {
          '201': { description: 'Movement recorded' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/inventory/ingredients/{menuItemId}': {
      get: {
        tags: ['Inventory'],
        summary: 'Get ingredients for a menu item',
        operationId: 'getMenuItemIngredients',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'menuItemId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Ingredients list' },
        },
      },
      post: {
        tags: ['Inventory'],
        summary: 'Link an ingredient to a menu item',
        operationId: 'linkIngredient',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'menuItemId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LinkIngredientInput' } } },
        },
        responses: {
          '201': { description: 'Ingredient linked' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/inventory/ingredients/{menuItemId}/{stockItemId}': {
      delete: {
        tags: ['Inventory'],
        summary: 'Unlink an ingredient from a menu item',
        operationId: 'unlinkIngredient',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'menuItemId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'stockItemId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Ingredient unlinked' },
          '401': { description: 'Authentication required' },
        },
      },
    },

    // ── Customers ──
    '/api/r/{slug}/customers': {
      get: {
        tags: ['Customers'],
        summary: 'List customers',
        operationId: 'listCustomers',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Customer list' },
          '401': { description: 'Authentication required' },
        },
      },
      post: {
        tags: ['Customers'],
        summary: 'Find or create a customer',
        operationId: 'findOrCreateCustomer',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCustomerInput' } } },
        },
        responses: {
          '201': { description: 'Customer found or created' },
        },
      },
    },
    '/api/r/{slug}/customers/{customerId}': {
      put: {
        tags: ['Customers'],
        summary: 'Update a customer',
        operationId: 'updateCustomer',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'customerId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateCustomerInput' } } },
        },
        responses: {
          '200': { description: 'Customer updated' },
          '401': { description: 'Authentication required' },
        },
      },
    },

    // ── Integrations ──
    '/api/r/{slug}/integrations': {
      get: {
        tags: ['Integrations'],
        summary: 'List webhook integrations',
        operationId: 'listIntegrations',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Integration list' },
          '401': { description: 'Authentication required' },
        },
      },
      post: {
        tags: ['Integrations'],
        summary: 'Create a webhook integration',
        operationId: 'createIntegration',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/IntegrationInput' } } },
        },
        responses: {
          '201': { description: 'Integration created' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/integrations/{integrationId}': {
      put: {
        tags: ['Integrations'],
        summary: 'Update a webhook integration',
        operationId: 'updateIntegration',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'integrationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        responses: {
          '200': { description: 'Integration updated' },
          '401': { description: 'Authentication required' },
        },
      },
      delete: {
        tags: ['Integrations'],
        summary: 'Delete a webhook integration',
        operationId: 'deleteIntegration',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'integrationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Integration deleted' },
          '401': { description: 'Authentication required' },
        },
      },
    },

    // ── Analytics ──
    '/api/r/{slug}/analytics/summary': {
      get: {
        tags: ['Analytics'],
        summary: 'Get analytics summary dashboard',
        operationId: 'getAnalyticsSummary',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Analytics summary' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/analytics/revenue': {
      get: {
        tags: ['Analytics'],
        summary: 'Get daily revenue for the last 7 days',
        operationId: 'getRevenueAnalytics',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Daily revenue data' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/analytics/financial': {
      get: {
        tags: ['Analytics'],
        summary: 'Get financial overview',
        operationId: 'getFinancialAnalytics',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Financial data' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/analytics/hourly-traffic': {
      get: {
        tags: ['Analytics'],
        summary: 'Get hourly order traffic',
        operationId: 'getHourlyTraffic',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Hourly traffic data' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/analytics/category-performance': {
      get: {
        tags: ['Analytics'],
        summary: 'Get category performance metrics',
        operationId: 'getCategoryPerformance',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Category performance' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/analytics/peak-hours': {
      get: {
        tags: ['Analytics'],
        summary: 'Get peak hours data',
        operationId: 'getPeakHours',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Peak hours data' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/analytics/item-pairings': {
      get: {
        tags: ['Analytics'],
        summary: 'Get frequently ordered item pairings',
        operationId: 'getItemPairings',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Item pairings' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/analytics/recommendations': {
      get: {
        tags: ['Analytics'],
        summary: 'Get menu item recommendations',
        operationId: 'getRecommendations',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'menuItemId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Recommendations' },
        },
      },
    },
    '/api/r/{slug}/analytics/trending': {
      get: {
        tags: ['Analytics'],
        summary: 'Get trending menu items',
        operationId: 'getTrendingItems',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Trending items' },
        },
      },
    },

    // ── Prints ──
    '/api/r/{slug}/prints': {
      get: {
        tags: ['Prints'],
        summary: 'List print jobs',
        operationId: 'listPrintJobs',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'orderId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Print jobs list' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/prints/reprint/{jobId}': {
      post: {
        tags: ['Prints'],
        summary: 'Reprint a print job',
        operationId: 'reprintJob',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'jobId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Job reprinted' },
          '401': { description: 'Authentication required' },
          '404': { description: 'Job not found' },
        },
      },
    },
    '/api/r/{slug}/prints/printers': {
      get: {
        tags: ['Prints'],
        summary: 'List printers',
        operationId: 'listPrinters',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Printer list' },
          '401': { description: 'Authentication required' },
        },
      },
      post: {
        tags: ['Prints'],
        summary: 'Create a printer',
        operationId: 'createPrinter',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePrinterInput' } } },
        },
        responses: {
          '201': { description: 'Printer created' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/prints/printers/{printerId}': {
      patch: {
        tags: ['Prints'],
        summary: 'Update a printer',
        operationId: 'updatePrinter',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'printerId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePrinterInput' } } },
        },
        responses: {
          '200': { description: 'Printer updated' },
          '401': { description: 'Authentication required' },
        },
      },
      delete: {
        tags: ['Prints'],
        summary: 'Delete a printer',
        operationId: 'deletePrinter',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'printerId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Printer deleted' },
          '401': { description: 'Authentication required' },
        },
      },
    },

    // ── Uploads ──
    '/api/r/{slug}/upload': {
      post: {
        tags: ['Uploads'],
        summary: 'Upload an image file',
        operationId: 'uploadFile',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'File uploaded' },
          '400': { description: 'Invalid file' },
          '401': { description: 'Authentication required' },
        },
      },
    },

    // ── Events (SSE) ──
    '/api/r/{slug}/events': {
      get: {
        tags: ['Events'],
        summary: 'Subscribe to Server-Sent Events for real-time updates',
        operationId: 'subscribeEvents',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'SSE stream',
            content: { 'text/event-stream': { schema: { type: 'string' } } },
          },
        },
      },
    },

    // ── Exports ──
    '/api/r/{slug}/exports/orders': {
      get: {
        tags: ['Exports'],
        summary: 'Export orders as CSV',
        operationId: 'exportOrders',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': {
            description: 'CSV file',
            content: { 'text/csv': { schema: { type: 'string' } } },
          },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/exports/payments': {
      get: {
        tags: ['Exports'],
        summary: 'Export payments as CSV',
        operationId: 'exportPayments',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': {
            description: 'CSV file',
            content: { 'text/csv': { schema: { type: 'string' } } },
          },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/r/{slug}/exports/menu': {
      get: {
        tags: ['Exports'],
        summary: 'Export menu items as CSV',
        operationId: 'exportMenuItems',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'CSV file',
            content: { 'text/csv': { schema: { type: 'string' } } },
          },
          '401': { description: 'Authentication required' },
        },
      },
    },

    // ── Onboarding ──
    '/api/onboarding/signup': {
      post: {
        tags: ['Onboarding'],
        summary: 'Sign up a new restaurant',
        operationId: 'onboardingSignup',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OnboardingSignupInput' } } },
        },
        responses: {
          '201': { description: 'Restaurant created' },
          '409': { description: 'Slug or email conflict' },
        },
      },
    },
    '/api/onboarding/plans': {
      get: {
        tags: ['Onboarding'],
        summary: 'List subscription plans',
        operationId: 'listPlans',
        responses: {
          '200': { description: 'Plan list' },
        },
      },
      post: {
        tags: ['Onboarding'],
        summary: 'Create a subscription plan',
        operationId: 'createPlan',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PlanInput' } } },
        },
        responses: {
          '201': { description: 'Plan created' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Insufficient permissions' },
        },
      },
    },

    // ── Demo ──
    '/api/demo': {
      post: {
        tags: ['Demo'],
        summary: 'Submit a demo request',
        operationId: 'createDemoRequest',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateDemoInput' } } },
        },
        responses: {
          '201': { description: 'Demo request submitted' },
          '400': { description: 'Validation error' },
        },
      },
    },

    // ── Groups ──
    '/api/groups': {
      get: {
        tags: ['Groups'],
        summary: 'List tenant groups',
        operationId: 'listGroups',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Group list' },
          '401': { description: 'Authentication required' },
        },
      },
      post: {
        tags: ['Groups'],
        summary: 'Create a tenant group',
        operationId: 'createGroup',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateGroupInput' } } },
        },
        responses: {
          '201': { description: 'Group created' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/groups/{groupId}/tenants/{tenantId}': {
      post: {
        tags: ['Groups'],
        summary: 'Assign a tenant to a group',
        operationId: 'assignTenantToGroup',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'groupId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Tenant assigned' },
          '401': { description: 'Authentication required' },
        },
      },
      delete: {
        tags: ['Groups'],
        summary: 'Remove a tenant from a group',
        operationId: 'removeTenantFromGroup',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'groupId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Tenant removed' },
          '401': { description: 'Authentication required' },
        },
      },
    },
    '/api/groups/{groupId}/analytics': {
      get: {
        tags: ['Groups'],
        summary: 'Get analytics for a tenant group',
        operationId: 'getGroupAnalytics',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Group analytics' },
          '401': { description: 'Authentication required' },
        },
      },
    },

    // ── Admin ──
    '/api/admin/tenants': {
      get: {
        tags: ['Admin'],
        summary: 'List all tenants (super admin)',
        operationId: 'adminListTenants',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Tenant list' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Super admin only' },
        },
      },
    },
    '/api/admin/tenants/{tenantId}': {
      get: {
        tags: ['Admin'],
        summary: 'Get tenant details with stats (super admin)',
        operationId: 'adminGetTenant',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Tenant with stats' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Super admin only' },
          '404': { description: 'Tenant not found' },
        },
      },
    },
    '/api/admin/tenants/{tenantId}/status': {
      put: {
        tags: ['Admin'],
        summary: 'Activate or deactivate a tenant (super admin)',
        operationId: 'adminUpdateTenantStatus',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TenantStatusInput' } } },
        },
        responses: {
          '200': { description: 'Status updated' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Super admin only' },
          '404': { description: 'Tenant not found' },
        },
      },
    },
    '/api/admin/analytics': {
      get: {
        tags: ['Admin'],
        summary: 'Get platform-wide analytics (super admin)',
        operationId: 'adminGetAnalytics',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Platform analytics' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Super admin only' },
        },
      },
    },

    // ── Hotel: rooms, reservations, folio, room service ──────────────────────
    // All hotel routes are gated by requireVenue('hotel','both'): a tenant whose
    // venueType is 'restaurant' gets 403 regardless of role.
    '/api/r/{slug}/rooms': {
      get: {
        tags: ['Hotel'],
        summary: 'List all rooms',
        description: 'Rooms ordered by floor then number. Requires an admin/manager token and a hotel (or "both") venue.',
        operationId: 'hotelListRooms',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM],
        responses: {
          '200': { description: 'Room list' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Not a hotel tenant, or insufficient role' },
        },
      },
      post: {
        tags: ['Hotel'],
        summary: 'Create a room',
        description: 'Mints the room\'s unguessable in-room serviceToken used by the room-service QR link.',
        operationId: 'hotelCreateRoom',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HotelRoomInput' } } },
        },
        responses: {
          '201': { description: 'Room created' },
          '403': { description: 'Not a hotel tenant' },
        },
      },
    },
    '/api/r/{slug}/rooms/stats': {
      get: {
        tags: ['Hotel'],
        summary: 'Live room-status counts',
        description: 'Point-in-time occupancy: rooms with status "occupied" divided by total rooms. Distinct from hotelReport.occupancyPct, which is sold nights over available room-nights for a period.',
        operationId: 'hotelRoomStats',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM],
        responses: { '200': { description: 'Counts per status plus live occupancy %' } },
      },
    },
    '/api/r/{slug}/rooms/available': {
      get: {
        tags: ['Hotel'],
        summary: 'Rooms free in a date window',
        operationId: 'hotelAvailableRooms',
        security: [{ BearerAuth: [] }],
        parameters: [
          SLUG_PARAM,
          { name: 'checkIn', in: 'query', required: true, schema: { type: 'string' }, example: '2026-07-10' },
          { name: 'checkOut', in: 'query', required: true, schema: { type: 'string' }, example: '2026-07-12' },
        ],
        responses: { '200': { description: 'Rooms with no overlapping active booking' } },
      },
    },
    '/api/r/{slug}/rooms/{roomId}': {
      put: {
        tags: ['Hotel'],
        summary: 'Update a room',
        description: 'housekeeperId is validated against this tenant\'s users; a cross-tenant user id is rejected with 400.',
        operationId: 'hotelUpdateRoom',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, ROOM_ID_PARAM],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HotelRoomUpdateInput' } } },
        },
        responses: {
          '200': { description: 'Room updated' },
          '400': { description: 'Validation failed, or housekeeper not in this tenant' },
          '403': { description: 'Not a hotel tenant' },
        },
      },
      delete: {
        tags: ['Hotel'],
        summary: 'Delete a room',
        operationId: 'hotelDeleteRoom',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, ROOM_ID_PARAM],
        responses: { '200': { description: 'Room deleted' } },
      },
    },
    '/api/r/{slug}/rooms/{roomId}/status': {
      post: {
        tags: ['Hotel'],
        summary: 'Change room status (front desk / housekeeping)',
        operationId: 'hotelSetRoomStatus',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, ROOM_ID_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['available', 'occupied', 'cleaning', 'maintenance', 'reserved'] },
                  guestName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Status updated; "available" clears the guest name' } },
      },
    },
    '/api/r/{slug}/rooms/{roomId}/regenerate-token': {
      post: {
        tags: ['Hotel'],
        summary: 'Rotate a room\'s service token',
        description: 'Invalidates the previous in-room ordering link immediately.',
        operationId: 'hotelRegenerateRoomToken',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, ROOM_ID_PARAM],
        responses: { '200': { description: 'New serviceToken' } },
      },
    },
    '/api/r/{slug}/hotel-report': {
      get: {
        tags: ['Hotel'],
        summary: 'Hotel performance report for a date range',
        description: 'Period metrics attributed by check-in date: occupancyPct (sold nights / available room-nights), ADR, RevPAR, room revenue, arrivals and departures.',
        operationId: 'hotelReport',
        security: [{ BearerAuth: [] }],
        parameters: [
          SLUG_PARAM,
          { name: 'from', in: 'query', required: true, schema: { type: 'string' }, example: '2026-07-01' },
          { name: 'to', in: 'query', required: true, schema: { type: 'string' }, example: '2026-07-31' },
        ],
        responses: {
          '200': { description: 'Report' },
          '400': { description: 'Invalid or empty date range' },
        },
      },
    },
    '/api/r/{slug}/bookings': {
      get: {
        tags: ['Hotel'],
        summary: 'List reservations with room numbers joined',
        operationId: 'hotelListBookings',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM],
        responses: { '200': { description: 'Bookings, newest check-in first' } },
      },
      post: {
        tags: ['Hotel'],
        summary: 'Create a reservation',
        description: 'Rejects overlapping active bookings for the same room, snapshots the nightly rate, flips an available room to "reserved", and emails/SMS the guest.',
        operationId: 'hotelCreateBooking',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HotelBookingInput' } } },
        },
        responses: {
          '201': { description: 'Booking created' },
          '400': { description: 'Unknown room, bad date range, or overlapping booking' },
        },
      },
    },
    '/api/r/{slug}/bookings/{bookingId}/check-in': {
      post: {
        tags: ['Hotel'],
        summary: 'Check a guest in',
        description: 'Booking becomes checked_in, room becomes occupied, and the guest is emailed their room-service link.',
        operationId: 'hotelCheckIn',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, BOOKING_ID_PARAM],
        responses: { '200': { description: 'Checked in' }, '404': { description: 'Booking not found' } },
      },
    },
    '/api/r/{slug}/bookings/{bookingId}/check-out': {
      post: {
        tags: ['Hotel'],
        summary: 'Check a guest out',
        description: 'Booking becomes checked_out, room becomes cleaning, guest is cleared, and the service token is rotated so the departing guest\'s link dies.',
        operationId: 'hotelCheckOut',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, BOOKING_ID_PARAM],
        responses: { '200': { description: 'Checked out' }, '404': { description: 'Booking not found' } },
      },
    },
    '/api/r/{slug}/bookings/{bookingId}/cancel': {
      post: {
        tags: ['Hotel'],
        summary: 'Cancel a reservation',
        operationId: 'hotelCancelBooking',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, BOOKING_ID_PARAM],
        responses: { '200': { description: 'Cancelled; a merely-reserved room is freed' } },
      },
    },
    '/api/r/{slug}/bookings/{bookingId}/folio': {
      get: {
        tags: ['Hotel'],
        summary: 'Get the guest folio',
        description: 'Room charge, itemised extras, grand total, deposit, and outstanding balance. Room-service charges are posted here one line per item.',
        operationId: 'hotelGetFolio',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, BOOKING_ID_PARAM],
        responses: { '200': { description: 'Folio' }, '404': { description: 'Booking not found' } },
      },
      post: {
        tags: ['Hotel'],
        summary: 'Post a charge to the folio',
        operationId: 'hotelAddFolioItem',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, BOOKING_ID_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['description', 'amount'],
                properties: { description: { type: 'string' }, amount: { type: 'number', minimum: 0 } },
              },
            },
          },
        },
        responses: { '201': { description: 'Charge posted' } },
      },
    },
    '/api/r/{slug}/folio/{folioItemId}': {
      delete: {
        tags: ['Hotel'],
        summary: 'Remove a folio charge',
        operationId: 'hotelDeleteFolioItem',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, { name: 'folioItemId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Charge removed' } },
      },
    },
    '/api/r/{slug}/bookings/{bookingId}/folio/pay-link': {
      post: {
        tags: ['Hotel'],
        summary: 'Create a Stripe link for the outstanding balance',
        operationId: 'hotelFolioPayLink',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, BOOKING_ID_PARAM],
        responses: {
          '201': { description: 'Payment link created' },
          '400': { description: 'Nothing outstanding' },
        },
      },
    },
    '/api/r/{slug}/bookings/{bookingId}/folio/settle': {
      post: {
        tags: ['Hotel'],
        summary: 'Mark the folio settled (cash / manual)',
        operationId: 'hotelSettleFolio',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, BOOKING_ID_PARAM],
        responses: { '200': { description: 'Folio settled' } },
      },
    },
    '/api/r/{slug}/bookings/{bookingId}/folio/deposit': {
      post: {
        tags: ['Hotel'],
        summary: 'Record a deposit and return a pay link',
        description: 'Defaults to one night\'s rate when no amount is supplied.',
        operationId: 'hotelTakeDeposit',
        security: [{ BearerAuth: [] }],
        parameters: [SLUG_PARAM, BOOKING_ID_PARAM],
        responses: { '201': { description: 'Deposit recorded with a payment link' } },
      },
    },
    '/api/r/{slug}/book/availability': {
      get: {
        tags: ['Hotel'],
        summary: 'Public room availability',
        description: 'Guest-facing. Returns only id/number/type/rate — never the service token.',
        operationId: 'hotelPublicAvailability',
        parameters: [
          SLUG_PARAM,
          { name: 'checkIn', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'checkOut', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Free rooms, or [] for an invalid range' } },
      },
    },
    '/api/r/{slug}/book': {
      post: {
        tags: ['Hotel'],
        summary: 'Public reservation',
        description: 'Guest-facing. Returns an optional one-night deposit link; depositAmount is only recorded once the payment webhook fires.',
        operationId: 'hotelPublicBook',
        parameters: [SLUG_PARAM],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HotelBookingInput' } } },
        },
        responses: {
          '201': { description: 'Booking created, plus deposit link when a rate is set' },
          '400': { description: 'Unknown room, bad date range, or overlapping booking' },
          '403': { description: 'Not a hotel tenant' },
        },
      },
    },
    '/api/r/{slug}/room/{token}/stay': {
      get: {
        tags: ['Hotel'],
        summary: 'Resolve the active stay for an in-room token',
        operationId: 'hotelRoomStay',
        parameters: [SLUG_PARAM, ROOM_TOKEN_PARAM],
        responses: { '200': { description: '{ active, guestName, roomNumber }' } },
      },
    },
    '/api/r/{slug}/room/{token}/menu': {
      get: {
        tags: ['Hotel'],
        summary: 'In-room menu for the active stay',
        description: 'Guest-facing. Validates the token and returns only items that are both available and flagged roomServiceAvailable, so restaurant-only dishes are never offered to a room. 400 on a dead token.',
        operationId: 'hotelRoomServiceMenu',
        parameters: [SLUG_PARAM, ROOM_TOKEN_PARAM],
        responses: {
          '200': { description: 'Guest, room, currency, categories and deliverable items' },
          '400': { description: 'No active stay for this room' },
        },
      },
    },
    '/api/r/{slug}/room/{token}/order': {
      post: {
        tags: ['Hotel'],
        summary: 'Place a room-service order',
        description: 'Guest-facing. Re-prices every line from the live menu and drops unavailable ones rather than trusting posted prices, links the order to the booking (orders.booking_id), and posts one folio line per item.',
        operationId: 'hotelRoomServiceOrder',
        parameters: [SLUG_PARAM, ROOM_TOKEN_PARAM],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RoomServiceOrderInput' } } },
        },
        responses: {
          '201': { description: 'Order placed and charged to the folio' },
          '400': { description: 'No active stay, or no ordered items are still available' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from POST /api/auth/login',
      },
    },
    schemas: {
      // ── Hotel ──
      HotelRoomInput: {
        type: 'object',
        required: ['number'],
        properties: {
          number: { type: 'string', minLength: 1 },
          type: { type: 'string' },
          floor: { type: 'string' },
          status: { type: 'string', enum: ['available', 'occupied', 'cleaning', 'maintenance', 'reserved'] },
          rate: { type: 'number', minimum: 0, description: 'Price per night' },
          notes: { type: 'string' },
        },
      },
      HotelRoomUpdateInput: {
        type: 'object',
        description: 'All fields optional. housekeeperId must reference a user of this tenant.',
        properties: {
          number: { type: 'string', minLength: 1 },
          type: { type: 'string' },
          floor: { type: 'string' },
          status: { type: 'string', enum: ['available', 'occupied', 'cleaning', 'maintenance', 'reserved'] },
          rate: { type: 'number', minimum: 0 },
          notes: { type: 'string' },
          housekeeperId: { type: ['string', 'null'] },
          guestName: { type: 'string' },
        },
      },
      HotelBookingInput: {
        type: 'object',
        required: ['roomId', 'guestName', 'checkIn', 'checkOut'],
        properties: {
          roomId: { type: 'string' },
          guestName: { type: 'string' },
          guestEmail: { type: 'string', format: 'email' },
          guestPhone: { type: 'string' },
          checkIn: { type: 'string', example: '2026-07-10' },
          checkOut: { type: 'string', example: '2026-07-12' },
          notes: { type: 'string' },
        },
      },
      RoomServiceOrderInput: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            description: 'Names and prices are advisory — the server re-prices from the live menu and drops items no longer deliverable.',
            items: {
              type: 'object',
              required: ['menuItemId', 'name', 'quantity', 'unitPrice'],
              properties: {
                menuItemId: { type: 'string' },
                name: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                unitPrice: { type: 'number', minimum: 0 },
              },
            },
          },
        },
      },

      // ── Error ──
      ErrorResponse: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error'],
      },
      SuccessResponse: {
        type: 'object',
        properties: { success: { type: 'boolean' } },
        required: ['success'],
      },

      // ── Pagination ──
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },

      // ── Auth Inputs ──
      RegisterInput: {
        type: 'object',
        properties: {
          tenantSlug: { type: 'string', minLength: 1, maxLength: 50 },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6, maxLength: 100 },
          role: { type: 'string', enum: ['admin', 'manager', 'waiter', 'kitchen', 'cashier'], default: 'waiter' },
        },
        required: ['tenantSlug', 'name', 'email', 'password'],
      },
      LoginInput: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
      },
      RefreshTokenInput: {
        type: 'object',
        properties: { refreshToken: { type: 'string' } },
        required: ['refreshToken'],
      },
      VerifyEmailInput: {
        type: 'object',
        properties: { token: { type: 'string' } },
        required: ['token'],
      },
      ResendVerificationInput: {
        type: 'object',
        properties: { email: { type: 'string', format: 'email' } },
        required: ['email'],
      },
      ForgotPasswordInput: {
        type: 'object',
        properties: { email: { type: 'string', format: 'email' } },
        required: ['email'],
      },
      ResetPasswordInput: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          password: { type: 'string', minLength: 8, maxLength: 100 },
        },
        required: ['token', 'password'],
      },

      // ── Auth Responses ──
      AuthResponse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string' },
          tenantId: { type: 'string' },
        },
      },
      TokenResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          user: { $ref: '#/components/schemas/UserProfile' },
        },
      },
      UserProfile: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string' },
          phone: { type: 'string' },
          avatar: { type: 'string' },
          isActive: { type: 'boolean' },
          emailVerified: { type: 'boolean' },
          tenantId: { type: 'string' },
          joinedAt: { type: 'string', format: 'date-time' },
          lastActive: { type: 'string', format: 'date-time' },
        },
      },

      // ── Tenant ──
      CreateTenantInput: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          slug: { type: 'string', minLength: 1, maxLength: 50, pattern: '^[a-z0-9-]+$' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          adminName: { type: 'string', minLength: 1, maxLength: 100 },
          adminPassword: { type: 'string', minLength: 6, maxLength: 100 },
        },
        required: ['name', 'slug', 'email', 'adminName', 'adminPassword'],
      },
      TenantResponse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          address: { type: 'string' },
          currency: { type: 'string' },
          timezone: { type: 'string' },
          logoUrl: { type: 'string' },
          coverImage: { type: 'string' },
          primaryColor: { type: 'string' },
          taxRate: { type: 'number' },
          serviceCharge: { type: 'number' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Menu ──
      MenuCategory: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tenantId: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['main', 'sub'] },
          parentId: { type: 'string' },
          sortOrder: { type: 'integer' },
        },
      },
      MenuItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tenantId: { type: 'string' },
          categoryId: { type: 'string' },
          subCategoryId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number' },
          imageUrl: { type: 'string' },
          imageData: { type: 'string' },
          available: { type: 'boolean' },
          sortOrder: { type: 'integer' },
          modifiers: { type: 'string' },
        },
      },
      CategoryInput: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          type: { type: 'string', enum: ['main', 'sub'], default: 'main' },
          parentId: { type: 'string' },
          sortOrder: { type: 'integer', default: 0 },
        },
        required: ['name'],
      },
      MenuItemInput: {
        type: 'object',
        properties: {
          categoryId: { type: 'string' },
          subCategoryId: { type: 'string' },
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string' },
          price: { type: 'number', exclusiveMinimum: 0 },
          imageUrl: { type: 'string' },
          available: { type: 'boolean', default: true },
          sortOrder: { type: 'integer', default: 0 },
          modifiers: { type: 'string' },
        },
        required: ['categoryId', 'name', 'price'],
      },
      MenuReorderInput: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, sortOrder: { type: 'integer' } },
              required: ['id', 'sortOrder'],
            },
          },
        },
        required: ['items'],
      },
      CategoryReorderInput: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, sortOrder: { type: 'integer' } },
              required: ['id', 'sortOrder'],
            },
          },
        },
        required: ['categories'],
      },

      // ── Tables ──
      Table: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tenantId: { type: 'string' },
          number: { type: 'integer' },
          capacity: { type: 'integer' },
          status: { type: 'string', enum: ['available', 'occupied', 'reserved', 'closed'] },
          qrToken: { type: 'string' },
          qrImage: { type: 'string' },
          xPos: { type: 'number' },
          yPos: { type: 'number' },
        },
      },
      TableInfo: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          number: { type: 'integer' },
          capacity: { type: 'integer' },
          status: { type: 'string' },
          qrImage: { type: 'string' },
        },
      },
      TableResolveResponse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          number: { type: 'integer' },
          capacity: { type: 'integer' },
          status: { type: 'string' },
          qrToken: { type: 'string' },
          qrImage: { type: 'string' },
          tenantSlug: { type: 'string' },
          tenantName: { type: 'string' },
        },
      },
      TableInput: {
        type: 'object',
        properties: {
          number: { type: 'integer', exclusiveMinimum: 0 },
          capacity: { type: 'integer', default: 2, exclusiveMinimum: 0 },
          xPos: { type: 'number' },
          yPos: { type: 'number' },
        },
        required: ['number'],
      },
      TableMergeInput: {
        type: 'object',
        properties: {
          sourceTableId: { type: 'string' },
          targetTableId: { type: 'string' },
        },
        required: ['sourceTableId', 'targetTableId'],
      },
      TableSplitInput: {
        type: 'object',
        properties: {
          tableId: { type: 'string' },
          orderItemIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['tableId', 'orderItemIds'],
      },
      TransferOrderInput: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          targetTableId: { type: 'string' },
        },
        required: ['orderId', 'targetTableId'],
      },

      // ── Orders ──
      OrderItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          orderId: { type: 'string' },
          menuItemId: { type: 'string' },
          name: { type: 'string' },
          quantity: { type: 'integer' },
          unitPrice: { type: 'number' },
          modifiers: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tenantId: { type: 'string' },
          tableId: { type: 'string' },
          serverId: { type: 'string' },
          customerName: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'] },
          itemCount: { type: 'integer' },
          subtotal: { type: 'number' },
          tax: { type: 'number' },
          serviceCharge: { type: 'number' },
          total: { type: 'number' },
          paymentStatus: { type: 'string', enum: ['unpaid', 'partially_paid', 'paid', 'refunded'] },
          paidAmount: { type: 'number' },
          notes: { type: 'string' },
          items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateOrderInput: {
        type: 'object',
        properties: {
          tableId: { type: 'string' },
          customerName: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                menuItemId: { type: 'string' },
                name: { type: 'string' },
                quantity: { type: 'integer', exclusiveMinimum: 0 },
                unitPrice: { type: 'number', exclusiveMinimum: 0 },
                notes: { type: 'string' },
                modifiers: { type: 'string' },
              },
              required: ['menuItemId', 'name', 'quantity', 'unitPrice'],
            },
            minItems: 1,
          },
          notes: { type: 'string' },
        },
        required: ['tableId', 'items'],
      },
      UpdateOrderStatusInput: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'] },
        },
        required: ['status'],
      },
      PaginatedOrders: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
          pagination: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },

      // ── Payments ──
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tenantId: { type: 'string' },
          orderId: { type: 'string' },
          amount: { type: 'number' },
          tip: { type: 'number' },
          method: { type: 'string', enum: ['card', 'wallet', 'cash', 'crypto'] },
          status: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'] },
          stripePaymentIntentId: { type: 'string' },
          stripePaymentLinkId: { type: 'string' },
          receiptUrl: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PaginatedPayments: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Payment' } },
          pagination: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
      CreatePaymentIntentInput: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          tip: { type: 'number' },
        },
        required: ['orderId'],
      },
      CashPaymentInput: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          amount: { type: 'number' },
          tip: { type: 'number' },
        },
        required: ['orderId', 'amount'],
      },
      SplitPaymentInput: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          splits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                method: { type: 'string', enum: ['card', 'cash', 'wallet'] },
                amount: { type: 'number' },
                tip: { type: 'number' },
              },
              required: ['method', 'amount'],
            },
          },
        },
        required: ['orderId', 'splits'],
      },
      CreatePaymentLinkInput: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          amount: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['amount'],
      },

      // ── Users ──
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['super_admin', 'admin', 'manager', 'waiter', 'kitchen', 'cashier'] },
          phone: { type: 'string' },
          avatar: { type: 'string' },
          isActive: { type: 'boolean' },
          joinedAt: { type: 'string', format: 'date-time' },
          lastActive: { type: 'string', format: 'date-time' },
        },
      },
      PaginatedUsers: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/User' } },
          pagination: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
      CreateUserInput: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6, maxLength: 100 },
          role: { type: 'string', enum: ['admin', 'manager', 'waiter', 'kitchen', 'cashier'] },
          phone: { type: 'string' },
        },
        required: ['name', 'email', 'password', 'role'],
      },
      UpdateUserInput: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'manager', 'waiter', 'kitchen', 'cashier'] },
          phone: { type: 'string' },
          avatar: { type: 'string' },
        },
      },
      UserStatusInput: {
        type: 'object',
        properties: { isActive: { type: 'boolean' } },
        required: ['isActive'],
      },

      // ── Modifiers ──
      ModifierGroupInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          selectionType: { type: 'string', enum: ['single', 'multiple'], default: 'single' },
          isRequired: { type: 'boolean', default: false },
          sortOrder: { type: 'integer', default: 0 },
        },
        required: ['name'],
      },
      ModifierOptionInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          priceAdjustment: { type: 'number', default: 0 },
          maxSelectable: { type: 'integer', default: 1 },
          sortOrder: { type: 'integer', default: 0 },
        },
        required: ['name'],
      },

      // ── Campaigns ──
      CampaignInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['percentage', 'fixed', 'buy_x_get_y', 'happy_hour'] },
          value: { type: 'number', minimum: 0 },
          minOrderAmount: { type: 'number', minimum: 0 },
          maxDiscount: { type: 'number', minimum: 0 },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          daysOfWeek: { type: 'string' },
          timeStart: { type: 'string' },
          timeEnd: { type: 'string' },
          usageLimit: { type: 'integer' },
        },
        required: ['name', 'type', 'value'],
      },
      ApplyPromoInput: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
      },

      // ── Inventory ──
      StockItemInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          unit: { type: 'string', default: 'units' },
          currentStock: { type: 'number', default: 0 },
          minStock: { type: 'number', default: 0 },
          costPerUnit: { type: 'number', default: 0 },
        },
        required: ['name'],
      },
      StockMovementInput: {
        type: 'object',
        properties: {
          stockItemId: { type: 'string' },
          type: { type: 'string', enum: ['in', 'out', 'adjustment'] },
          quantity: { type: 'number', minimum: 0 },
          reason: { type: 'string' },
          referenceType: { type: 'string' },
          referenceId: { type: 'string' },
        },
        required: ['stockItemId', 'type', 'quantity'],
      },
      LinkIngredientInput: {
        type: 'object',
        properties: {
          stockItemId: { type: 'string' },
          quantity: { type: 'number' },
        },
        required: ['stockItemId', 'quantity'],
      },

      // ── Customers ──
      CreateCustomerInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
        },
        required: ['name'],
      },
      UpdateCustomerInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          notes: { type: 'string' },
        },
      },

      // ── Integrations ──
      IntegrationInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          provider: { type: 'string', enum: ['delivery', 'accounting', 'custom'] },
          url: { type: 'string', format: 'uri' },
          events: { type: 'string', default: 'order_created,payment_completed' },
        },
        required: ['name', 'provider', 'url'],
      },

      // ── Onboarding ──
      OnboardingSignupInput: {
        type: 'object',
        properties: {
          restaurantName: { type: 'string' },
          slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          phone: { type: 'string' },
          address: { type: 'string' },
          currency: { type: 'string', default: 'USD' },
          timezone: { type: 'string', default: 'UTC' },
        },
        required: ['restaurantName', 'slug', 'email', 'password'],
      },
      PlanInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          maxMenus: { type: 'integer' },
          maxTables: { type: 'integer' },
          maxStaff: { type: 'integer' },
          features: { type: 'string' },
        },
        required: ['name', 'price'],
      },

      // ── Demo ──
      CreateDemoInput: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          restaurant: { type: 'string', minLength: 1, maxLength: 100 },
          phone: { type: 'string' },
          size: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['name', 'email', 'restaurant'],
      },

      // ── Printer ──
      CreatePrinterInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['thermal', 'laser', 'network', 'browser'] },
          address: { type: 'string' },
          port: { type: 'integer' },
          autoPrint: { type: 'boolean' },
        },
        required: ['name', 'type'],
      },

      // ── Groups ──
      CreateGroupInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          ownerUserId: { type: 'string' },
        },
        required: ['name'],
      },
      TenantStatusInput: {
        type: 'object',
        properties: { isActive: { type: 'boolean' } },
        required: ['isActive'],
      },
    },
  },
} as const;
