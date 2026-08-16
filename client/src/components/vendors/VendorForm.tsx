'use client';

import { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CreateVendorPayload, Vendor } from '@/api/vendors';
import { useVendorCategories } from '@/hooks/useVendors';
import { useDepartmentOptions, useUserOptions } from './pickers';

/**
 * Section 1 fields, one for one with the `vendors` columns the create DTO
 * accepts. Nothing else may be added here: the ValidationPipe runs with
 * `forbidNonWhitelisted`, so a stray property is a 400 with an unhelpful body.
 *
 * No contract dates. Contracts are their own entity with their own screen, and
 * a vendor can have several.
 *
 * No status either. A new vendor starts as PROSPECT and moves through its
 * lifecycle on the profile status control, which is the only place that
 * lifecycle is edited.
 */
export const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').max(255),
  owner_id: z.string().min(1, 'An internal owner is required'),
  vendor_type: z.string().max(100).optional(),
  category_id: z.string().optional(),
  description: z.string().optional(),
  contact_person: z.string().max(255).optional(),
  contact_email: z.union([z.literal(''), z.email('Enter a valid email')]).optional(),
  contact_phone: z.string().max(30).optional(),
  alternate_contact: z.string().max(255).optional(),
  company_address: z.string().optional(),
  website: z.string().max(255).optional(),
  start_date: z.string().optional(),
  department_id: z.string().optional(),
  secondary_owner_id: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

export type VendorFormValues = z.infer<typeof vendorSchema>;

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-white px-3 text-sm text-slate-700 outline-none';

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

/** Tags round-trip as a comma separated string, which is what the input holds. */
function toPayload(values: VendorFormValues): CreateVendorPayload {
  const { tags, ...rest } = values;
  return {
    ...rest,
    tags: (tags ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

export function VendorForm({
  vendor,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: {
  vendor?: Vendor;
  submitLabel: string;
  isSubmitting?: boolean;
  error?: string | null;
  onSubmit: (payload: CreateVendorPayload) => void;
  onCancel: () => void;
}) {
  const { data: categories } = useVendorCategories();
  const departments = useDepartmentOptions();
  const users = useUserOptions();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: vendor?.name ?? '',
      owner_id: vendor?.owner_id ?? '',
      vendor_type: vendor?.vendor_type ?? '',
      category_id: vendor?.category_id ?? '',
      description: vendor?.description ?? '',
      contact_person: vendor?.contact_person ?? '',
      contact_email: vendor?.contact_email ?? '',
      contact_phone: vendor?.contact_phone ?? '',
      alternate_contact: vendor?.alternate_contact ?? '',
      company_address: vendor?.company_address ?? '',
      website: vendor?.website ?? '',
      start_date: vendor?.start_date?.slice(0, 10) ?? '',
      department_id: vendor?.department_id ?? '',
      secondary_owner_id: vendor?.secondary_owner_id ?? '',
      notes: vendor?.notes ?? '',
      tags: (vendor?.tags ?? []).join(', '),
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(toPayload(values)))}
      className="space-y-6"
    >
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Vendor</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Vendor name" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Acme Digital" />
          </Field>

          <Field label="Vendor type" error={errors.vendor_type?.message}>
            <Input {...register('vendor_type')} placeholder="Agency, freelancer, supplier" />
          </Field>

          <Field label="Service category" error={errors.category_id?.message}>
            <select {...register('category_id')} className={selectClass}>
              <option value="">Not set</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Relationship start date" error={errors.start_date?.message}>
            <Input type="date" {...register('start_date')} />
          </Field>

          <div className="md:col-span-2">
            <Field label="Description / services provided" error={errors.description?.message}>
              <Textarea rows={3} {...register('description')} />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Contact</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Contact person" error={errors.contact_person?.message}>
            <Input {...register('contact_person')} />
          </Field>

          <Field label="Contact email" error={errors.contact_email?.message}>
            <Input type="email" {...register('contact_email')} />
          </Field>

          <Field label="Contact phone" error={errors.contact_phone?.message}>
            <Input {...register('contact_phone')} />
          </Field>

          <Field label="Alternate contact" error={errors.alternate_contact?.message}>
            <Input {...register('alternate_contact')} />
          </Field>

          <Field label="Website" error={errors.website?.message}>
            <Input {...register('website')} placeholder="https://" />
          </Field>

          <div className="md:col-span-2">
            <Field label="Company address" error={errors.company_address?.message}>
              <Textarea rows={2} {...register('company_address')} />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Accountability</h2>
        <p className="mb-4 text-xs text-slate-500">
          Who RUCHI holds accountable for this relationship. Separate from who can
          open Vendor Management.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Internal owner" error={errors.owner_id?.message}>
            <select {...register('owner_id')} className={selectClass}>
              <option value="">Select an owner</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Secondary owner" error={errors.secondary_owner_id?.message}>
            <select {...register('secondary_owner_id')} className={selectClass}>
              <option value="">Not set</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Internal department" error={errors.department_id?.message}>
            <select {...register('department_id')} className={selectClass}>
              <option value="">Not set</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tags" error={errors.tags?.message}>
            <Input {...register('tags')} placeholder="Comma separated" />
          </Field>

          <div className="md:col-span-2">
            <Field label="Internal notes" error={errors.notes?.message}>
              <Textarea rows={3} {...register('notes')} />
            </Field>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
