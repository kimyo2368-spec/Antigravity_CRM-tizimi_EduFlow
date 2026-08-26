-- ========================================================
-- 🏛️ EduFlow CRM — Database Foundation Schema (Sprint 1)
-- Sequential Order: users -> roles -> branches -> students -> teachers -> courses -> groups
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ROLES (Rollar)
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (id, name, description) VALUES
('super_admin', 'Super Admin', 'Barcha tizim va moliya ustidan to''liq nazorat'),
('branch_admin', 'Filial Admini', 'Filial faoliyatini boshqaruvchi admin'),
('manager', 'Menejer', 'O''quvchilar va lidlar bo''yicha mas'‘ul'),
('teacher', 'O''qituvchi', 'Guruhlar va davomat uchun mas'‘ul'),
('cashier', 'Kassir', 'To''lovlarni qabul qiluvchi xodim'),
('call_center', 'Call Center', 'Lidlar va qo''ng'‘iroqlar bilan ishlovchi operator'),
('student', 'O''quvchi', 'Darslar va natijalarni kuzatuvchi o''quvchi'),
('parent', 'Ota-ona', 'Farzandi davomati va to''lovlarini kuzatuvchi')
ON CONFLICT DO NOTHING;

-- 2. BRANCHES (Filiallar)
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- BR-000001
    name VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(30),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. USERS (Foydalanuvchilar va Xodimlar)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- US-000001
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    phone VARCHAR(30),
    role_id VARCHAR(30) REFERENCES roles(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. STUDENTS (O'quvchilar)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- ST-000001
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL, -- Format: +998901234567
    parent_name VARCHAR(120),
    parent_phone VARCHAR(30),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'graduated', 'left')),
    balance NUMERIC(12, 2) DEFAULT 0, -- Balance in so'm
    joined_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TEACHERS (O'qituvchilar)
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- TE-000001
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    hourly_rate NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. COURSES (Kurslar va Fanlar)
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    monthly_fee NUMERIC(12, 2) NOT NULL, -- Fee in so'm
    duration_months INT DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. GROUPS (Guruhlar)
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- GR-000001
    name VARCHAR(100) NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE RESTRICT,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    schedule_days VARCHAR(50) NOT NULL, -- e.g., 'Dush-Shor-Jum'
    schedule_time VARCHAR(20) NOT NULL, -- e.g., '14:00 - 16:00'
    room_number VARCHAR(30),
    max_capacity INT DEFAULT 18,
    status VARCHAR(30) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
