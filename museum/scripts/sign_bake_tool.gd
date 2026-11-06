extends SceneTree
## One-off offline tool (not used at runtime): renders "benadams.dev" in Sacramento into a
## SubViewport at 4096 px wide, downsamples, runs an exact Euclidean distance transform and writes
##   textures/sign_text_sdf.png   R = signed distance (0.5 on the glyph edge, inside > 0.5)
##   textures/sign_text_id.png    R = glyph index * 16, G = 255 inside the dark "unlit gap" at a letter join
##   scripts/sign_text_data.gd    aspect, ink rect, letter cuts, stand-off clip positions
## Run windowed (it needs a renderer):  godot --path <project> --script res://scripts/sign_bake_tool.gd
## then re-import. Edit the .import of the PNGs to lossless / no VRAM compression (see signage.gd).

const TEXT := "benadams.dev"
const OUT_W := 2048
const SPREAD := 96.0
const SS := 2

var _vp: SubViewport
var _lbl: Label
var _font: Font
var _phase := 0
var _frames := 0
var _fsize := 300
var _ink := Rect2i()


func _initialize() -> void:
	_font = load("res://assets/fonts/Sacramento-Regular.ttf")
	_vp = SubViewport.new()
	_vp.size = Vector2i(4096, 1400)
	_vp.transparent_bg = false
	_vp.disable_3d = true
	_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(_vp)
	var bg := ColorRect.new()
	bg.color = Color.BLACK
	bg.size = Vector2(4096, 1400)
	_vp.add_child(bg)
	_lbl = Label.new()
	_lbl.add_theme_font_override("font", _font)
	_lbl.add_theme_font_size_override("font_size", _fsize)
	_lbl.add_theme_color_override("font_color", Color.WHITE)
	_lbl.text = TEXT
	_lbl.position = Vector2(200, 200)
	_vp.add_child(_lbl)


func _process(_dt: float) -> bool:
	_frames += 1
	if _frames < 4:
		return false
	var img := _vp.get_texture().get_image()
	img.convert(Image.FORMAT_L8)
	var r := _ink_rect(img)
	if _phase == 0:
		var scale_f := 3300.0 / float(r.size.x)
		_fsize = int(float(_fsize) * scale_f)
		_lbl.add_theme_font_size_override("font_size", _fsize)
		_lbl.position = Vector2(360, 300)
		_phase = 1
		_frames = 0
		return false
	_finish(img, r)
	return true


func _ink_rect(img: Image) -> Rect2i:
	var x0 := img.get_width()
	var y0 := img.get_height()
	var x1 := 0
	var y1 := 0
	var data := img.get_data()
	var w := img.get_width()
	for y in img.get_height():
		for x in w:
			if data[y * w + x] > 128:
				x0 = mini(x0, x)
				x1 = maxi(x1, x)
				y0 = mini(y0, y)
				y1 = maxi(y1, y)
	return Rect2i(x0, y0, x1 - x0 + 1, y1 - y0 + 1)


func _finish(img: Image, r: Rect2i) -> void:
	# crop ink + margin (in supersampled px), then downsample to OUT_W
	var margin := int(SPREAD) * SS
	var cw := r.size.x + margin * 2
	var ch := r.size.y + margin * 2
	var crop := Image.create(cw, ch, false, Image.FORMAT_L8)
	crop.blit_rect(img, Rect2i(r.position.x - margin, r.position.y - margin, cw, ch), Vector2i.ZERO)
	var ow := OUT_W
	var oh := int(round(float(ch) * float(ow) / float(cw)))
	crop.resize(ow, oh, Image.INTERPOLATE_LANCZOS)
	var px := float(ow) / float(cw) * float(SS) / float(SS)
	var data := crop.get_data()
	var n := ow * oh
	var inside := PackedByteArray()
	inside.resize(n)
	for i in n:
		inside[i] = 1 if data[i] > 127 else 0
	print("edt ", ow, "x", oh)
	var din := _edt(inside, ow, oh, true)
	var dout := _edt(inside, ow, oh, false)
	var sdf := Image.create(ow, oh, false, Image.FORMAT_L8)
	var sd := PackedByteArray()
	sd.resize(n)
	var hw := 0.0
	for i in n:
		var a := float(data[i]) / 255.0
		var d := (din[i] - dout[i]) + (a - 0.5) * 0.0
		if inside[i] == 1:
			d = din[i] - 0.5
		else:
			d = -(dout[i] - 0.5)
		hw = maxf(hw, d)
		sd[i] = int(clampf(0.5 + d / (2.0 * SPREAD), 0.0, 1.0) * 255.0 + 0.5)
	sdf = Image.create_from_data(ow, oh, false, Image.FORMAT_L8, sd)
	sdf.save_png("res://textures/sign_text_sdf.png")
	# letter cuts: x of the end of each prefix, in the final texture's uv
	var scale_x := float(ow) / float(cw)
	var origin_x := float(_lbl.position.x) - float(r.position.x - margin)
	var cuts: Array[float] = []
	var lab_ink_off := 0.0
	for i in range(1, TEXT.length()):
		var wpre := _font.get_string_size(TEXT.substr(0, i), HORIZONTAL_ALIGNMENT_LEFT, -1, _fsize).x
		cuts.append((origin_x + wpre) * scale_x / float(ow))
	var idimg := Image.create(1024, 1, false, Image.FORMAT_RG8)
	var gap_px := 0.0042
	for x in 1024:
		var u := (float(x) + 0.5) / 1024.0
		var gid := 0
		var gap := 0.0
		for k in cuts.size():
			if u > cuts[k]:
				gid = k + 1
			if absf(u - cuts[k]) < gap_px:
				gap = 1.0
		idimg.set_pixel(x, 0, Color(float(gid) * 16.0 / 255.0, gap, 0.0))
	idimg.save_png("res://textures/sign_text_id.png")
	# clip positions on stroke ridges
	var ridge: Array[Vector2i] = []
	for y in range(2, oh - 2, 2):
		for x in range(2, ow - 2, 2):
			var v: float = din[y * ow + x]
			if v < 2.5:
				continue
			var ismax := true
			for oy in range(-1, 2):
				for ox in range(-1, 2):
					if din[(y + oy) * ow + x + ox] > v:
						ismax = false
			if ismax:
				ridge.append(Vector2i(x, y))
	var clips: Array[Vector2i] = []
	var min_d2 := 150.0 * 150.0
	for p in ridge:
		var ok := true
		for c in clips:
			if (c - p).length_squared() < min_d2:
				ok = false
				break
		if ok:
			clips.append(p)
	var f := FileAccess.open("res://scripts/sign_text_data.gd", FileAccess.WRITE)
	f.store_string("extends RefCounted\n## Generated by sign_bake_tool.gd. Do not edit.\n\n")
	f.store_string("const ASPECT := %f\n" % (float(ow) / float(oh)))
	f.store_string("const SPREAD_PX := %f\n" % SPREAD)
	f.store_string("const TEX_W := %d\n" % ow)
	f.store_string("const HALF_STROKE_PX := %f\n" % hw)
	f.store_string("const INK_U0 := %f\nconst INK_U1 := %f\n" % [float(margin) * scale_x / float(ow), 1.0 - float(margin) * scale_x / float(ow)])
	f.store_string("const GLYPHS := %d\n" % TEXT.length())
	var cs := PackedStringArray()
	for c in cuts:
		cs.append("%f" % c)
	f.store_string("const CUTS := [%s]\n" % ", ".join(cs))
	var ps := PackedStringArray()
	for c in clips:
		ps.append("Vector2(%f, %f)" % [float(c.x) / float(ow), float(c.y) / float(oh)])
	f.store_string("const CLIPS := [%s]\n" % ", ".join(ps))
	f.close()
	print("done: ink halfstroke px ", hw, " clips ", clips.size(), " aspect ", float(ow) / float(oh))


## Exact squared-Euclid distance transform (Felzenszwalb). target_inside: distance of each inside
## pixel to the nearest outside pixel (0 for outside); else distance of outside to nearest inside.
func _edt(inside: PackedByteArray, w: int, h: int, target_inside: bool) -> PackedFloat32Array:
	var inf := 1.0e9
	var f := PackedFloat32Array()
	f.resize(w * h)
	for i in w * h:
		var src := inside[i] == 1
		var seed_here := (not src) if target_inside else src
		f[i] = 0.0 if seed_here else inf
	var col := PackedFloat32Array()
	col.resize(maxi(w, h))
	var out := PackedFloat32Array()
	out.resize(maxi(w, h))
	var v := PackedInt32Array()
	v.resize(maxi(w, h))
	var z := PackedFloat32Array()
	z.resize(maxi(w, h) + 1)
	for x in w:
		for y in h:
			col[y] = f[y * w + x]
		_dt1(col, out, v, z, h, inf)
		for y in h:
			f[y * w + x] = out[y]
	for y in h:
		for x in w:
			col[x] = f[y * w + x]
		_dt1(col, out, v, z, w, inf)
		for x in w:
			f[y * w + x] = sqrt(out[x])
	return f


func _dt1(fv: PackedFloat32Array, d: PackedFloat32Array, v: PackedInt32Array, z: PackedFloat32Array, n: int, inf: float) -> void:
	var k := 0
	v[0] = 0
	z[0] = -inf
	z[1] = inf
	for q in range(1, n):
		var s := ((fv[q] + float(q * q)) - (fv[v[k]] + float(v[k] * v[k]))) / (2.0 * float(q - v[k]))
		while s <= z[k]:
			k -= 1
			s = ((fv[q] + float(q * q)) - (fv[v[k]] + float(v[k] * v[k]))) / (2.0 * float(q - v[k]))
		k += 1
		v[k] = q
		z[k] = s
		z[k + 1] = inf
	k = 0
	for q in n:
		while z[k + 1] < float(q):
			k += 1
		var dq := float(q - v[k])
		d[q] = dq * dq + fv[v[k]]
