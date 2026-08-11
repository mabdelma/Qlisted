import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { logger } from '../lib/logger.js';

export interface CreateReservationInput {
  tableId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  partySize: number;
  date: string;
  time: string;
  duration?: number;
  notes?: string;
  specialRequests?: string;
  source?: 'web' | 'phone' | 'walk_in' | 'staff';
}

export async function createReservation(tenantId: string, input: CreateReservationInput) {
  const id = uuid();
  const [existingTenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);
  if (!existingTenant) {
    return { error: 'Tenant not found', status: 404 as const };
  }

  if (input.tableId) {
    const [table] = await db
      .select()
      .from(schema.tables)
      .where(and(eq(schema.tables.id, input.tableId), eq(schema.tables.tenantId, tenantId)))
      .limit(1);
    if (!table) {
      return { error: 'Table not found', status: 404 as const };
    }
  }

  await db.insert(schema.reservations).values({
    id,
    tenantId,
    tableId: input.tableId || null,
    customerName: input.customerName,
    customerEmail: input.customerEmail || null,
    customerPhone: input.customerPhone || null,
    partySize: input.partySize,
    date: input.date,
    time: input.time,
    duration: input.duration || 90,
    notes: input.notes || null,
    specialRequests: input.specialRequests || null,
    source: input.source || 'web',
  });

  logger.info({ tenantId, reservationId: id, date: input.date, time: input.time }, 'Reservation created');
  return { data: { id }, status: 201 as const };
}

export async function getReservations(tenantId: string, date?: string, status?: string) {
  const conditions = [eq(schema.reservations.tenantId, tenantId)];
  if (date) conditions.push(eq(schema.reservations.date, date));
  if (status) conditions.push(eq(schema.reservations.status, status as typeof schema.reservations.$inferSelect.status));

  const data = await db
    .select()
    .from(schema.reservations)
    .where(and(...conditions))
    .orderBy(schema.reservations.date, schema.reservations.time);
  return { data, status: 200 as const };
}

export async function getReservationDetail(tenantId: string, reservationId: string) {
  const [reservation] = await db
    .select()
    .from(schema.reservations)
    .where(and(eq(schema.reservations.id, reservationId), eq(schema.reservations.tenantId, tenantId)))
    .limit(1);
  if (!reservation) {
    return { error: 'Reservation not found', status: 404 as const };
  }
  return { data: reservation, status: 200 as const };
}

export async function updateReservationStatus(tenantId: string, reservationId: string, status: string) {
  const [existing] = await db
    .select()
    .from(schema.reservations)
    .where(and(eq(schema.reservations.id, reservationId), eq(schema.reservations.tenantId, tenantId)))
    .limit(1);
  if (!existing) {
    return { error: 'Reservation not found', status: 404 as const };
  }

  const validStatuses = ['pending', 'confirmed', 'seated', 'cancelled', 'no_show'] as const;
  if (!validStatuses.includes(status as typeof validStatuses[number])) {
    return { error: 'Invalid status', status: 400 as const };
  }

  await db.update(schema.reservations)
    .set({ status: status as typeof existing.status, updatedAt: new Date().toISOString() })
    .where(eq(schema.reservations.id, reservationId));

  logger.info({ tenantId, reservationId, status }, 'Reservation status updated');
  return { data: { success: true }, status: 200 as const };
}

export async function assignTable(tenantId: string, reservationId: string, tableId: string) {
  const [reservation] = await db
    .select()
    .from(schema.reservations)
    .where(and(eq(schema.reservations.id, reservationId), eq(schema.reservations.tenantId, tenantId)))
    .limit(1);
  if (!reservation) {
    return { error: 'Reservation not found', status: 404 as const };
  }

  const [table] = await db
    .select()
    .from(schema.tables)
    .where(and(eq(schema.tables.id, tableId), eq(schema.tables.tenantId, tenantId)))
    .limit(1);
  if (!table) {
    return { error: 'Table not found', status: 404 as const };
  }

  await db.update(schema.reservations)
    .set({ tableId, status: 'confirmed', updatedAt: new Date().toISOString() })
    .where(eq(schema.reservations.id, reservationId));

  logger.info({ tenantId, reservationId, tableId }, 'Table assigned to reservation');
  return { data: { success: true, tableNumber: table.number }, status: 200 as const };
}

export async function updateReservation(tenantId: string, reservationId: string, input: Partial<CreateReservationInput>) {
  const [existing] = await db
    .select()
    .from(schema.reservations)
    .where(and(eq(schema.reservations.id, reservationId), eq(schema.reservations.tenantId, tenantId)))
    .limit(1);
  if (!existing) {
    return { error: 'Reservation not found', status: 404 as const };
  }

  const allowed = ['tableId', 'customerName', 'customerEmail', 'customerPhone', 'partySize', 'date', 'time', 'duration', 'notes', 'specialRequests'];
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const key of allowed) {
    if (input[key as keyof CreateReservationInput] !== undefined) {
      updates[key] = input[key as keyof CreateReservationInput];
    }
  }

  await db.update(schema.reservations)
    .set(updates)
    .where(eq(schema.reservations.id, reservationId));

  return { data: { success: true }, status: 200 as const };
}

export async function deleteReservation(tenantId: string, reservationId: string) {
  const [existing] = await db
    .select()
    .from(schema.reservations)
    .where(and(eq(schema.reservations.id, reservationId), eq(schema.reservations.tenantId, tenantId)))
    .limit(1);
  if (!existing) {
    return { error: 'Reservation not found', status: 404 as const };
  }

  await db.delete(schema.reservations)
    .where(and(eq(schema.reservations.id, reservationId), eq(schema.reservations.tenantId, tenantId)));

  logger.info({ tenantId, reservationId }, 'Reservation deleted');
  return { data: { success: true }, status: 200 as const };
}
