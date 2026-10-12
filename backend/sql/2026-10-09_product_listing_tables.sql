-- Product Listing in Postgres: everything except the image FILES (those stay
-- in Firebase Storage; these tables keep their links).
--
-- Run ONCE in pgAdmin, connected to the spapi_dev database as the `postgres`
-- admin login (portal_app isn't allowed to create tables). Safe to re-run.

-- Rows created with "Add new product" on the Product Listing page.
CREATE TABLE IF NOT EXISTS core.listings (
  id                    bigserial PRIMARY KEY,
  division              text NOT NULL,
  dti_item_code         text NOT NULL,
  dti_item_description  text NOT NULL,
  type                  text NOT NULL,
  ean                   text,
  created_by            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Their photos, in order (position 1 = cover). url/path point at Firebase Storage.
CREATE TABLE IF NOT EXISTS core.listing_images (
  id          bigserial PRIMARY KEY,
  listing_id  bigint NOT NULL REFERENCES core.listings(id) ON DELETE CASCADE,
  position    int    NOT NULL CHECK (position BETWEEN 1 AND 5),
  url         text   NOT NULL,
  path        text   NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, position)
);

-- Dashboard edits to Amazon rows' EAN / Type (Amazon's own tables are
-- read-only and reloaded by the sync, so edits live here and override them).
CREATE TABLE IF NOT EXISTS core.listing_overrides (
  marketplace_id  text NOT NULL,
  seller_sku      text NOT NULL,
  ean             text,
  type            text,
  updated_by      text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (marketplace_id, seller_sku)
);

-- Let the dashboard's login use them.
GRANT SELECT, INSERT, UPDATE, DELETE ON core.listings, core.listing_images, core.listing_overrides TO portal_app;
GRANT USAGE, SELECT ON SEQUENCE core.listings_id_seq, core.listing_images_id_seq TO portal_app;
