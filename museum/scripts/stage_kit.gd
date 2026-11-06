extends RefCounted
## Stage kit: the stage's own geometry batches and materials. Owns the blackened-steel and rubber
## box MultiMeshes (truss lattice, cases, cabinets), the LED cell MultiMesh whose colours stage.gd
## rewrites every frame, the box-truss builder, and the stage-only materials (solid, deck, screen,
## cells). Everything static is queued during build and turned into MultiMeshes by flush().

const Architecture := preload("res://scripts/architecture.gd")

const MAX_PX := 900

static var _xf: Dictionary = {}
static var _col: Dictionary = {}
static var _mats: Dictionary = {}
static var _px_xf: Array[Transform3D] = []
static var _px_buf := PackedFloat32Array()
static var _mm_px: MultiMesh
static var box_count: int = 0
static var truss_count: int = 0


static func reset() -> void:
	_xf = {"steel": [] as Array[Transform3D], "rubber": [] as Array[Transform3D]}
	_col = {"steel": [] as Array[Color], "rubber": [] as Array[Color]}
	_px_xf = []
	_px_buf = PackedFloat32Array()
	_px_buf.resize(MAX_PX * 16)
	box_count = 0
	truss_count = 0


## Queue a unit box transform. Instance colour = (albedo scale, roughness scale, metal scale).
static func add(kind: String, xf: Transform3D, tint: float = 1.0, rough: float = 0.5, metal: float = 1.0) -> void:
	var l: Array[Transform3D] = _xf[kind]
	l.append(xf)
	var c: Array[Color] = _col[kind]
	c.append(Color(tint, rough, metal, 1.0))
	box_count += 1


static func box(kind: String, size: Vector3, pos: Vector3, rot: Basis = Basis.IDENTITY, tint: float = 1.0, rough: float = 0.5, metal: float = 1.0) -> void:
	add(kind, Transform3D(rot * Basis.from_scale(size), pos), tint, rough, metal)


## A thin square member from p to q.
static func bar(p: Vector3, q: Vector3, th: float, kind: String = "steel", tint: float = 1.0) -> void:
	var d := q - p
	var l := d.length()
	if l < 0.001:
		return
	add(kind, Transform3D(Architecture.look(d / l) * Basis.from_scale(Vector3(th, th, l)), (p + q) * 0.5), tint, 0.45, 1.0)


## Box truss from a to b: four chords and zig-zag diagonals on all four faces. hw is the half
## width, hh the half height (the frame is built from the segment direction and world up).
static func truss(a: Vector3, b: Vector3, hw: float, hh: float, bay: float = 0.5, th: float = 0.045) -> void:
	var d := b - a
	var l := d.length()
	if l < 0.01:
		return
	var u := d / l
	var s := u.cross(Vector3.UP)
	if s.length() < 0.2:
		s = u.cross(Vector3.RIGHT)
	s = s.normalized()
	var v := s.cross(u).normalized()
	var corners: Array[Vector3] = [s * hw + v * hh, s * hw - v * hh, -s * hw - v * hh, -s * hw + v * hh]
	for c in corners:
		bar(a + c, b + c, th * 1.5)
	var n := maxi(1, int(round(l / bay)))
	var st := l / float(n)
	for k in n:
		var p0 := a + u * (st * float(k))
		var p1 := a + u * (st * float(k + 1))
		for f in 4:
			var c1: Vector3 = corners[f]
			var c2: Vector3 = corners[(f + 1) % 4]
			if k % 2 == 1:
				var tmp := c1
				c1 = c2
				c2 = tmp
			bar(p0 + c1, p1 + c2, th)
	truss_count += 1


## One LED cell: a quad of size w x h at pos facing the unit vector n. Returns its index.
static func px(pos: Vector3, w: float, h: float, n: Vector3 = Vector3(0, 0, 1), roll: float = 0.0) -> int:
	var i := _px_xf.size()
	if i >= MAX_PX:
		return MAX_PX - 1
	var bs := Basis.looking_at(-n, Vector3.UP if absf(n.y) < 0.97 else Vector3.RIGHT)
	_px_xf.append(Transform3D(bs * Basis(Vector3(0, 0, 1), roll) * Basis.from_scale(Vector3(w, h, 1.0)), pos))
	var xf := _px_xf[i]
	_put_xf(i, xf)
	return i


static func _put_xf(i: int, xf: Transform3D) -> void:
	var b := xf.basis
	var o := xf.origin
	var k := i * 16
	_px_buf[k] = b.x.x
	_px_buf[k + 1] = b.y.x
	_px_buf[k + 2] = b.z.x
	_px_buf[k + 3] = o.x
	_px_buf[k + 4] = b.x.y
	_px_buf[k + 5] = b.y.y
	_px_buf[k + 6] = b.z.y
	_px_buf[k + 7] = o.y
	_px_buf[k + 8] = b.x.z
	_px_buf[k + 9] = b.y.z
	_px_buf[k + 10] = b.z.z
	_px_buf[k + 11] = o.z


static func px_count() -> int:
	return _px_xf.size()


static func px_set(i: int, c: Color) -> void:
	var k := i * 16
	_px_buf[k + 12] = c.r
	_px_buf[k + 13] = c.g
	_px_buf[k + 14] = c.b
	_px_buf[k + 15] = 1.0


static func px_flush() -> void:
	_mm_px.buffer = _px_buf


## Turn the queued batches into MultiMeshInstance3Ds under root.
static func flush(root: Node3D) -> void:
	for kind in ["steel", "rubber"]:
		var xfs: Array[Transform3D] = _xf[kind]
		var cols: Array[Color] = _col[kind]
		if xfs.is_empty():
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.mesh = Architecture.box(Vector3.ONE)
		mm.instance_count = xfs.size()
		for i in xfs.size():
			mm.set_instance_transform(i, xfs[i])
			mm.set_instance_color(i, cols[i])
		_inst(root, mm, solid(kind))
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	_mm_px = MultiMesh.new()
	_mm_px.transform_format = MultiMesh.TRANSFORM_3D
	_mm_px.use_colors = true
	_mm_px.mesh = q
	_mm_px.instance_count = _px_xf.size()
	_px_buf = _px_buf.slice(0, _px_xf.size() * 16)
	_mm_px.buffer = _px_buf
	_inst(root, _mm_px, px_mat())
	_xf = {}
	_col = {}


static func _inst(root: Node3D, mm: MultiMesh, mat: Material) -> MultiMeshInstance3D:
	var inst := MultiMeshInstance3D.new()
	inst.multimesh = mm
	inst.material_override = mat
	inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	inst.custom_aabb = AABB(Vector3(-10, -2, -130), Vector3(20, 14, 40))
	root.add_child(inst)
	return inst


# ---------------------------------------------------------------- materials

static func _tex(set_name: String, map: String) -> Texture2D:
	return load("res://assets/textures/%s/%s.jpg" % [set_name, map])


static func solid(kind: String) -> ShaderMaterial:
	var key := "solid_" + kind
	if not _mats.has(key):
		var m := ShaderMaterial.new()
		m.shader = load("res://shaders/stage_solid.gdshader")
		var set_name := "steel_black" if kind == "steel" else "rubber_black"
		m.set_shader_parameter("albedo_tex", _tex(set_name, "albedo"))
		m.set_shader_parameter("normal_tex", _tex(set_name, "normal"))
		m.set_shader_parameter("rough_tex", _tex(set_name, "roughness"))
		m.set_shader_parameter("tex_scale", 0.9 if kind == "steel" else 0.7)
		m.set_shader_parameter("metal", 0.85 if kind == "steel" else 0.0)
		m.set_shader_parameter("albedo_gain", 0.55 if kind == "steel" else 1.6)
		_mats[key] = m
	return _mats[key]


static func deck_mat() -> ShaderMaterial:
	if not _mats.has("deck"):
		var m := ShaderMaterial.new()
		m.shader = load("res://shaders/stage_deck.gdshader")
		m.set_shader_parameter("albedo_tex", _tex("stage_deck", "albedo"))
		m.set_shader_parameter("normal_tex", _tex("stage_deck", "normal"))
		m.set_shader_parameter("rough_tex", _tex("stage_deck", "roughness"))
		_mats["deck"] = m
	return _mats["deck"]


static func screen_mat(name: String, res: Vector2) -> ShaderMaterial:
	if not _mats.has(name):
		var m := ShaderMaterial.new()
		m.shader = load("res://shaders/stage_screen.gdshader")
		m.set_shader_parameter("res", res)
		_mats[name] = m
	return _mats[name]


static func px_mat() -> ShaderMaterial:
	if not _mats.has("px"):
		var m := ShaderMaterial.new()
		m.shader = load("res://shaders/stage_px.gdshader")
		_mats["px"] = m
	return _mats["px"]


## Push the show's current clock values into every stage shader that draws the screen pattern.
static func set_screen_params(p: Dictionary) -> void:
	for name in ["screen", "booth"]:
		var m := _mats.get(name) as ShaderMaterial
		if m == null:
			continue
		for k in p:
			m.set_shader_parameter(k, p[k])
	var d := _mats.get("deck") as ShaderMaterial
	if d != null:
		for k in p:
			d.set_shader_parameter(k, p[k])


static func set_rig(v: float) -> void:
	for kind in ["steel", "rubber"]:
		var m := _mats.get("solid_" + kind) as ShaderMaterial
		if m != null:
			m.set_shader_parameter("rig", v)
	var d := _mats.get("deck") as ShaderMaterial
	if d != null:
		d.set_shader_parameter("rig", v)
