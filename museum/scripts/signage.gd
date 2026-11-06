extends RefCounted
## Signage: the entrance marquee and the per-bay plaques.
## Marquee: a deep header over the hall opening with moulded brass and steel frames, a recessed
## enamel face (sign_face shader) carrying glass-neon tubes in Sacramento drawn from a baked
## signed-distance texture (sign_neon / sign_glow shaders), stand-off clips, a ring of chaser bulbs
## (glass + filament + halo), a bulb soffit, rivets and edge trim, and a transformer with conduit.
## Plaques: engraved brass plates (plate.gdshader) whose Cinzel text mask is baked after the first
## frame, in a bevelled brass frame mesh.
## Materials are local: see sign_materials.gd.

const Layout := preload("res://scripts/layout.gd")
const Architecture := preload("res://scripts/architecture.gd")
const Fixtures := preload("res://scripts/fixtures.gd")
const Clock := preload("res://scripts/clock.gd")
const SM := preload("res://scripts/sign_materials.gd")
const SignMesh := preload("res://scripts/sign_mesh.gd")
const TexData := preload("res://scripts/sign_text_data.gd")

const PANEL_W := 12.4
const NG := 12

static var _lv := PackedFloat32Array()
static var _fl_on: int = -1
static var _led_pos := Vector3.ZERO
static var _sign_w: float = 10.0
static var _sign_y: float = 6.7
static var _local: Dictionary = {}


## `tick` is awaited between the parts, so the page gets to repaint between them (see hall.gd).
static func build(root: Node3D, exhibits: Array, tick: Callable) -> void:
	_local.clear()
	_build_plaques(root, exhibits)
	await tick.call()
	_build_marquee(root)
	await tick.call()
	_flush_local(root)


## Where the neon sign's text centre is (for capture shots and tools).
static func sign_center() -> Vector3:
	return Vector3(0.0, _sign_y, Layout.MQ_Z - 0.36)


# ---------------------------------------------------------------- local batching

static func _add(mat_name: String, xf: Transform3D, kind: String = "box") -> void:
	var key := kind + "|" + mat_name
	if not _local.has(key):
		var xfs: Array[Transform3D] = []
		_local[key] = {"kind": kind, "mat": mat_name, "xfs": xfs}
	var list: Array[Transform3D] = _local[key]["xfs"]
	list.append(xf)


static func _block(mat_name: String, size: Vector3, pos: Vector3) -> void:
	_add(mat_name, Transform3D(Basis.from_scale(size), pos))


## cylinder of radius r and length l along Z, centred at p
static func _zcyl(mat_name: String, r: float, l: float, p: Vector3) -> void:
	_add(mat_name, Transform3D(Basis(Vector3.RIGHT, PI * 0.5) * Basis.from_scale(Vector3(r, l, r)), p), "cyl")


static func _flush_local(root: Node3D) -> void:
	var meshes := {}
	var cyl := CylinderMesh.new()
	cyl.top_radius = 1.0
	cyl.bottom_radius = 1.0
	cyl.height = 1.0
	cyl.radial_segments = 12
	cyl.rings = 1
	meshes["cyl"] = cyl
	var sph := SphereMesh.new()
	sph.radius = 1.0
	sph.height = 2.0
	sph.radial_segments = 8
	sph.rings = 4
	meshes["sph"] = sph
	meshes["box"] = Architecture.box(Vector3.ONE)
	for key in _local:
		var info: Dictionary = _local[key]
		var xfs: Array[Transform3D] = info["xfs"]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = meshes[str(info["kind"])]
		mm.instance_count = xfs.size()
		for i in xfs.size():
			mm.set_instance_transform(i, xfs[i])
		var inst := MultiMeshInstance3D.new()
		inst.multimesh = mm
		inst.material_override = SM.get_mat(str(info["mat"]))
		inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(inst)
	_local.clear()


static func _mesh_at(root: Node3D, mesh: Mesh, mat: Material, xf: Transform3D) -> void:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = mat
	m.transform = xf
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(m)


# ---------------------------------------------------------------- plaques

static func _build_plaques(root: Node3D, exhibits: Array) -> void:
	var n := exhibits.size()
	var frame := SignMesh.ring(1.395, 0.62, [Vector2(0.0, -0.006), Vector2(0.007, 0.016), Vector2(0.02, 0.031), Vector2(0.05, 0.035), Vector2(0.066, 0.025), Vector2(0.075, 0.004)])
	var fmm := MultiMesh.new()
	fmm.transform_format = MultiMesh.TRANSFORM_3D
	fmm.mesh = frame
	fmm.instance_count = n
	var pq := QuadMesh.new()
	pq.size = Vector2(2.64, 1.09)
	for b in n:
		var rot := Layout.plaque_rot(b)
		var org := Layout.plaque_org(b)
		var c := org + rot * Vector3(0, 0.575, 0.016)
		_mesh_at(root, pq, SM.plate(b), Transform3D(rot, c))
		_load_mask(b, exhibits[b])
		fmm.set_instance_transform(b, Transform3D(rot, c))
	var fi := MultiMeshInstance3D.new()
	fi.multimesh = fmm
	fi.material_override = SM.get_mat("plaque_brass")
	fi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(fi)


const MW := 1536
const MH := 634
const MASK_DIR := "res://textures/plaques/"
const TITLE_W := 1200.0
const TITLE_H := 340.0


## A plaque's baked text mask: textures/plaques/<exhibit id>.png, made by plaque_bake_tool.gd.
static func mask_path(exhibit: Dictionary) -> String:
	return MASK_DIR + str(exhibit.get("id", "")) + ".png"


static func _load_mask(b: int, exhibit: Dictionary) -> void:
	var path := mask_path(exhibit)
	if not ResourceLoader.exists(path):
		push_warning("no baked plaque mask %s (run scripts/museum-bake.mjs)" % path)
		return
	var tex: Texture2D = load(path)
	SM.plate(b).set_shader_parameter("mask", tex)
	SM.plate(b).set_shader_parameter("msize", Vector2(tex.get_width(), tex.get_height()))


## OFFLINE (plaque_bake_tool.gd): render each plaque's text (title, ornament rule, inset rule) in Cinzel semibold into an L8 mask with mipmaps, via SubViewports;
## plate.gdshader derives the engraving from it. Awaits two frames, so it needs a renderer.
## Returns one Image per exhibit.
static func render_plaque_masks(root: Node, exhibits: Array) -> Array[Image]:
	var font := FontVariation.new()
	font.base_font = load("res://assets/fonts/Cinzel-VariableFont_wght.ttf")
	font.variation_opentype = {TextServerManager.get_primary_interface().name_to_tag("wght"): 600}
	font.spacing_glyph = 3
	var vps: Array[SubViewport] = []
	var nb := exhibits.size()
	for b in nb:
		var vp := SubViewport.new()
		vp.size = Vector2i(MW, MH)
		vp.transparent_bg = false
		vp.disable_3d = true
		vp.render_target_update_mode = SubViewport.UPDATE_ONCE
		_rect(vp, Rect2(0, 0, MW, MH), Color.BLACK)
		# inset double rule
		for inset in [30.0, 44.0]:
			var th: float = 5.0 if inset < 40.0 else 2.5
			_rect(vp, Rect2(inset, inset, MW - 2.0 * inset, th), Color.WHITE)
			_rect(vp, Rect2(inset, MH - inset - th, MW - 2.0 * inset, th), Color.WHITE)
			_rect(vp, Rect2(inset, inset, th, MH - 2.0 * inset), Color.WHITE)
			_rect(vp, Rect2(MW - inset - th, inset, th, MH - 2.0 * inset), Color.WHITE)
		# title (1-2 lines, as large as fits) with the ornament rule beneath; the pair is centred
		var title := str(exhibits[b].get("title", ""))
		var ts := 52
		var tdim := Vector2.ZERO
		var s := 176
		while s >= 52:
			tdim = font.get_multiline_string_size(title, HORIZONTAL_ALIGNMENT_CENTER, TITLE_W, s)
			if tdim.y <= TITLE_H and tdim.x <= TITLE_W + 1.0:
				ts = s
				break
			s -= 4
		var gap := 64.0
		var top := (MH - (tdim.y + gap + 4.0)) * 0.5
		_label(vp, font, title, Rect2((MW - TITLE_W) * 0.5, top, TITLE_W, tdim.y), ts, ts, VERTICAL_ALIGNMENT_TOP)
		var ry := top + tdim.y + gap
		_rect(vp, Rect2(300, ry - 2.0, MW - 600, 4), Color.WHITE)
		for dx in [-455.0, 455.0]:
			_diamond(vp, Vector2(MW * 0.5 + dx, ry), 8.0)
		for dx in [-380.0, 380.0]:
			_diamond(vp, Vector2(MW * 0.5 + dx, ry), 5.0)
		_diamond(vp, Vector2(MW * 0.5, ry), 20.0)
		root.add_child(vp)
		vps.append(vp)
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var out: Array[Image] = []
	for b in nb:
		var tex := vps[b].get_texture()
		var img: Image = tex.get_image() if tex != null else null
		if img != null and img.get_width() > 8:
			img.convert(Image.FORMAT_L8)
		out.append(img)
		vps[b].queue_free()
	return out


static func _rect(vp: Node, r: Rect2, c: Color) -> void:
	var cr := ColorRect.new()
	cr.color = c
	cr.position = r.position
	cr.size = r.size
	vp.add_child(cr)


static func _diamond(vp: Node, c: Vector2, r: float) -> void:
	var cr := ColorRect.new()
	cr.color = Color.WHITE
	cr.size = Vector2(r * 1.4, r * 1.4)
	cr.pivot_offset = cr.size * 0.5
	cr.rotation = PI * 0.25
	cr.position = c - cr.size * 0.5
	vp.add_child(cr)


static func _label(vp: Node, font: Font, txt: String, r: Rect2, max_size: int, min_size: int, va: VerticalAlignment) -> void:
	var sz := min_size
	var s := max_size
	while s >= min_size:
		var dim := font.get_multiline_string_size(txt, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, s)
		if dim.y <= r.size.y and dim.x <= r.size.x + 1.0:
			sz = s
			break
		s -= 4
	var l := Label.new()
	l.text = txt
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", sz)
	l.add_theme_color_override("font_color", Color.WHITE)
	l.position = r.position
	l.size = r.size
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = va
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vp.add_child(l)


# ---------------------------------------------------------------- marquee

static func _loop_pos(d: float, wdt: float, hgt: float, cx: float, cy: float, z: float) -> Vector3:
	var x0 := cx - wdt * 0.5
	var y0 := cy - hgt * 0.5
	if d < wdt:
		return Vector3(x0 + d, y0, z)
	if d < wdt + hgt:
		return Vector3(x0 + wdt, y0 + (d - wdt), z)
	if d < 2.0 * wdt + hgt:
		return Vector3(x0 + wdt - (d - wdt - hgt), y0 + hgt, z)
	return Vector3(x0, y0 + hgt - (d - 2.0 * wdt - hgt), z)


static func _build_marquee(root: Node3D) -> void:
	var hw := Layout.HALF_W
	var wh := Layout.WALL_H
	var zf := Layout.MQ_Z
	var y0 := 4.4
	var y1 := wh
	var open_w := PANEL_W
	var open_h := PANEL_W / TexData.ASPECT
	var open_c := 6.7
	var by0 := open_c - open_h * 0.5
	var by1 := open_c + open_h * 0.5
	var zb := zf - 2.2
	_sign_y = open_c
	_sign_w = PANEL_W * (TexData.INK_U1 - TexData.INK_U0)
	# ---- the header body (hall stone), ring around the recess
	var yc := (y0 + y1) * 0.5
	Architecture.block("stone", Vector3(hw * 2.0, y1 - y0, zf - 0.4 - zb), Vector3(0, yc, (zf - 0.4 + zb) * 0.5))
	var ring_z := zf - 0.2
	Architecture.block("stone", Vector3(hw * 2.0, by0 - y0, 0.4), Vector3(0, (y0 + by0) * 0.5, ring_z))
	Architecture.block("stone", Vector3(hw * 2.0, y1 - by1, 0.4), Vector3(0, (by1 + y1) * 0.5, ring_z))
	var sw := (hw * 2.0 - open_w) * 0.5
	for sx in [-1.0, 1.0]:
		Architecture.block("stone", Vector3(sw, open_h, 0.4), Vector3(sx * (open_w * 0.5 + sw * 0.5), open_c, ring_z))
	# cornice + crown mouldings matching the hall trim, brass bead
	Architecture.block("stone", Vector3(hw * 2.0 + 0.2, 0.2, 0.7), Vector3(0, y0 - 0.02, zf - 0.05))
	Architecture.block("stone", Vector3(hw * 2.0 + 0.2, 0.3, 0.6), Vector3(0, y1 - 0.15, zf - 0.1))
	Architecture.block("trim_brass", Vector3(hw * 2.0, 0.06, 0.06), Vector3(0, y0 + 0.2, zf + 0.0))
	Architecture.block("trim_brass", Vector3(hw * 2.0, 0.06, 0.06), Vector3(0, y1 - 0.4, zf - 0.05))
	# ---- moulded frames: steel outer, brass inner
	var steel := SignMesh.ring(open_w * 0.5 + 0.52, open_h * 0.5 + 0.52, [Vector2(0.0, 0.0), Vector2(0.02, 0.028), Vector2(0.06, 0.04), Vector2(0.24, 0.04), Vector2(0.28, 0.026), Vector2(0.3, 0.0)])
	_mesh_at(root, steel, SM.get_mat("sign_steel"), Transform3D(Basis.IDENTITY, Vector3(0, open_c, zf + 0.002)))
	var brass := SignMesh.ring(open_w * 0.5 + 0.22, open_h * 0.5 + 0.22, [Vector2(0.0, 0.0), Vector2(0.02, 0.05), Vector2(0.06, 0.075), Vector2(0.09, 0.075), Vector2(0.11, 0.05), Vector2(0.135, 0.05), Vector2(0.15, 0.085), Vector2(0.19, 0.085), Vector2(0.21, 0.04), Vector2(0.22, -0.03)])
	_mesh_at(root, brass, SM.get_mat("plaque_brass"), Transform3D(Basis.IDENTITY, Vector3(0, open_c, zf + 0.002)))
	# metal edge trim with rivets
	for yy in [y0 + 0.12, y1 - 0.62]:
		_block("sign_steel", Vector3(hw * 2.0 - 0.1, 0.12, 0.05), Vector3(0, yy, zf + 0.025))
		for k in 28:
			_add("plaque_brass", Transform3D(Basis.from_scale(Vector3(0.035, 0.035, 0.025)), Vector3(-6.75 + float(k) * 0.5, yy, zf + 0.055)), "sph")
	# ---- recessed face + neon layers
	var pz := zf - 0.395
	var quad := QuadMesh.new()
	quad.size = Vector2(open_w, open_h)
	_mesh_at(root, quad, SM.get_mat("marquee_panel"), Transform3D(Basis.IDENTITY, Vector3(0, open_c, pz)))
	_mesh_at(root, quad, SM.get_mat("neon_tube"), Transform3D(Basis.IDENTITY, Vector3(0, open_c, pz + 0.04)))
	_mesh_at(root, quad, SM.get_mat("neon_core"), Transform3D(Basis.IDENTITY, Vector3(0, open_c, pz + 0.07)))
	(SM.get_mat("marquee_panel") as ShaderMaterial).set_shader_parameter("psize", Vector2(open_w, open_h))
	_lv.resize(NG)
	_lv.fill(1.0)
	_fl_on = -1
	# stand-off clips: post + clamp at points along the tubes
	for c in TexData.CLIPS:
		var p := Vector3((c.x - 0.5) * open_w, open_c + (0.5 - c.y) * open_h, pz)
		_zcyl("neon_conduit", 0.007, 0.045, p + Vector3(0, 0, 0.0225))
		_zcyl("neon_conduit", 0.022, 0.014, p + Vector3(0, 0, 0.047))
		_add("neon_conduit", Transform3D(Basis.from_scale(Vector3(0.05, 0.012, 0.012)), p + Vector3(0, 0, 0.052)))
	# ---- chaser bulbs riding the steel band
	var band := 0.37
	var bw := open_w + band * 2.0
	var bh := open_h + band * 2.0
	var per := 2.0 * (bw + bh)
	var nb_b := int(per / 0.3)
	var bz := zf + 0.095
	var sph := SphereMesh.new()
	sph.radius = 1.0
	sph.height = 2.0
	sph.radial_segments = 12
	sph.rings = 6
	var hq := QuadMesh.new()
	hq.size = Vector2(1.0, 1.0)
	var bulb_xf: Array[Transform3D] = []
	var halo_xf: Array[Transform3D] = []
	var bulb_t := PackedFloat32Array()
	for k in nb_b:
		var d := per * float(k) / float(nb_b)
		var p := _loop_pos(d, bw, bh, 0.0, open_c, bz)
		bulb_xf.append(Transform3D(Basis.from_scale(Vector3(0.085, 0.085, 0.085)), p))
		halo_xf.append(Transform3D(Basis.from_scale(Vector3(0.6, 0.6, 0.6)), p + Vector3(0, 0, 0.02)))
		bulb_t.append(float(k) / float(nb_b))
		_zcyl("plaque_brass", 0.05, 0.05, p - Vector3(0, 0, 0.065))
	var bulb_mat := SM.get_mat("bulb_chaser") as ShaderMaterial
	bulb_mat.set_shader_parameter("count", float(nb_b) / 4.0)
	var halo_mat := SM.get_mat("sign_halo_chaser") as ShaderMaterial
	halo_mat.set_shader_parameter("count", float(nb_b) / 4.0)
	var bulb_mm := Architecture.color_mm(root, sph, bulb_mat, bulb_xf, 1.0)
	var halo_mm := Architecture.color_mm(root, hq, halo_mat, halo_xf, 1.0)
	for i in nb_b:
		bulb_mm.set_instance_color(i, Color(bulb_t[i], 0, 0))
		halo_mm.set_instance_color(i, Color(bulb_t[i], 0, 0))
	# ---- soffit: red enamel underside with a brass border and two rows of bulbs lighting the floor
	var sof_q := QuadMesh.new()
	sof_q.size = Vector2(hw * 2.0 - 0.4, 1.9)
	_mesh_at(root, sof_q, SM.get_mat("sign_soffit"), Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0, y0 - 0.025, zf - 1.15)))
	for sz in [zf - 0.2, zf - 2.05]:
		_block("plaque_brass", Vector3(hw * 2.0 - 0.3, 0.03, 0.07), Vector3(0, y0 - 0.035, sz))
	for sx in [-1.0, 1.0]:
		_block("plaque_brass", Vector3(0.07, 0.03, 1.9), Vector3(sx * (hw - 0.2), y0 - 0.035, zf - 1.15))
	var sof_xf: Array[Transform3D] = []
	var sof_halo: Array[Transform3D] = []
	var sof_t := PackedFloat32Array()
	for row in 2:
		for k in 23:
			var pp := Vector3(-6.6 + float(k) * 0.6, y0 - 0.1, zf - 0.8 - float(row) * 0.85)
			sof_xf.append(Transform3D(Basis.from_scale(Vector3(0.085, 0.085, 0.085)), pp))
			sof_halo.append(Transform3D(Basis.from_scale(Vector3(0.7, 0.7, 0.7)), pp - Vector3(0, 0.05, 0)))
			sof_t.append(float(k) / 23.0)
			_add("plaque_brass", Transform3D(Basis.from_scale(Vector3(0.05, 0.03, 0.05)), pp + Vector3(0, 0.085, 0)), "cyl")
	var sof_mat := SM.get_mat("bulb_soffit") as ShaderMaterial
	sof_mat.set_shader_parameter("count", 6.0)
	var sof_hmat := SM.get_mat("sign_halo_soffit") as ShaderMaterial
	sof_hmat.set_shader_parameter("count", 6.0)
	var sof_mm := Architecture.color_mm(root, sph, sof_mat, sof_xf, 1.0)
	var soh_mm := Architecture.color_mm(root, hq, sof_hmat, sof_halo, 1.0)
	for i in sof_xf.size():
		sof_mm.set_instance_color(i, Color(sof_t[i], 0, 0))
		soh_mm.set_instance_color(i, Color(sof_t[i], 0, 0))
	# ---- transformer on the side wall with conduit up into the header
	var tx := 6.72
	var tz := zf - 0.9
	_block("sign_steel", Vector3(0.28, 0.72, 0.5), Vector3(tx, 3.2, tz))
	_block("neon_conduit", Vector3(0.3, 0.05, 0.54), Vector3(tx, 3.58, tz))
	_block("neon_conduit", Vector3(0.3, 0.05, 0.54), Vector3(tx, 2.82, tz))
	for i in 5:
		_block("neon_conduit", Vector3(0.012, 0.3, 0.36), Vector3(tx - 0.145, 3.02 + float(i) * 0.04, tz))
	_add("neon_conduit", Transform3D(Basis.from_scale(Vector3(0.032, 0.9, 0.032)), Vector3(tx, 4.05, tz)), "cyl")
	for yy in [3.75, 4.3]:
		_add("sign_steel", Transform3D(Basis.from_scale(Vector3(0.055, 0.05, 0.055)), Vector3(tx, yy, tz)), "cyl")
	_add("neon_conduit", Transform3D(Basis(Vector3.FORWARD, PI * 0.5) * Basis.from_scale(Vector3(0.026, 0.5, 0.026)), Vector3(tx, 2.45, tz)), "cyl")
	_led_pos = Vector3(tx - 0.16, 3.4, tz)
	_add("neon_conduit", Transform3D(Basis.from_scale(Vector3(0.03, 0.03, 0.03)), _led_pos), "sph")


# ---------------------------------------------------------------- per-frame

static func _set_levels(v: PackedFloat32Array) -> void:
	for n in ["neon_tube", "neon_core", "marquee_panel"]:
		(SM.get_mat(n) as ShaderMaterial).set_shader_parameter("lv", v)


## Drive the marquee from the song clock: neon flicker, bulb chase, and its glow into the room.
static func update(clock: Clock, _focus: Dictionary) -> void:
	var beat := clock.beat
	var e := clock.e
	var kp := clock.kp
	var flash := clock.down if clock.is_drop else 0.0
	var fl := -1
	var fi := floorf(beat * 0.5)
	if Fixtures.hash01(fi * 3.7) > 0.8 and fposmod(beat * 0.5, 1.0) < 0.3:
		fl = int(Fixtures.hash01(fi + 7.0) * float(NG)) % NG
	var dimmed := fl >= 0 and fposmod(beat * 14.0, 1.0) < 0.5
	var want := fl if dimmed else -1
	if want != _fl_on:
		_fl_on = want
		_lv.fill(1.0)
		if _fl_on >= 0:
			_lv[_fl_on] = 0.15
		_set_levels(_lv)
	var lvl := 0.82 + 0.18 * e + 0.25 * flash
	for n in ["neon_tube", "neon_core", "marquee_panel"]:
		var m := SM.get_mat(n) as ShaderMaterial
		m.set_shader_parameter("level", lvl)
		m.set_shader_parameter("flash", flash)
	var spd := 0.5 if not clock.is_drop else 1.0
	var bl := 0.55 + 0.45 * e + 0.4 * flash
	for n in ["bulb_chaser", "sign_halo_chaser"]:
		var m := SM.get_mat(n) as ShaderMaterial
		m.set_shader_parameter("beat", beat)
		m.set_shader_parameter("level", bl)
		m.set_shader_parameter("speed", spd)
	for n in ["bulb_soffit", "sign_halo_soffit"]:
		var m := SM.get_mat(n) as ShaderMaterial
		m.set_shader_parameter("beat", beat)
		m.set_shader_parameter("level", 0.6 + 0.4 * e)
		m.set_shader_parameter("speed", -spd)
	var gl := 0.2 + 0.1 * kp * e + 0.35 * flash
	var red := Color(1.0, 0.1, 0.08)
	var mq := Layout.MQ_Z
	for i in 9:
		var xx := (float(i) / 8.0 - 0.5) * _sign_w
		Fixtures.glow_bb(Vector3(xx, _sign_y - 0.25, mq - 0.1), 3.2, red * gl)
	Fixtures.glow_bb(Vector3(0, _sign_y, mq + 0.4), 18.0, red * (gl * 0.35))
	Fixtures.glow_floor(Vector3(0, 0, mq + 2.5), 14.0, Color(1.0, 0.5, 0.3) * (0.1 + 0.08 * e))
	for k in 5:
		Fixtures.glow_floor(Vector3((float(k) - 2.0) * 2.8, 0, mq + 1.0), 3.6, red * (0.18 + 0.1 * kp * e))
	Fixtures.glow_bb(_led_pos, 0.25, Color(1.0, 0.1, 0.1) * 0.9)
