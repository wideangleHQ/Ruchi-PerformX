import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeeLeaveProfile } from './EmployeeLeaveProfile';
import { EmployeeProfileHeader } from './EmployeeProfileHeader';
import { EmployeeLeaveSummary, LeaveType } from '@/api/leave';

const mockTypes: LeaveType[] = [
  {
    id: 'type-cl',
    name: 'Casual Leave',
    annual_entitlement: 12,
    is_paid: true,
    carry_forward: false,
    max_carry_forward: 0,
    requires_proof: false,
    is_active: true,
  },
  {
    id: 'type-sl',
    name: 'Sick Leave',
    annual_entitlement: 10,
    is_paid: true,
    carry_forward: true,
    max_carry_forward: 5,
    requires_proof: true,
    is_active: true,
  },
  {
    id: 'type-el',
    name: 'Earned Leave',
    annual_entitlement: 15,
    is_paid: true,
    carry_forward: true,
    max_carry_forward: 30,
    requires_proof: false,
    is_active: true,
  },
];

const mockSummary: EmployeeLeaveSummary = {
  user: {
    id: 'user-1234-uuid',
    full_name: 'Rama Chandra Behera',
    username: 'ramac',
    email: 'rama.chandra@ruchifoodline.com',
    personnel_number: '100057',
    role: 'HOD',
    department_id: 'dept-1',
    departments: { id: 'dept-1', name: 'Information Technology' },
  },
  year: 2026,
  balances: [
    {
      id: 'bal-1',
      user_id: 'user-1234-uuid',
      leave_type_id: 'type-cl',
      year: 2026,
      entitled: 12,
      used: 3,
      carried_over: 0,
      remaining: 9,
      compensated_to_key_date: 0,
      leave_type: {
        id: 'type-cl',
        name: 'Casual Leave',
        is_paid: true,
      },
    },
    {
      id: 'bal-2',
      user_id: 'user-1234-uuid',
      leave_type_id: 'type-sl',
      year: 2026,
      entitled: 10,
      used: 2,
      carried_over: 0,
      remaining: 8,
      compensated_to_key_date: 0,
      leave_type: {
        id: 'type-sl',
        name: 'Sick Leave',
        is_paid: true,
      },
    },
    {
      id: 'bal-3',
      user_id: 'user-1234-uuid',
      leave_type_id: 'type-el',
      year: 2026,
      entitled: 15,
      used: 5,
      carried_over: 2,
      remaining: 12,
      compensated_to_key_date: 0,
      leave_type: {
        id: 'type-el',
        name: 'Earned Leave',
        is_paid: true,
      },
    },
  ],
  adjustments: [
    {
      id: 'adj-1',
      user_id: 'user-1234-uuid',
      leave_type_id: 'type-el',
      year: 2026,
      adjustment_type: 'OPENING_BALANCE',
      amount: 15,
      effective_date: '2026-04-01T00:00:00.000Z',
      remarks: 'FY2026 Opening quota allocation',
      reference: 'INIT-2026',
      created_by_id: 'admin-1',
      created_at: '2026-04-01T10:00:00.000Z',
      created_by_id_user: {
        id: 'admin-1',
        full_name: 'HR Admin',
        email: 'hr@ruchi.com',
        role: 'HR',
        department_id: null,
      },
    },
  ],
  applications: [
    {
      id: 'app-1',
      user_id: 'user-1234-uuid',
      leave_type_id: 'type-cl',
      start_date: '2026-05-10T00:00:00.000Z',
      end_date: '2026-05-12T00:00:00.000Z',
      days_count: 3,
      reason: 'Family function attendance',
      status: 'APPROVED',
      manager_id: 'md-1',
      approved_by_id: 'md-1',
      approved_by_role: 'MD',
      approved_at: '2026-05-08T00:00:00.000Z',
      approval_remark: 'Approved',
      cancelled_by_id: null,
      cancelled_at: null,
      cancellation_reason: null,
      created_at: '2026-05-07T00:00:00.000Z',
      updated_at: '2026-05-08T00:00:00.000Z',
      approved_by_id_user: {
        id: 'md-1',
        full_name: 'Managing Director',
        email: 'md@ruchi.com',
        role: 'MD',
        department_id: null,
      },
    },
    {
      id: 'app-2',
      user_id: 'user-1234-uuid',
      leave_type_id: 'type-sl',
      start_date: '2026-07-01T00:00:00.000Z',
      end_date: '2026-07-02T00:00:00.000Z',
      days_count: 2,
      reason: 'Fever recovery',
      status: 'PENDING',
      manager_id: 'md-1',
      approved_by_id: null,
      approved_by_role: null,
      approved_at: null,
      approval_remark: null,
      cancelled_by_id: null,
      cancelled_at: null,
      cancellation_reason: null,
      created_at: '2026-06-30T00:00:00.000Z',
      updated_at: '2026-06-30T00:00:00.000Z',
    },
  ],
};

describe('EmployeeProfileHeader', () => {
  it('renders employee identity, personnel number, department and role accurately', () => {
    const onYearChange = vi.fn();
    render(
      <EmployeeProfileHeader
        user={mockSummary.user}
        selectedYear={2026}
        onYearChange={onYearChange}
        canChangeEmployee={true}
        onChangeEmployee={vi.fn()}
      />,
    );

    expect(screen.getByText('Rama Chandra Behera')).toBeInTheDocument();
    expect(screen.getByText('100057')).toBeInTheDocument();
    expect(screen.getByText('HOD')).toBeInTheDocument();
    expect(screen.getByText('Information Technology')).toBeInTheDocument();
    expect(screen.getByText('rama.chandra@ruchifoodline.com')).toBeInTheDocument();
    expect(screen.getByText('Switch Employee')).toBeInTheDocument();
  });

  it('triggers year change callback when selecting a different financial year', async () => {
    const onYearChange = vi.fn();
    render(
      <EmployeeProfileHeader
        user={mockSummary.user}
        selectedYear={2026}
        onYearChange={onYearChange}
      />,
    );

    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, '2025');
    expect(onYearChange).toHaveBeenCalledWith(2025);
  });
});

describe('EmployeeLeaveProfile Tabs & Features', () => {
  it('renders overview tab with dynamic balance cards and recent applications', () => {
    render(<EmployeeLeaveProfile summary={mockSummary} types={mockTypes} />);

    // Check Overview is active tab and category names appear
    expect(screen.getAllByText('Casual Leave').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sick Leave').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Earned Leave').length).toBeGreaterThan(0);

    // Check remaining balances
    expect(screen.getByText('9')).toBeInTheDocument(); // CL remaining
    expect(screen.getByText('8')).toBeInTheDocument(); // SL remaining
    expect(screen.getAllByText('12').length).toBeGreaterThan(0); // EL remaining / entitled

    // Total remaining: 9 + 8 + 12 = 29
    expect(screen.getByText('29')).toBeInTheDocument();

    // Recent applications listed
    expect(screen.getByText('Family function attendance')).toBeInTheDocument();
  });

  it('navigates to Leave Applications tab and allows filtering by status', async () => {
    render(<EmployeeLeaveProfile summary={mockSummary} types={mockTypes} />);

    // Click on Leave Applications tab
    const appsTab = screen.getByRole('button', { name: /Leave Applications/i });
    await userEvent.click(appsTab);

    // Verify both applications are shown initially
    expect(screen.getByText('Family function attendance')).toBeInTheDocument();
    expect(screen.getByText('Fever recovery')).toBeInTheDocument();

    // Filter by PENDING status
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0]; // first select is status
    await userEvent.selectOptions(statusSelect, 'PENDING');

    // Only pending application remains
    expect(screen.queryByText('Family function attendance')).not.toBeInTheDocument();
    expect(screen.getByText('Fever recovery')).toBeInTheDocument();
  });

  it('navigates to Leave Balances tab and shows detailed policy information', async () => {
    render(<EmployeeLeaveProfile summary={mockSummary} types={mockTypes} />);

    // Click Leave Balances tab
    const balancesTab = screen.getByRole('button', { name: /Leave Balances/i });
    await userEvent.click(balancesTab);

    expect(screen.getByText(/Leave Balances & Quota Breakdown/i)).toBeInTheDocument();
    expect(screen.getAllByText('Paid Leave').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carry-forward enabled').length).toBeGreaterThan(0);
    expect(screen.getByText('Proof required')).toBeInTheDocument();
  });

  it('navigates to Leave History tab and renders chronological timeline events', async () => {
    render(<EmployeeLeaveProfile summary={mockSummary} types={mockTypes} />);

    // Click Leave History tab
    const historyTab = screen.getByRole('button', { name: /Leave History/i });
    await userEvent.click(historyTab);

    expect(screen.getByText('Chronological Leave History')).toBeInTheDocument();
    expect(screen.getByText(/FY2026 Opening quota allocation/i)).toBeInTheDocument();
    expect(screen.getByText('Leave Application Submitted: Casual Leave')).toBeInTheDocument();
  });
});
