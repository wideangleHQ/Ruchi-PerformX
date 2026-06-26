import { VMS_PASS_NUMBER_BRANCH_CODE_LENGTH, VMS_PASS_NUMBER_PREFIX, VMS_PASS_NUMBER_REGEX, VMS_PASS_NUMBER_SEQUENCE_LENGTH, VMS_PASS_NUMBER_SEPARATOR } from '../constants/vms.constants';

export function normalizePassNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_]+/g, VMS_PASS_NUMBER_SEPARATOR).replace(/-+/g, VMS_PASS_NUMBER_SEPARATOR);
}

export function createPassNumber(branchCode: string, sequence: number, issuedAt: Date = new Date()): string {
  const normalizedBranchCode = branchCode.trim().toUpperCase().slice(0, VMS_PASS_NUMBER_BRANCH_CODE_LENGTH);
  const datePart = issuedAt.toISOString().slice(0, 10).replace(/-/g, '');
  const sequencePart = String(sequence).padStart(VMS_PASS_NUMBER_SEQUENCE_LENGTH, '0');

  return [
    VMS_PASS_NUMBER_PREFIX,
    normalizedBranchCode,
    datePart,
    sequencePart,
  ].join(VMS_PASS_NUMBER_SEPARATOR);
}

export function isPassNumber(value: string): boolean {
  return VMS_PASS_NUMBER_REGEX.test(normalizePassNumber(value));
}

