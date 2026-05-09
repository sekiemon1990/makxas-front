CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand_code TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY authenticated_all ON brands FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.brands TO anon, authenticated, service_role;

ALTER TABLE stores ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE line_accounts ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE email_accounts ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE comparison_site_accounts ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE phone_numbers ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE inquiries ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

CREATE TABLE staff_brand_access (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, brand_id)
);
ALTER TABLE staff_brand_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY authenticated_all ON staff_brand_access FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.staff_brand_access TO anon, authenticated, service_role;
