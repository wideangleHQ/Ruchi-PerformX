import { VMS_MOBILE_NUMBER_MAX_LENGTH, VMS_MOBILE_NUMBER_MIN_LENGTH } from '../constants/vms.constants';
import { extractPhoneDigits } from '../utils/phone.util';

export function isValidMobileNumber(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const digits = extractPhoneDigits(value);
  if (digits.length < VMS_MOBILE_NUMBER_MIN_LENGTH || digits.length > VMS_MOBILE_NUMBER_MAX_LENGTH) {
    return false;
  }

  if (digits.length === VMS_MOBILE_NUMBER_MIN_LENGTH) {
    return /^[6-9]\d{9}$/.test(digits);
  }

  return true;
}

export function isOptionalMobileNumber(value: string | null | undefined): boolean {
  return value == null || value === '' || isValidMobileNumber(value);
}

