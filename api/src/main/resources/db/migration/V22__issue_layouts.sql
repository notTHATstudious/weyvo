-- How a full issue looks: Classic (default), Editorial, Scrapbook or Minimal. Free plans get Classic and Editorial.
ALTER TABLE trips ADD COLUMN layout VARCHAR(12) NOT NULL DEFAULT 'CLASSIC';
ALTER TABLE trips ADD CONSTRAINT trips_layout_chk CHECK (layout IN ('CLASSIC', 'EDITORIAL', 'SCRAPBOOK', 'MINIMAL'));
