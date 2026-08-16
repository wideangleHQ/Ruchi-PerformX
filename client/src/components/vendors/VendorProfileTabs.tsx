'use client';

import { ReactNode, useState } from 'react';
import { Lock, MessagesSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  VendorAssignment,
  VendorContract,
  VendorDeliverable,
  VendorDocument,
  VendorNote,
  VendorReview,
} from '@/api/vendors';
import {
  useAddVendorNote,
  useVendorAssignments,
  useVendorContracts,
  useVendorDeliverables,
  useVendorDocuments,
  useVendorNotes,
  useVendorReviews,
} from '@/hooks/useVendors';
import {
  DeliverableStatusChip,
  DocumentStatusChip,
  GenericChip,
  RatingStars,
  formatDate,
  label,
} from './VendorChips';

const TABS = [
  'assignments',
  'projects',
  'deliverables',
  'documents',
  'contracts',
  'activity',
  'reviews',
] as const;

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
      {children}
    </div>
  );
}

function Table({ heads, children }: { heads: string[]; children: ReactNode }) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead className="bg-slate-50">
        <tr>
          {heads.map((head) => (
            <th
              key={head}
              className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  );
}

function AssignmentRows({ assignments }: { assignments: VendorAssignment[] }) {
  return (
    <>
      {assignments.map((assignment) => (
        <tr key={assignment.id} className="hover:bg-slate-50/60">
          <td className="px-5 py-4 font-medium text-slate-900">
            {assignment.entity_title ?? label(assignment.entity_type)}
            {assignment.description ? (
              <p className="text-xs font-normal text-slate-500">{assignment.description}</p>
            ) : null}
          </td>
          <td className="px-5 py-4 text-slate-600">{label(assignment.entity_type)}</td>
          <td className="px-5 py-4 text-slate-600">
            {assignment.assigned_by_id_user?.full_name ?? '-'}
          </td>
          <td className="whitespace-nowrap px-5 py-4 text-slate-600">
            {formatDate(assignment.deadline)}
          </td>
          <td className="px-5 py-4">
            {assignment.progress === null || assignment.progress === undefined ? (
              <span className="text-slate-400">-</span>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-green-600"
                    style={{ width: `${Math.min(100, Math.max(0, assignment.progress))}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{assignment.progress}%</span>
              </div>
            )}
          </td>
          <td className="px-5 py-4">
            <GenericChip value={assignment.status} />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Internal notes and vendor communication are two threads, rendered as two
 * sections rather than one list with a filter. A toggle is one misclick away
 * from putting an internal note in front of the vendor.
 */
function NoteThread({
  title, description, tone, notes, onPost, isPosting,
}: {
  title: string;
  description: string;
  tone: 'internal' | 'shared';
  notes: VendorNote[];
  onPost: (content: string) => void;
  isPosting: boolean;
}) {
  const [draft, setDraft] = useState('');
  const internal = tone === 'internal';

  return (
    <section
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        internal ? 'border-slate-200' : 'border-green-200'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className={internal ? 'text-slate-500' : 'text-green-600'}>
          {internal ? <Lock size={16} /> : <MessagesSquare size={16} />}
        </span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <p className="mb-4 text-xs text-slate-500">{description}</p>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing here yet.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-xl bg-slate-50 p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                  {note.author_id_user?.full_name ?? 'Unknown'}
                </span>
                <span>{formatDate(note.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{note.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 space-y-2">
        <Textarea
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={internal ? 'Note for RUCHI only' : 'Message the vendor can see'}
        />
        <Button
          type="button"
          disabled={!draft.trim() || isPosting}
          onClick={() => {
            onPost(draft.trim());
            setDraft('');
          }}
          className={`gap-2 ${internal ? '' : 'bg-green-600 hover:bg-green-700'}`}
          variant={internal ? 'outline' : 'default'}
        >
          <Send size={14} />
          {internal ? 'Add internal note' : 'Post to vendor thread'}
        </Button>
      </div>
    </section>
  );
}

export function VendorProfileTabs({ vendorId }: { vendorId: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('assignments');

  const { data: assignments = [] } = useVendorAssignments(vendorId);
  const { data: deliverables = [] } = useVendorDeliverables(vendorId);
  const { data: documents = [] } = useVendorDocuments(vendorId);
  const { data: contracts = [] } = useVendorContracts(vendorId);
  const { data: notes = [] } = useVendorNotes(vendorId);
  const { data: reviews = [] } = useVendorReviews(vendorId);
  const addNote = useAddVendorNote(vendorId);

  // A project assignment is a vendor_assignments row with entity_type project,
  // not a separate table. Same list, split for the tab the spec asks for.
  const projectAssignments = assignments.filter(
    (assignment) => assignment.entity_type.toLowerCase() === 'project',
  );
  const otherAssignments = assignments.filter(
    (assignment) => assignment.entity_type.toLowerCase() !== 'project',
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as (typeof TABS)[number])}
      className="w-full"
    >
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((name) => (
          <TabsTrigger key={name} value={name} className="capitalize">
            {name}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="assignments">
        {otherAssignments.length === 0 ? (
          <Empty>No assignments recorded for this vendor.</Empty>
        ) : (
          <Panel>
            <Table heads={['Work', 'Type', 'Assigned By', 'Deadline', 'Progress', 'Status']}>
              <AssignmentRows assignments={otherAssignments} />
            </Table>
          </Panel>
        )}
      </TabsContent>

      <TabsContent value="projects">
        {projectAssignments.length === 0 ? (
          <Empty>This vendor is not on any project.</Empty>
        ) : (
          <Panel>
            <Table heads={['Project', 'Type', 'Assigned By', 'Deadline', 'Progress', 'Status']}>
              <AssignmentRows assignments={projectAssignments} />
            </Table>
          </Panel>
        )}
      </TabsContent>

      <TabsContent value="deliverables">
        {deliverables.length === 0 ? (
          <Empty>No deliverables recorded.</Empty>
        ) : (
          <Panel>
            <Table heads={['Deliverable', 'Owner', 'Due', 'Submitted', 'Status']}>
              {deliverables.map((deliverable: VendorDeliverable) => (
                <tr key={deliverable.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {deliverable.name}
                    {deliverable.remarks ? (
                      <p className="text-xs font-normal text-slate-500">{deliverable.remarks}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {deliverable.owner_id_user?.full_name ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDate(deliverable.due_date)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDate(deliverable.submitted_date)}
                  </td>
                  <td className="px-5 py-4">
                    <DeliverableStatusChip status={deliverable.status} />
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
        )}
      </TabsContent>

      <TabsContent value="documents">
        {documents.length === 0 ? (
          <Empty>No documents uploaded.</Empty>
        ) : (
          <Panel>
            <Table heads={['Document', 'Category', 'Type', 'Issued', 'Expires', 'Status', '']}>
              {documents.map((document: VendorDocument) => (
                <tr key={document.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {document.document_name}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{label(document.category)}</td>
                  <td className="px-5 py-4 text-slate-600">{label(document.document_type)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDate(document.issue_date)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDate(document.expiry_date)}
                  </td>
                  <td className="px-5 py-4">
                    <DocumentStatusChip status={document.status} />
                  </td>
                  <td className="px-5 py-4">
                    <a
                      href={document.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-green-700 hover:underline"
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
        )}
      </TabsContent>

      <TabsContent value="contracts">
        {contracts.length === 0 ? (
          <Empty>No contracts recorded.</Empty>
        ) : (
          <Panel>
            <Table heads={['Contract', 'Type', 'Start', 'End', 'Renewal', 'Status']}>
              {contracts.map((contract: VendorContract) => (
                <tr key={contract.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {contract.contract_number}
                    {contract.description ? (
                      <p className="text-xs font-normal text-slate-500">{contract.description}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{label(contract.contract_type)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDate(contract.start_date)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDate(contract.end_date)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDate(contract.renewal_date)}
                  </td>
                  <td className="px-5 py-4">
                    <GenericChip value={contract.status} />
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
        )}
      </TabsContent>

      <TabsContent value="activity">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <NoteThread
            title="Internal notes"
            description="RUCHI employees only. Never reachable from the vendor portal."
            tone="internal"
            notes={notes.filter((note) => note.is_internal)}
            isPosting={addNote.isPending}
            onPost={(content) => addNote.mutate({ content, is_internal: true })}
          />
          <NoteThread
            title="Vendor communication"
            description="Shared with the vendor. Assume they read every word."
            tone="shared"
            notes={notes.filter((note) => !note.is_internal)}
            isPosting={addNote.isPending}
            onPost={(content) => addNote.mutate({ content, is_internal: false })}
          />
        </div>
      </TabsContent>

      <TabsContent value="reviews">
        {reviews.length === 0 ? (
          <Empty>No reviews recorded.</Empty>
        ) : (
          <div className="space-y-3">
            {reviews.map((review: VendorReview) => (
              <article
                key={review.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {review.reviewer_id_user?.full_name ?? 'Unknown reviewer'}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(review.review_date)}</p>
                  </div>
                  <RatingStars rating={review.rating} />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {(
                    [
                      ['Quality', review.quality],
                      ['Timeliness', review.timeliness],
                      ['Communication', review.communication],
                      ['Reliability', review.reliability],
                    ] as const
                  ).map(([name, value]) => (
                    <div key={name}>
                      <dt className="text-xs text-slate-500">{name}</dt>
                      <dd className="font-semibold text-slate-800">
                        {value === null || value === undefined ? '-' : `${value} / 5`}
                      </dd>
                    </div>
                  ))}
                </dl>

                {review.remarks ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
                    {review.remarks}
                  </p>
                ) : null}
                {review.action_required ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Action required: {review.action_required}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
