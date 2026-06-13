-- Development Seed Data for University Electronic Voting System
-- Safe to re-run — all inserts use ON CONFLICT DO NOTHING

-- ======================
-- USERS
-- ======================

INSERT INTO users (id, email, full_name, student_id, role, email_verified, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@university.edu',          'System Administrator', NULL,         'super_admin', TRUE, TRUE),
  ('00000000-0000-0000-0000-000000000002', 'election.admin@university.edu', 'Election Manager',     NULL,         'admin',       TRUE, TRUE),
  ('00000000-0000-0000-0000-000000000101', 'alice@university.edu',          'Alice Johnson',        'STU2024001', 'student',     TRUE, TRUE),
  ('00000000-0000-0000-0000-000000000102', 'bob@university.edu',            'Bob Smith',            'STU2024002', 'student',     TRUE, TRUE),
  ('00000000-0000-0000-0000-000000000103', 'carol@university.edu',          'Carol Williams',       'STU2024003', 'student',     TRUE, TRUE),
  ('00000000-0000-0000-0000-000000000104', 'dave@university.edu',           'Dave Martinez',        'STU2024004', 'student',     TRUE, TRUE),
  ('00000000-0000-0000-0000-000000000105', 'eve@university.edu',            'Eve Davis',            'STU2024005', 'student',     TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ======================
-- ELECTIONS
-- ======================

INSERT INTO elections (id, title, description, status, start_time, end_time, created_by, results_visible)
VALUES
  -- Draft — for testing admin create/edit/open flow
  ('10000000-0000-0000-0000-000000000001',
   'Student Council President 2024',
   'Vote for your next Student Council President. The president will represent student interests and lead council initiatives for the academic year.',
   'draft', NULL, NULL,
   '00000000-0000-0000-0000-000000000002', FALSE),

  -- Active — students can vote right now
  ('10000000-0000-0000-0000-000000000002',
   'Best Professor Award 2024',
   'Vote for the professor who made the most positive impact on your academic journey this year.',
   'active', NOW() - INTERVAL '1 hour', NULL,
   '00000000-0000-0000-0000-000000000002', FALSE),

  -- Closed — results are visible
  ('10000000-0000-0000-0000-000000000003',
   'Homecoming King & Queen 2023',
   'Vote for this year''s Homecoming royalty!',
   'closed', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days',
   '00000000-0000-0000-0000-000000000002', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ======================
-- CANDIDATES
-- ======================

INSERT INTO candidates (id, election_id, name, bio, position, display_order, is_active)
VALUES
  -- Student Council President (draft)
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Sarah Chen',
   'Senior majoring in Political Science. Former class representative with 3 years of student government experience.',
   'Presidential Candidate', 1, TRUE),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'Marcus Thompson',
   'Junior studying Business Administration. Founded the Student Entrepreneurship Club and Campus Sustainability Initiative.',
   'Presidential Candidate', 2, TRUE),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   'Emily Rodriguez',
   'Senior in Computer Science. Led the redesign of the student portal and served as Tech Committee Chair.',
   'Presidential Candidate', 3, TRUE),

  -- Best Professor Award (active)
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000002',
   'Dr. Jennifer Walsh',
   'Professor of Mathematics. Known for making complex calculus concepts accessible and engaging.',
   'Mathematics Department', 1, TRUE),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000002',
   'Dr. Michael Park',
   'Professor of Computer Science. Award-winning instructor in Machine Learning and AI.',
   'Computer Science Department', 2, TRUE),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000002',
   'Dr. Amanda Foster',
   'Professor of English Literature. Creates thought-provoking discussions and mentors student writers.',
   'English Department', 3, TRUE),
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000002',
   'Dr. James Liu',
   'Professor of Chemistry. Research advisor who helps students publish and present their work.',
   'Chemistry Department', 4, TRUE),

  -- Homecoming (closed)
  ('20000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000003',
   'Olivia Martinez & Tyler Jackson',
   'Spirit Squad Captains and Student Activities Board members.',
   'Homecoming Royalty', 1, TRUE),
  ('20000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000003',
   'Isabella Wright & Jordan Lee',
   'Varsity Athletes and Academic Excellence Ambassadors.',
   'Homecoming Royalty', 2, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ======================
-- SAMPLE VOTES (closed election only)
-- ======================

INSERT INTO vote_receipts (id, user_id, election_id, receipt_token, voted_at, ip_address)
VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000003',
   'receipt_alice_homecoming_2023',  NOW() - INTERVAL '6 days', '10.0.0.101'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000003',
   'receipt_bob_homecoming_2023',    NOW() - INTERVAL '6 days', '10.0.0.102'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000003',
   'receipt_carol_homecoming_2023',  NOW() - INTERVAL '6 days', '10.0.0.103'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000003',
   'receipt_dave_homecoming_2023',   NOW() - INTERVAL '6 days', '10.0.0.104'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-000000000003',
   'receipt_eve_homecoming_2023',    NOW() - INTERVAL '6 days', '10.0.0.105')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ballots (id, election_id, candidate_id, receipt_token, cast_at)
VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000021',
   'receipt_alice_homecoming_2023',  NOW() - INTERVAL '6 days'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000022',
   'receipt_bob_homecoming_2023',    NOW() - INTERVAL '6 days'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000021',
   'receipt_carol_homecoming_2023',  NOW() - INTERVAL '6 days'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000021',
   'receipt_dave_homecoming_2023',   NOW() - INTERVAL '6 days'),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000022',
   'receipt_eve_homecoming_2023',    NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

-- ======================
-- AUDIT LOG SAMPLES
-- ======================

-- Explicit ids + ON CONFLICT so the seed stays idempotent ("safe to re-run").
-- Without fixed ids these rows would be appended on every `npm run seed`.
INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, metadata, ip_address)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'election_created', 'election', '10000000-0000-0000-0000-000000000001',
   '{"title": "Student Council President 2024"}', '10.0.0.50'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'election_created', 'election', '10000000-0000-0000-0000-000000000002',
   '{"title": "Best Professor Award 2024"}', '10.0.0.50'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'election_opened',  'election', '10000000-0000-0000-0000-000000000002',
   '{"title": "Best Professor Award 2024"}', '10.0.0.50'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000101', 'login',            NULL,       NULL,
   '{"method": "otp"}', '10.0.0.101'),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000101', 'vote_submitted',   'election', '10000000-0000-0000-0000-000000000003',
   '{"election": "Homecoming King & Queen 2023"}', '10.0.0.101')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Seed data loaded:';
  RAISE NOTICE '   Users  : 2 admins + 5 students';
  RAISE NOTICE '   Elections: draft / active / closed';
  RAISE NOTICE '   Votes  : 5 votes in closed election (3-2 split)';
  RAISE NOTICE '';
  RAISE NOTICE '📧 Test accounts (OTP login):';
  RAISE NOTICE '   super_admin : admin@university.edu';
  RAISE NOTICE '   admin       : election.admin@university.edu';
  RAISE NOTICE '   student     : alice@university.edu  (not voted in active election)';
  RAISE NOTICE '   student     : bob@university.edu    (not voted in active election)';
END $$;
