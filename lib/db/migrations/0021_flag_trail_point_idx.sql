-- FID-20260909-037 egress fix: getTrailInfoAt became a point lookup on
-- (x, y, expires_at) after the tile route stop re-reading the whole trail
-- list. Without this index every trail check on a tile view seq-scans
-- flag_trail (66K list reads / week were observed before the rewrite).

CREATE INDEX IF NOT EXISTS flag_trail_point_idx
  ON flag_trail (x, y, expires_at);
