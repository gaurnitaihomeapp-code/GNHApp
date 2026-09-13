-- ==============================================================================
-- GNH PRASADAM & EXPENSE MANAGEMENT APP - SUPABASE POSTGRESQL SCHEMA & SEED DATA
-- ==============================================================================

-- 1. Devotees and Family Mapping
CREATE TABLE IF NOT EXISTS devotees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    family_members JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. [{"name": "Ram Das", "phone_number": "9876543201"}, {"name": "Sita Devi", "phone_number": "9876543299"}, {"name": "Laxman Das"}]
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Daily Prasadam Counts
CREATE TABLE IF NOT EXISTS prasadam_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    devotee_id UUID REFERENCES devotees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    breakfast_count INT DEFAULT 0 CHECK (breakfast_count >= 0),
    lunch_count INT DEFAULT 0 CHECK (lunch_count >= 0),
    dinner_count INT DEFAULT 0 CHECK (dinner_count >= 0),
    is_auto_filled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(devotee_id, date)
);

-- 3. Expenses (Regular, Janmashtami & Prabhupada Appearance Day)
DO $$ BEGIN
    CREATE TYPE expense_type AS ENUM ('REGULAR', 'JANMASHTAMI', 'PRABHUPADA_APPEARANCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- In case expense_type enum was already created earlier in Supabase, add PRABHUPADA_APPEARANCE:
ALTER TYPE expense_type ADD VALUE IF NOT EXISTS 'PRABHUPADA_APPEARANCE';

DO $$ BEGIN
    CREATE TYPE expense_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- In case expense_status enum was already created earlier in Supabase, add PENDING:
ALTER TYPE expense_status ADD VALUE IF NOT EXISTS 'PENDING';

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    devotee_id UUID REFERENCES devotees(id) ON DELETE SET NULL,
    guest_name VARCHAR(100),
    date DATE DEFAULT CURRENT_DATE, -- Expense Date (e.g. 'YYYY-MM-DD')
    type expense_type NOT NULL DEFAULT 'REGULAR',
    payer_name VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL, -- Supports negative values
    comments TEXT,
    bill_url TEXT,
    status expense_status DEFAULT 'PENDING',
    rejection_reason TEXT,
    cycle_month VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Monthly Ledgers & Carry-Over Balances
DO $$ BEGIN
    CREATE TYPE settlement_state AS ENUM ('UNSETTLED', 'PENDING_VERIFICATION', 'SETTLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS monthly_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    devotee_id UUID REFERENCES devotees(id) ON DELETE CASCADE,
    cycle_month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
    carried_forward_amount NUMERIC(10, 2) DEFAULT 0.00,
    settlement_amount_reported NUMERIC(10, 2) DEFAULT 0.00,
    settlement_date_reported DATE,
    settlement_status settlement_state DEFAULT 'UNSETTLED',
    admin_notes TEXT,
    UNIQUE(devotee_id, cycle_month)
);

-- 5. System Configuration
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Seed 6-Digit Admin PIN hash (192108) and default settings
INSERT INTO system_config (key, value) VALUES 
    ('admin_pin_hash', '192108'),
    ('breakfast_rate', '40'),
    ('lunch_rate', '80'),
    ('dinner_rate', '40'),
    ('community_cost_per_member', '500'),
    ('cutoff_time', '20:00')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Enable Row Level Security (RLS) & Public Policies for App operations
ALTER TABLE devotees ENABLE ROW LEVEL SECURITY;
ALTER TABLE prasadam_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for devotees" ON devotees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for prasadam_counts" ON prasadam_counts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for monthly_ledgers" ON monthly_ledgers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for system_config" ON system_config FOR ALL USING (true) WITH CHECK (true);

-- 6. Seed Dataset: Registered Vaishnava Devotees & Family Members
INSERT INTO devotees (id, phone_number, group_name, family_members, is_admin) VALUES
('d1000000-0000-0000-0000-000000000001', '8277487290', 'Gopalkrishna Prabhuji', '[{"name": "Gopalkrishna Prabhuji", "phone_number": "8277487290"}]'::jsonb, TRUE),
('d1000000-0000-0000-0000-000000000002', '9923369579', 'Giridhar Prabhuji', '[{"name": "Giridhar Prabhuji", "phone_number": "9923369579"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000003', '9912206523', 'BrahmaLeela Mataji', '[{"name": "BrahmaLeela Mataji", "phone_number": "9912206523"}, {"name": "Saloni Mataji", "phone_number": "8429289590"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000004', '8977333687', 'Shiv Sagar Prabhuji', '[{"name": "Shiv Sagar Prabhuji", "phone_number": "8977333687"}, {"name": "Anusha S Mataji", "phone_number": "7661942489"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000005', '9840286639', 'Lokesh Prabhuji', '[{"name": "Lokesh Prabhuji", "phone_number": "9840286639"}, {"name": "Kavya Mataji", "phone_number": "7661098899"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000006', '7893894239', 'Krishna Kishore Prabhuji', '[{"name": "Krishna Kishore Prabhuji", "phone_number": "7893894239"}, {"name": "Sripadh Prabhuji", "phone_number": "9500180593"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000007', '9704090561', 'Maheedhar Prabhuji', '[{"name": "Maheedhar Prabhuji", "phone_number": "9704090561"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000008', '9677163570', 'Varun Prabhuji', '[{"name": "Varun Prabhuji", "phone_number": "9677163570"}, {"name": "Manisha Mataji", "phone_number": "9908591999"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000009', '9381002799', 'Sai Dheeraj Prabhuji', '[{"name": "Sai Dheeraj Prabhuji", "phone_number": "9381002799"}, {"name": "Mukesh Prabhuji", "phone_number": "9391953459"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000010', '8682845231', 'Sreenivas Prabhuji', '[{"name": "Sreenivas Prabhuji", "phone_number": "8682845231"}, {"name": "Vishnu Priyanka Mataji", "phone_number": "9640596992"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000011', '9884179297', 'Teja Prabhuji', '[{"name": "Teja Prabhuji", "phone_number": "9884179297"}, {"name": "Surakshita Mataji", "phone_number": "7675098809"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000012', '7013671868', 'Ruthvik Prabhuji', '[{"name": "Ruthvik Prabhuji", "phone_number": "7013671868"}, {"name": "Nehal Mataji", "phone_number": "7057990056"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000013', '8056019447', 'Teja Siva Prabhuji', '[{"name": "Teja Siva Prabhuji", "phone_number": "8056019447"}, {"name": "Anusha K Mataji", "phone_number": "9182673212"}]'::jsonb, FALSE),
('d1000000-0000-0000-0000-000000000014', '9493239649', 'HG Sitanath Prabhuji', '[{"name": "HG Sitanath Prabhuji", "phone_number": "9493239649"}]'::jsonb, FALSE)
ON CONFLICT (id) DO UPDATE SET 
    phone_number = EXCLUDED.phone_number,
    group_name = EXCLUDED.group_name,
    family_members = EXCLUDED.family_members,
    is_admin = EXCLUDED.is_admin;

-- Supabase Storage Bucket Setup (Create 'bills' bucket for receipt uploads)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bills', 'bills', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public storage uploads to bills" ON storage.objects 
FOR ALL USING (bucket_id = 'bills') WITH CHECK (bucket_id = 'bills');
