-- Migration: Add can_access_career_hr to users table
-- This field controls CareerX HR module access without affecting PerformX authorization

ALTER TABLE users
ADD COLUMN can_access_career_hr BOOLEAN NOT NULL DEFAULT FALSE;

-- Enable for specific users (replace with actual emails):
-- UPDATE users SET can_access_career_hr = TRUE WHERE email = 'user1@company.com';
-- UPDATE users SET can_access_career_hr = TRUE WHERE email = 'user2@company.com';
