extends RefCounted
## Stage mirror ball: the faceted sphere (tiles and reflections are in shaders/stage_ball.gdshader),
## its hoist, the three spot beams that hit it, and the flecks it throws: for a sample of tiles
## lit by a spot, the reflected ray is intersected with the hall box and a small additive glow is
## drawn where it lands (walls, floor/deck, ceiling). Tiles turn with the ball so the flecks sweep.

const Layout := preload("res://scripts/layout.gd")
const Materials := preload("res://scripts/materials.gd")
const Architecture := preload("res://scripts/architecture.gd")
const Fixtures := preload("res://scripts/fixtures.gd")
const Clock := preload("res://scripts/clock.gd")
const Kit := preload("res://scripts/stage_kit.gd")

const RADIUS := 1.05
const ROWS := 18
const FLECK_MAX := 110
const SPOTS: Array[Vector3] = [Vector3(-3.8, 7.75, -109.4), Vector3(3.8, 7.75, -109.4), Vector3(0.0, 8.05, -105.7)]

static var node: MeshInstance3D
static var _mat: ShaderMaterial
static var center := Vector3(0.0, Layout.BALL_Y, Layout.BALL_Z)
static var _facets: Array[Vector3] = []
static var _fh: PackedFloat32Array = PackedFloat32Array()
static var _mm: MultiMesh
static var _buf := PackedFloat32Array()
static var fleck_cap: int = FLECK_MAX
static var flecks_drawn: int = 0


static func build(root: Node3D, mobile: bool) -> void:
	_facets.clear()
	_fh = PackedFloat32Array()
	var sm := SphereMesh.new()
	sm.radius = RADIUS
	sm.height = RADIUS * 2.0
	sm.radial_segments = 64
	sm.rings = 32
	_mat = ShaderMaterial.new()
	_mat.shader = load("res://shaders/stage_ball.gdshader")
	_mat.set_shader_parameter("rows", float(ROWS))
	node = Architecture.mi(root, sm, _mat, center)
	# hoist, rod and cap
	Kit.box("steel", Vector3(0.5, 0.4, 0.5), Vector3(0, 8.78, Layout.BALL_Z), Basis.IDENTITY, 1.0, 0.4)
	Kit.box("steel", Vector3(0.06, 8.6 - center.y - RADIUS, 0.06), Vector3(0, (8.6 + center.y + RADIUS) * 0.5, Layout.BALL_Z), Basis.IDENTITY, 1.0, 0.4)
	Kit.box("steel", Vector3(0.22, 0.12, 0.22), Vector3(0, center.y + RADIUS + 0.05, Layout.BALL_Z), Basis.IDENTITY, 1.0, 0.4)
	# the three pinspots that light it
	for s in SPOTS:
		var d := (center - s).normalized()
		Kit.box("steel", Vector3(0.26, 0.26, 0.4), s, Architecture.look(d), 1.0, 0.4)
		Kit.box("steel", Vector3(0.05, 0.4, 0.05), s + Vector3(0, 0.3, 0), Basis.IDENTITY)
	# tile list for the fleck rays (same layout as the shader)
	for ri in ROWS:
		var lat_c := (((float(ri) + 0.5) / float(ROWS)) - 0.5) * PI
		var cols := maxi(int(floor(2.0 * PI * cos(lat_c) / (PI / float(ROWS)) + 0.5)), 3)
		for ci in cols:
			var lon_c := (((float(ci) + 0.5) / float(cols)) - 0.5) * TAU
			var n := Vector3(cos(lat_c) * cos(lon_c), sin(lat_c), cos(lat_c) * sin(lon_c))
			var h := _hash(float(ci) * 3.1 + float(ri) * 17.3)
			var keep := 0.30 if mobile else 0.6
			if h < keep:
				_facets.append(n)
				_fh.append(h / keep)
	fleck_cap = 56 if mobile else FLECK_MAX
	# fleck MultiMesh: additive soft quads (the shared glow material)
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	_mm = MultiMesh.new()
	_mm.transform_format = MultiMesh.TRANSFORM_3D
	_mm.use_colors = true
	_mm.mesh = q
	_mm.instance_count = fleck_cap
	_mm.visible_instance_count = 0
	_buf.resize(fleck_cap * 16)
	var inst := MultiMeshInstance3D.new()
	inst.multimesh = _mm
	var fm := ShaderMaterial.new()
	fm.shader = load("res://shaders/stage_fleck.gdshader")
	inst.material_override = fm
	inst.custom_aabb = AABB(Vector3(-10, -2, -130), Vector3(20, 14, 40))
	inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(inst)


static func _hash(x: float) -> float:
	return fposmod(sin(x * 12.9898) * 43758.5453, 1.0)


## Hit of a ray from p along r with the hall box. Returns [point, normal, distance].
static func _hall_hit(p: Vector3, r: Vector3) -> Array:
	var t := 1e5
	var nrm := Vector3.ZERO
	if r.x > 0.001:
		t = (Layout.HALF_W - 0.05 - p.x) / r.x
		nrm = Vector3(-1, 0, 0)
	elif r.x < -0.001:
		t = (-Layout.HALF_W + 0.05 - p.x) / r.x
		nrm = Vector3(1, 0, 0)
	if r.y > 0.001:
		var ty := (Layout.WALL_H - 0.02 - p.y) / r.y
		if ty < t:
			t = ty
			nrm = Vector3(0, -1, 0)
	elif r.y < -0.001:
		var ty2 := (0.0 - p.y) / r.y
		if p.z + r.z * ty2 < Layout.ST_Z0:
			ty2 = (Layout.DECK_H - p.y) / r.y
		if ty2 < t:
			t = ty2
			nrm = Vector3(0, 1, 0)
	if r.z > 0.001:
		var tz := (Layout.HALL_Z0 - 0.1 - p.z) / r.z
		if tz < t:
			t = tz
			nrm = Vector3(0, 0, -1)
	elif r.z < -0.001:
		var tz2 := (Layout.ST_Z1 + 0.15 - p.z) / r.z
		if tz2 < t:
			t = tz2
			nrm = Vector3(0, 0, 1)
	return [p + r * t, nrm, t]


## Per frame. lvl: show level 0..1 for the ball (spots and flecks), shd: dictionary of clock
## values that the ball's shader needs to mirror the screen.
static func update(clock: Clock, lvl: float, shd: Dictionary, mobile: bool) -> void:
	var beat := clock.beat
	var ang := beat * 0.115
	node.rotation.y = ang
	var basis := Basis(Vector3.UP, ang)
	var si := PackedFloat32Array([0.0, 0.0, 0.0])
	var spos := PackedVector3Array(SPOTS)
	var pulse := 0.65 + 0.35 * clock.kp
	var drop_k := 1.0 if clock.is_drop else 0.55
	for k in 3:
		# the pinspots fade up and down in turn across the bar
		var ph := fposmod(clock.bar * 0.5 + float(k) / 3.0, 1.0)
		var seq := 0.5 + 0.5 * sin(ph * TAU)
		si[k] = clampf(lvl * (0.45 + 0.55 * seq) * pulse * drop_k, 0.0, 1.0)
	_mat.set_shader_parameter("spot_pos", spos)
	_mat.set_shader_parameter("spot_i", si)
	_mat.set_shader_parameter("lvl", lvl)
	for key in shd:
		_mat.set_shader_parameter(key, shd[key])
	# visible beams from each pinspot onto the ball, and a glow on the lens
	var col := Color(1.0, 0.1, 0.06)
	for k in 3:
		var o := SPOTS[k]
		var dv := center - o
		var l := dv.length()
		var d := dv / l
		var b := si[k]
		Fixtures.cone(o, d, l - RADIUS * 0.8, 0.55, col * (b * 0.25))
		Fixtures.cone(o, d, l - RADIUS * 0.8, 0.3, Color(1.0, 0.5, 0.4) * (b * 0.18))
		Fixtures.glow_bb(o + d * 0.25, 0.6, Color(1.0, 0.3, 0.2) * b)
	Fixtures.glow_bb(center, 5.0, Color(1.0, 0.08, 0.05) * (0.05 + 0.35 * lvl * clock.kp))
	# flecks
	var n := 0
	var cap := fleck_cap
	var white := Color(1.0, 0.55, 0.45)
	for i in _facets.size():
		if n >= cap:
			break
		var nw := basis * _facets[i]
		var p := center + nw * RADIUS
		var best := -1
		var bl := 0.1
		for k in 3:
			var lin := (p - SPOTS[k]).normalized()
			var lit := nw.dot(-lin)
			var w := lit * si[k]
			if w > bl:
				bl = w
				best = k
		if best < 0:
			continue
		var lin2 := (p - SPOTS[best]).normalized()
		var r := lin2 - nw * (2.0 * lin2.dot(nw))
		var hit := _hall_hit(p, r)
		var t: float = hit[2]
		if t > 46.0:
			continue
		var h: float = _fh[i]
		var tw := 0.55 + 0.45 * sin(beat * 3.0 + h * 40.0)
		var br := bl * tw / (1.0 + t * 0.045)
		if br < 0.025:
			continue
		var nrm: Vector3 = hit[1]
		var pos: Vector3 = hit[0] + nrm * 0.03
		var sz := 0.3 + 0.2 * h + t * 0.02
		var c := (col.lerp(white, 0.35 * h)) * (br * 9.0)
		var bs := Architecture.look(-nrm) * Basis.from_scale(Vector3(sz, sz, 1.0))
		_put(n, bs, pos, c)
		n += 1
	flecks_drawn = n
	_mm.buffer = _buf
	_mm.visible_instance_count = n


static func _put(i: int, b: Basis, o: Vector3, c: Color) -> void:
	var k := i * 16
	_buf[k] = b.x.x
	_buf[k + 1] = b.y.x
	_buf[k + 2] = b.z.x
	_buf[k + 3] = o.x
	_buf[k + 4] = b.x.y
	_buf[k + 5] = b.y.y
	_buf[k + 6] = b.z.y
	_buf[k + 7] = o.y
	_buf[k + 8] = b.x.z
	_buf[k + 9] = b.y.z
	_buf[k + 10] = b.z.z
	_buf[k + 11] = o.z
	_buf[k + 12] = c.r
	_buf[k + 13] = c.g
	_buf[k + 14] = c.b
	_buf[k + 15] = 1.0
