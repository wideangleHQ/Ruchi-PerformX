import { z } from 'zod';

/**
 * Mirrors the five `CreateVendorWork*` DTOs. `forbidNonWhitelisted` is on, so a
 * field here without the matching DTO field is a 400 listing field names.
 *
 * Several rules below are stricter than the server on purpose. Each one is a
 * case the API accepts and the data then reads as wrong: a contract that ends
 * before it starts, a renewal after the end, a document that expired before it
 * was issued. Refusing them at the form is cheaper than explaining the row
 * later.
 */

const iso = (label: string) => z.string().min(1, `${label} is required`);
const optionalIso = z.string().optional().or(z.literal(''));
const trimmed = (label: string, max = 255) =>
  z.string().trim().min(1, `${label} is required`).max(max);

export const assignmentSchema = z
  .object({
    entity_type: z.enum(['task', 'project', 'deliverable', 'service']),
    entity_id: z.string().uuid('Pick the item this is for').optional().or(z.literal('')),
    start_date: optionalIso,
    deadline: optionalIso,
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
    description: z.string().max(2000).optional(),
    priority: z.string().optional(),
  })
  .refine((d) => d.entity_type === 'service' || Boolean(d.entity_id), {
    message: 'Everything except a service assignment needs the item it points at',
    path: ['entity_id'],
  })
  .refine((d) => !d.start_date || !d.deadline || d.deadline >= d.start_date, {
    message: 'The deadline cannot be before the start date',
    path: ['deadline'],
  });

export const contractSchema = z
  .object({
    contract_number: trimmed('Contract number', 100),
    contract_type: z.string().max(100).optional(),
    start_date: iso('Start date'),
    end_date: optionalIso,
    renewal_date: optionalIso,
    status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
    description: z.string().max(2000).optional(),
  })
  .refine((d) => !d.end_date || d.end_date >= d.start_date, {
    message: 'The contract cannot end before it starts',
    path: ['end_date'],
  })
  .refine((d) => !d.renewal_date || !d.end_date || d.renewal_date <= d.end_date, {
    message: 'Renewal falls after the contract has already ended',
    path: ['renewal_date'],
  });

export const documentSchema = z
  .object({
    category: z.enum(['LEGAL', 'OPERATIONAL']),
    document_type: trimmed('Document type', 100),
    document_name: trimmed('Document name'),
    contract_id: z.string().uuid().optional().or(z.literal('')),
    issue_date: optionalIso,
    expiry_date: optionalIso,
    file_url: z.string().url('Paste the full link to the stored file'),
    storage_path: trimmed('Storage path', 500),
  })
  .refine((d) => !d.issue_date || !d.expiry_date || d.expiry_date >= d.issue_date, {
    message: 'The document expires before it was issued',
    path: ['expiry_date'],
  });

export const deliverableSchema = z.object({
  name: trimmed('Name'),
  description: z.string().max(2000).optional(),
  owner_id: z.string().uuid('Pick an owner'),
  project_id: z.string().uuid().optional().or(z.literal('')),
  due_date: optionalIso,
  status: z.string().optional(),
  remarks: z.string().max(2000).optional(),
});

/**
 * `rating` is the overall score and the only one the server requires. The four
 * sub-scores are optional, but a review with sub-scores and no overall is
 * meaningless, so the form asks for the overall first.
 */
export const reviewSchema = z.object({
  review_date: iso('Review date'),
  rating: z.coerce.number().int().min(1, 'Rate 1 to 5').max(5),
  quality: z.coerce.number().int().min(1).max(5).optional(),
  timeliness: z.coerce.number().int().min(1).max(5).optional(),
  communication: z.coerce.number().int().min(1).max(5).optional(),
  reliability: z.coerce.number().int().min(1).max(5).optional(),
  remarks: z.string().max(2000).optional(),
  action_required: z.string().max(2000).optional(),
});

export type AssignmentFormData = z.infer<typeof assignmentSchema>;
export type ContractFormData = z.infer<typeof contractSchema>;
export type DocumentFormData = z.infer<typeof documentSchema>;
export type DeliverableFormData = z.infer<typeof deliverableSchema>;
export type ReviewFormData = z.infer<typeof reviewSchema>;

/** Strips '' back to undefined, since the DTOs take absent rather than empty. */
export const clean = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== '' && v !== undefined),
  ) as T;
