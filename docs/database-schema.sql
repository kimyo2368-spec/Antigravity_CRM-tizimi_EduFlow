-- ========================================================
-- 📘 EduFlow CRM v1.0 — PostgreSQL / Supabase Schema
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BRANCHES (Filiallar)
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- e.g., BR-001
    name VARCHAR(100) NOT NULL, -- e.g., Chilonzor, Yunusobod
    address TEXT,
    phone VARCHAR(30),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS & ROLES (Xodimlar va Foydalanuvchilar)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- e.g., US-000001
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    phone VARCHAR(30),
    role VARCHAR(30) NOT NULL CHECK (role IN (
        'super_admin', 'branch_admin', 'manager', 'teacher', 
        'cashier', 'call_center', 'student', 'parent'
    )),
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. STUDENTS (O'quvchilar)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- ST-000001
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    parent_name VARCHAR(120),
    parent_phone VARCHAR(30),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'graduated', 'left')),
    balance NUMERIC(12, 2) DEFAULT 0, -- Account balance
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. COURSES & GROUPS (Kurslar va Guruhlar)
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(50) NOT NULL,
    monthly_fee NUMERIC(10, 2) NOT NULL,
    duration_months INT DEFAULT 3
);

CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- GR-000001
    name VARCHAR(100) NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE RESTRICT,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    schedule_days VARCHAR(50) NOT NULL, -- 'Dush-Shor-Jum' / 'Sesh-Pay-Shan'
    schedule_time VARCHAR(20) NOT NULL, -- '14:00 - 16:00'
    room_number VARCHAR(30),
    max_capacity INT DEFAULT 18,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- GROUP ENROLLMENTS
CREATE TABLE IF NOT EXISTS group_students (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, student_id)
);

-- 5. ATTENDANCE (Davomat)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
    marked_by UUID REFERENCES users(id),
    sms_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (group_id, student_id, date)
);

-- 6. PAYMENTS (To'lovlar)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- PM-000001
    student_id UUID REFERENCES students(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash', 'card', 'click', 'payme', 'bank_transfer')),
    month VARCHAR(20) NOT NULL, -- '2026-08'
    received_by UUID REFERENCES users(id),
    receipt_printed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. LEADS (Lidlar & Qabul)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- LE-000001
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    subject_interested VARCHAR(50),
    source VARCHAR(50) DEFAULT 'telegram', -- telegram, instagram, friend, banner
    status VARCHAR(30) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'trial_lesson', 'enrolled', 'lost')),
    assigned_to UUID REFERENCES users(id),
    branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. SETTINGS (Sozlamalar)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SEED DATA FOR DEMO / INITIAL SETUP
INSERT INTO branches (code, name, address, phone) VALUES
('BR-001', 'Chilonzor Filiali', 'Toshkent sh., Chilonzor 9-daha', '+998 71 200-11-22'),
('BR-002', 'Yunusobod Filiali', 'Toshkent sh., Yunusobod 4-mavze', '+998 71 200-33-44'),
('BR-003', 'Samarqand Filiali', 'Samarqand sh., Dagbit ko''chasi 15', '+998 66 200-55-66'),
('BR-004', 'Buxoro Filiali', 'Buxoro sh., Naqshbandiy k.', '+998 65 200-77-88')
ON CONFLICT DO NOTHING;
