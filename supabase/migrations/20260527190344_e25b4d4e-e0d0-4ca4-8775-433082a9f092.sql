
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'accountant', 'warehouse', 'viewer');
CREATE TYPE public.movement_type AS ENUM ('receipt', 'issue', 'transfer', 'adjustment');
CREATE TYPE public.po_status AS ENUM ('open', 'partial', 'received', 'closed', 'cancelled');
CREATE TYPE public.journal_status AS ENUM ('draft', 'posted', 'error');
CREATE TYPE public.integration_provider AS ENUM ('xero', 'precoro');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bootstrap: first user becomes admin
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_bootstrap_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();

-- ============ LOCATIONS ============
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loc_select_all" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "loc_admin_write" ON public.locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ ITEMS ============
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  uom TEXT NOT NULL DEFAULT 'EA',
  default_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  reorder_point NUMERIC(14,4),
  is_tracked BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  xero_item_id TEXT,
  xero_inventory_account TEXT,
  xero_cogs_account TEXT,
  precoro_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_select_all" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items_admin_write" ON public.items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));
CREATE INDEX idx_items_sku ON public.items(sku);

-- ============ STOCK LEVELS (cache) ============
CREATE TABLE public.stock_levels (
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  qty_on_hand NUMERIC(14,4) NOT NULL DEFAULT 0,
  avg_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, location_id)
);
GRANT SELECT ON public.stock_levels TO authenticated;
GRANT ALL ON public.stock_levels TO service_role;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_select_all" ON public.stock_levels FOR SELECT TO authenticated USING (true);

-- ============ STOCK MOVEMENTS ============
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type public.movement_type NOT NULL,
  item_id UUID NOT NULL REFERENCES public.items(id),
  from_location_id UUID REFERENCES public.locations(id),
  to_location_id UUID REFERENCES public.locations(id),
  qty NUMERIC(14,4) NOT NULL,
  unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  reference TEXT,
  reason TEXT,
  po_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mov_select_all" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "mov_insert_warehouse" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','warehouse','accountant']::public.app_role[]));
CREATE INDEX idx_mov_item_date ON public.stock_movements(item_id, created_at DESC);
CREATE INDEX idx_mov_date ON public.stock_movements(created_at DESC);

-- Apply movement to stock_levels (weighted average cost). Called by trigger.
CREATE OR REPLACE FUNCTION public.apply_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur_qty NUMERIC(14,4);
  cur_cost NUMERIC(14,4);
  new_qty NUMERIC(14,4);
  new_cost NUMERIC(14,4);
BEGIN
  IF NEW.movement_type = 'receipt' THEN
    IF NEW.to_location_id IS NULL THEN RAISE EXCEPTION 'Receipt requires to_location_id'; END IF;
    INSERT INTO public.stock_levels (item_id, location_id, qty_on_hand, avg_cost)
      VALUES (NEW.item_id, NEW.to_location_id, 0, 0)
      ON CONFLICT DO NOTHING;
    SELECT qty_on_hand, avg_cost INTO cur_qty, cur_cost
      FROM public.stock_levels WHERE item_id = NEW.item_id AND location_id = NEW.to_location_id FOR UPDATE;
    new_qty := cur_qty + NEW.qty;
    IF new_qty > 0 THEN
      new_cost := ((cur_qty * cur_cost) + (NEW.qty * NEW.unit_cost)) / new_qty;
    ELSE
      new_cost := cur_cost;
    END IF;
    UPDATE public.stock_levels
      SET qty_on_hand = new_qty, avg_cost = new_cost, updated_at = now()
      WHERE item_id = NEW.item_id AND location_id = NEW.to_location_id;

  ELSIF NEW.movement_type = 'issue' THEN
    IF NEW.from_location_id IS NULL THEN RAISE EXCEPTION 'Issue requires from_location_id'; END IF;
    SELECT qty_on_hand, avg_cost INTO cur_qty, cur_cost
      FROM public.stock_levels WHERE item_id = NEW.item_id AND location_id = NEW.from_location_id FOR UPDATE;
    IF cur_qty IS NULL THEN RAISE EXCEPTION 'No stock for item at location'; END IF;
    -- Set unit_cost to current avg if not provided
    IF NEW.unit_cost = 0 THEN
      NEW.unit_cost := cur_cost;
    END IF;
    UPDATE public.stock_levels
      SET qty_on_hand = cur_qty - NEW.qty, updated_at = now()
      WHERE item_id = NEW.item_id AND location_id = NEW.from_location_id;

  ELSIF NEW.movement_type = 'transfer' THEN
    IF NEW.from_location_id IS NULL OR NEW.to_location_id IS NULL THEN
      RAISE EXCEPTION 'Transfer requires from_location_id and to_location_id'; END IF;
    SELECT qty_on_hand, avg_cost INTO cur_qty, cur_cost
      FROM public.stock_levels WHERE item_id = NEW.item_id AND location_id = NEW.from_location_id FOR UPDATE;
    IF cur_qty IS NULL OR cur_qty < NEW.qty THEN RAISE EXCEPTION 'Insufficient stock to transfer'; END IF;
    NEW.unit_cost := cur_cost;
    UPDATE public.stock_levels SET qty_on_hand = cur_qty - NEW.qty, updated_at = now()
      WHERE item_id = NEW.item_id AND location_id = NEW.from_location_id;
    INSERT INTO public.stock_levels (item_id, location_id, qty_on_hand, avg_cost)
      VALUES (NEW.item_id, NEW.to_location_id, 0, 0)
      ON CONFLICT DO NOTHING;
    SELECT qty_on_hand, avg_cost INTO cur_qty, cur_cost
      FROM public.stock_levels WHERE item_id = NEW.item_id AND location_id = NEW.to_location_id FOR UPDATE;
    new_qty := cur_qty + NEW.qty;
    IF new_qty > 0 THEN
      new_cost := ((cur_qty * cur_cost) + (NEW.qty * NEW.unit_cost)) / new_qty;
    ELSE
      new_cost := cur_cost;
    END IF;
    UPDATE public.stock_levels SET qty_on_hand = new_qty, avg_cost = new_cost, updated_at = now()
      WHERE item_id = NEW.item_id AND location_id = NEW.to_location_id;

  ELSIF NEW.movement_type = 'adjustment' THEN
    -- qty may be negative; from_location_id is the affected location
    IF NEW.from_location_id IS NULL THEN RAISE EXCEPTION 'Adjustment requires from_location_id'; END IF;
    INSERT INTO public.stock_levels (item_id, location_id, qty_on_hand, avg_cost)
      VALUES (NEW.item_id, NEW.from_location_id, 0, NEW.unit_cost)
      ON CONFLICT DO NOTHING;
    SELECT qty_on_hand, avg_cost INTO cur_qty, cur_cost
      FROM public.stock_levels WHERE item_id = NEW.item_id AND location_id = NEW.from_location_id FOR UPDATE;
    new_qty := cur_qty + NEW.qty;
    IF NEW.qty > 0 AND new_qty > 0 THEN
      -- positive adjustment: blend cost
      new_cost := ((cur_qty * cur_cost) + (NEW.qty * NEW.unit_cost)) / new_qty;
    ELSE
      new_cost := cur_cost;
    END IF;
    UPDATE public.stock_levels SET qty_on_hand = new_qty, avg_cost = new_cost, updated_at = now()
      WHERE item_id = NEW.item_id AND location_id = NEW.from_location_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_movement
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_movement();

-- ============ PURCHASE ORDERS (from Precoro) ============
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  precoro_id TEXT UNIQUE,
  po_number TEXT NOT NULL,
  vendor_name TEXT,
  status public.po_status NOT NULL DEFAULT 'open',
  currency TEXT DEFAULT 'USD',
  total_amount NUMERIC(14,2) DEFAULT 0,
  ordered_at TIMESTAMPTZ,
  expected_at TIMESTAMPTZ,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_select_all" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "po_write_warehouse" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','warehouse','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','warehouse','accountant']::public.app_role[]));

CREATE TABLE public.po_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  line_number INT,
  item_id UUID REFERENCES public.items(id),
  precoro_item_id TEXT,
  description TEXT,
  qty_ordered NUMERIC(14,4) NOT NULL DEFAULT 0,
  qty_received NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_lines TO authenticated;
GRANT ALL ON public.po_lines TO service_role;
ALTER TABLE public.po_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poline_select_all" ON public.po_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "poline_write" ON public.po_lines FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','warehouse','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','warehouse','accountant']::public.app_role[]));

-- ============ JOURNAL BATCHES (posted to Xero) ============
CREATE TABLE public.journal_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  narration TEXT,
  status public.journal_status NOT NULL DEFAULT 'draft',
  xero_journal_id TEXT,
  total_debit NUMERIC(14,2) DEFAULT 0,
  total_credit NUMERIC(14,2) DEFAULT 0,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  posted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.journal_batches TO authenticated;
GRANT ALL ON public.journal_batches TO service_role;
ALTER TABLE public.journal_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jb_select_all" ON public.journal_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "jb_write_accountant" ON public.journal_batches FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

-- ============ INTEGRATION CONNECTIONS ============
CREATE TABLE public.integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider public.integration_provider NOT NULL UNIQUE,
  tenant_id TEXT,
  tenant_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Tokens are sensitive: only admins read; service role for server fns
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ic_admin_only" ON public.integration_connections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_items_touch BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_locations_touch BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ic_touch BEFORE UPDATE ON public.integration_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
