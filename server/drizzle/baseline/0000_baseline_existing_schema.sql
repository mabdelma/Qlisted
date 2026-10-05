-- Baseline drizzle.__drizzle_migrations for an EXISTING production database
-- whose schema was built by `drizzle-kit push --force` (so this table is EMPTY)
-- and is already current through migration 0026_language_bridge.
--
-- Running `drizzle-kit migrate` against prod WITHOUT this baseline would replay
-- 0000..0026 from scratch; 0000 does `CREATE TABLE "tenants"` and would fail
-- immediately (the table already exists). This file records every existing
-- migration as already-applied so `migrate` becomes a no-op.
--
-- hash          = sha256_hex(UTF-8 bytes of drizzle/<tag>.sql as shipped in the
--                 image, i.e. LF line endings) -- verified against drizzle-orm
--                 0.45.2's own readMigrationFiles(), the exact code `migrate` runs.
-- created_at    = the migration's `when` from drizzle/meta/_journal.json (ms).
-- id            = left to the SERIAL default so the sequence advances and the
--                 next real migration (0027+) gets a fresh id.
--
-- Safe to run only ONCE, on a DB where the table is empty. The guard below
-- aborts the whole transaction if any row already exists.

BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 0 THEN
    RAISE EXCEPTION 'drizzle.__drizzle_migrations is not empty (% rows) -- refusing to baseline', (SELECT count(*) FROM drizzle.__drizzle_migrations);
  END IF;
END $$;

INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES
  ('c18e082da7e12e99c573ee298258c263f7e9980e47de404939640bcda48b7e40', 1781603815302),  --  0 0000_redundant_ben_urich
  ('d5fba5ce29d00d4f793596821e659cc37bd461b86f33404dd7da69ef3f4beb53', 1781604072588),  --  1 0001_far_silhouette
  ('6a7a28fd0c8c1c7cd0b8f99ada3985e94d014cd2dd5006af6a7a1efe60af1ed0', 1781604160874),  --  2 0002_cheerful_silver_surfer
  ('708f2a24e69cd3331d9a3c4768e63816ebb9549afbf4c95da28034994e6c42f1', 1781604202000),  --  3 0003_early_maestro
  ('1b569c2564a3ee0c3619579d9c646a9be1b8f56fb8f418ed7d135a65cbd8ed21', 1781604266178),  --  4 0004_hard_supreme_intelligence
  ('c8e6f7e5d6ee7081dbb7effa1b8db69c1045ab413681689362973e05ed481d5b', 1781604378984),  --  5 0005_mute_ben_parker
  ('9e19d0cd7175e3a0ce9d1c802c8a08c86d7c6704bd6202fc8db11d0ad15c75a8', 1781604413140),  --  6 0006_lucky_northstar
  ('a0cbb33ccf7a8341cbca89b96a5590c3ba23d230527a82332a33304c4dd29a5b', 1781604539087),  --  7 0007_hot_kang
  ('9a16ef7af93076de4bc92b1e2e5ea98472c2fa738b781fcac55d5fceb375205b', 1781636297300),  --  8 0008_branding_fields
  ('f13027a199550fca2462883ef59ca7c5ae45825c9390805aad3f8a95c1afde1c', 1781636647194),  --  9 0009_push_loyalty_tables
  ('181e60cc1ce003aea3e4a51fbca81722bc2cee0d0ce3f06ce3552d237d400547', 1781800000000),  -- 10 0010_expo_push_tokens
  ('18b9db8ce736d15537c9b0e45f4890a3ad704a164ade9acce437858e15b1a3e2', 1781900000000),  -- 11 0011_reservations
  ('97e93ee57b0e8933ed882457c5b19b50868b7db9a9da9f8bad65d9266161a92c', 1781900001000),  -- 12 0012_waitlist_entries
  ('72366c396adee363917d371d461c64e73d197a32cd694976af3c0ab51a8c778e', 1781900002000),  -- 13 0013_delivery_takeout
  ('790022d03c9862a9bc3c31b62f07fa10a678d3f2cd18169b2fe005ebcd2c51cd', 1781900003000),  -- 14 0014_tax_categories
  ('fa9fe6d02decb5b5358750c23c4498f5bfc4f7a089b69e9bddb4a00ae2a09320', 1781900004000),  -- 15 0015_discounts_comps
  ('0a40ae1986c01a476f6f511a293fa565fbe3240c729534fd34c4b519393fcfbf', 1781900005000),  -- 16 0016_item_translations
  ('be7f6a5dde676134ec8bafa79f38a1c5493d3379b1ded90c9e69e702b7423dc2', 1781900006000),  -- 17 0017_gift_cards
  ('2a7a835e81bd0f0da9d56fb8ff2113c40fe8c9c1a321b4c94689dee306786027', 1781900007000),  -- 18 0018_time_entries
  ('29259f6a177d65fa1d0fb71bb8e8e4bf7a5c164474bfbf44b3ae87ff663d7c99', 1782069548858),  -- 19 0019_faithful_rick_jones
  ('789585e602fc5c1390ac7377eb24c1acafe8b1f70f062eed703a82b9efda262c', 1782076758303),  -- 20 0020_cooing_loa
  ('45c6f576a50b2da776281847da35b2e53f41af28cfab51c5025f54a894ee425a', 1782152904537),  -- 21 0021_oval_phil_sheldon
  ('f74c41396125617ae3ec6cac0f55f5fbb85b24fee5c0794d0f86e52e416c32ee', 1786470850396),  -- 22 0022_red_grim_reaper
  ('cd9dbaf3063fbe790cb0fd9479ef140c349efd8a123831e3caf1c20c42085137', 1786497304419),  -- 23 0023_promo_engine_loyalty
  ('8f333c0904f0b3692f5df53986f1ee18c784d1adf10be40fa242f44d035143f5', 1791118099078),  -- 24 0024_hotel_gaps
  ('1e5cbd4f00a6b452d0001a2fa671cf76f7681a2819947bc87d11c91cc2c161fa', 1791118100078),  -- 25 0025_guest_self_checkin
  ('3cd35bcf741ad92c53764cc8fa82e0b8229bb52fb97783bf2eaacd69910abee5', 1791118101078);  -- 26 0026_language_bridge

-- Sanity: 27 rows, and the newest created_at equals journal's max (0026).
DO $$
DECLARE n int; mx bigint;
BEGIN
  SELECT count(*), max(created_at) INTO n, mx FROM drizzle.__drizzle_migrations;
  IF n <> 27 OR mx <> 1791118101078 THEN
    RAISE EXCEPTION 'baseline check failed: % rows, max created_at=%', n, mx;
  END IF;
END $$;

COMMIT;
