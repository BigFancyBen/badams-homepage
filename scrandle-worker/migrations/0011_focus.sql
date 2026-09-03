-- Every card crops its photographs to a wide tile, and the crop has always
-- been the middle of the frame — which on a tall phone photo of a plate on a
-- table is the table. The renderer draws with satori, which ignores
-- object-position entirely, so there was no way to slide the crop even by hand.
--
-- The classifier already looks at every photograph. It now also says where the
-- subject is, as a point in the frame — fractions of the width and height,
-- 0.5/0.5 being dead centre — and the render endpoints centre the crop on it.
--
-- Nullable for the same reason `kind` is: the classifier fills it in a later
-- pass, and everything already in the catalog needs going round again. A
-- photograph with no focal point is cropped the old way until then.

ALTER TABLE dishes ADD COLUMN focus_x REAL;
ALTER TABLE dishes ADD COLUMN focus_y REAL;
