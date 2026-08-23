'use client';

import { VendorWorkDialog, WorkField } from './VendorWorkDialog';
import { useUserOptions } from './pickers';
import {
  assignmentSchema, clean, contractSchema, deliverableSchema, documentSchema, reviewSchema,
} from '@/lib/vendorValidation';
import {
  useCreateAssignment, useCreateContract, useCreateDeliverable, useCreateDocument,
  useCreateReview,
} from '@/hooks/useVendors';

/**
 * The five vendor work forms. Each supplies a field spec to VendorWorkDialog
 * and adds `vendor_id` on submit, which is the only thing they all share and
 * the one field never shown, because the form is always opened from a vendor.
 */

interface FormProps {
  vendorId: string;
  onClose: () => void;
}

const option = (value: string) => ({ value, label: value });
const today = () => new Date().toISOString().slice(0, 10);

export function AssignmentForm({ vendorId, onClose }: FormProps) {
  const create = useCreateAssignment();
  const fields: WorkField[] = [
    {
      kind: 'select', name: 'entity_type', label: 'What is being assigned',
      options: [
        { value: 'service', label: 'Service, ongoing' },
        { value: 'project', label: 'Project' },
        { value: 'task', label: 'Task' },
        { value: 'deliverable', label: 'Deliverable' },
      ],
      hint: 'A service assignment covers ongoing work with no single item behind it',
    },
    {
      kind: 'text', name: 'entity_id', label: 'Item ID',
      hint: 'The UUID of the project, task or deliverable. Leave empty for a service',
    },
    { kind: 'date', name: 'start_date', label: 'Starts' },
    { kind: 'date', name: 'deadline', label: 'Due' },
    {
      kind: 'select', name: 'status', label: 'Status',
      options: ['ACTIVE', 'COMPLETED', 'CANCELLED'].map(option),
    },
    {
      kind: 'select', name: 'priority', label: 'Priority',
      options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(option),
    },
    { kind: 'textarea', name: 'description', label: 'What the vendor is doing', wide: true },
  ];

  return (
    <VendorWorkDialog
      title="Assign work to this vendor"
      note="Creating this grants the vendor's portal login sight of the item named, and sends them a notification. It is an access change as much as a record."
      fields={fields}
      initial={{ entity_type: 'service', status: 'ACTIVE', priority: 'MEDIUM' }}
      schema={assignmentSchema}
      submitLabel="Assign"
      busy={create.isPending}
      onClose={onClose}
      onSubmit={async (values) => {
        await create.mutateAsync(clean({ ...values, vendor_id: vendorId }) as never);
      }}
    />
  );
}

export function ContractForm({ vendorId, onClose }: FormProps) {
  const create = useCreateContract();
  const fields: WorkField[] = [
    { kind: 'text', name: 'contract_number', label: 'Contract number' },
    { kind: 'text', name: 'contract_type', label: 'Type', placeholder: 'Retainer, SOW, MSA' },
    { kind: 'date', name: 'start_date', label: 'Starts' },
    { kind: 'date', name: 'end_date', label: 'Ends' },
    {
      kind: 'date', name: 'renewal_date', label: 'Renewal date',
      hint: 'Drives the renewal reminder on the deadlines screen',
    },
    {
      kind: 'select', name: 'status', label: 'Status',
      options: ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'].map(option),
    },
    { kind: 'textarea', name: 'description', label: 'Scope', wide: true },
  ];

  return (
    <VendorWorkDialog
      title="New contract"
      fields={fields}
      initial={{ status: 'DRAFT', start_date: today() }}
      schema={contractSchema}
      submitLabel="Create contract"
      busy={create.isPending}
      onClose={onClose}
      onSubmit={async (values) => {
        await create.mutateAsync(clean({ ...values, vendor_id: vendorId }) as never);
      }}
    />
  );
}

export function DocumentForm({ vendorId, onClose }: FormProps) {
  const create = useCreateDocument();
  const fields: WorkField[] = [
    {
      kind: 'select', name: 'category', label: 'Category',
      options: [
        { value: 'LEGAL', label: 'Legal' },
        { value: 'OPERATIONAL', label: 'Operational' },
      ],
    },
    { kind: 'text', name: 'document_type', label: 'Type', placeholder: 'GST certificate, NDA' },
    { kind: 'text', name: 'document_name', label: 'Name', wide: true },
    { kind: 'date', name: 'issue_date', label: 'Issued' },
    {
      kind: 'date', name: 'expiry_date', label: 'Expires',
      hint: 'Expiring documents surface on the deadlines screen',
    },
    {
      kind: 'url', name: 'file_url', label: 'Link to the file', wide: true,
      placeholder: 'https://...',
    },
    {
      kind: 'text', name: 'storage_path', label: 'Storage path', wide: true,
      placeholder: 'vendors/documents/...',
      hint: 'Where the file lives in the bucket',
    },
  ];

  return (
    <VendorWorkDialog
      title="Record a document"
      note="This records a file that is already stored somewhere and links to it. It does not upload: the endpoint takes a URL rather than multipart, so put the file in the bucket first and paste its link here."
      fields={fields}
      initial={{ category: 'OPERATIONAL' }}
      schema={documentSchema}
      submitLabel="Record document"
      busy={create.isPending}
      onClose={onClose}
      onSubmit={async (values) => {
        await create.mutateAsync(clean({ ...values, vendor_id: vendorId }) as never);
      }}
    />
  );
}

export function DeliverableForm({ vendorId, onClose }: FormProps) {
  const create = useCreateDeliverable();
  const users = useUserOptions();
  const fields: WorkField[] = [
    { kind: 'text', name: 'name', label: 'Deliverable', wide: true },
    {
      kind: 'select', name: 'owner_id', label: 'Owner',
      options: users.map((user) => ({ value: user.id, label: user.fullName })),
      hint: 'The employee accountable for it internally',
    },
    { kind: 'date', name: 'due_date', label: 'Due' },
    {
      kind: 'select', name: 'status', label: 'Status',
      options: ['PENDING', 'IN_PROGRESS', 'DELIVERED', 'ACCEPTED', 'REJECTED'].map(option),
    },
    { kind: 'text', name: 'project_id', label: 'Project ID', hint: 'Optional' },
    { kind: 'textarea', name: 'description', label: 'Description', wide: true },
    { kind: 'textarea', name: 'remarks', label: 'Remarks', wide: true },
  ];

  return (
    <VendorWorkDialog
      title="New deliverable"
      fields={fields}
      initial={{ status: 'PENDING' }}
      schema={deliverableSchema}
      submitLabel="Create deliverable"
      busy={create.isPending}
      onClose={onClose}
      onSubmit={async (values) => {
        await create.mutateAsync(clean({ ...values, vendor_id: vendorId }) as never);
      }}
    />
  );
}

export function ReviewForm({ vendorId, onClose }: FormProps) {
  const create = useCreateReview();
  const score = (name: string, label: string): WorkField => ({
    kind: 'number', name, label, min: 1, max: 5,
  });
  const fields: WorkField[] = [
    { kind: 'date', name: 'review_date', label: 'Review date' },
    { ...score('rating', 'Overall, 1 to 5'), hint: 'The only score that is required' },
    score('quality', 'Quality'),
    score('timeliness', 'Timeliness'),
    score('communication', 'Communication'),
    score('reliability', 'Reliability'),
    { kind: 'textarea', name: 'remarks', label: 'Remarks', wide: true },
    {
      kind: 'textarea', name: 'action_required', label: 'Action required', wide: true,
      hint: 'What has to change before the next review',
    },
  ];

  return (
    <VendorWorkDialog
      title="Record a review"
      note="Reviews feed the performance summary, which is what the renewal decision reads."
      fields={fields}
      initial={{ review_date: today(), rating: 3 }}
      schema={reviewSchema}
      submitLabel="Save review"
      busy={create.isPending}
      onClose={onClose}
      onSubmit={async (values) => {
        await create.mutateAsync(clean({ ...values, vendor_id: vendorId }) as never);
      }}
    />
  );
}
