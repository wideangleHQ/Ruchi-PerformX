import { isUUID } from 'class-validator';

const uuid = '11111111-1111-1111-1111-111111111111';
console.log('Is valid UUID? (no args)', isUUID(uuid));
console.log('Is valid UUID? (all)', isUUID(uuid, 'all'));
console.log('Is valid UUID? (3)', isUUID(uuid, '3'));
console.log('Is valid UUID? (4)', isUUID(uuid, '4'));
console.log('Is valid UUID? (5)', isUUID(uuid, '5'));

const validV4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
console.log('Valid v4?', isUUID(validV4));
