extends RefCounted
## Fixtures: lighting hardware. Owns the truss, the fixture bodies, the art-light registry, the
## four batched additive MultiMeshes (glow sprites for pools / washes / flares / floor
## reflections, beam cones, laser ribbons, and the lit fixture bodies) and the room-flash light.
## Everything dynamic goes through the setters below; call begin() at frame start and flush() at
## the end. No logic about *when* a fixture is on: that is show.gd and stage.gd.
##
## Setters (all positions world space, colour = colour * intensity, may exceed 1.0):
##   glow_bb(pos, size, c)        lens flare / halo sprite facing the camera. Also mirrors itself on
##                                the glossy floor (a vertical streak at the reflected position),
##                                and a white-hot one near the camera feeds the room-flash light.
##   glow_floor(pos, size, c)     soft pool on the floor/deck (auto reflection streak)
##   glow_wall(pos, side, w, h,c) soft wash on a side wall (side -1 left, +1 right)
##   wash_up(pos, side, w, h, c)  uplight scallop on a wall, bright at pos (its bottom edge)
##   streak(pos, w, l, c)         floor reflection streak running from pos toward the camera
##   cone(o, d, len, r, c)        haze beam: hot core at the lens, soft edge, scrolling noise
##   stick(o, d, len, w, c)       laser: pixel-sized core + glow + haze sheet, hit glow at the end
##   head(o, d, lens, sc)         lit moving-head / profile-spot body pivoting at o, lens glow colour

const Layout := preload("res://scripts/layout.gd")
const Materials := preload("res://scripts/materials.gd")
const Architecture := preload("res://scripts/architecture.gd")
const Post := preload("res://scripts/post.gd")
const Lite := preload("res://scripts/lite.gd")

## the room flash: strobes and blinders light the hall in this colour (see lite.gd)
const FLASH_COLOR := Color(1.0, 0.3, 0.26)

## While the shaders are being warmed (warm.gd) every dynamic batch draws at least one instance,
## so its shader compiles even if the show has nothing on screen yet.
static var warm_min: int = 0

const MAX_G := 1600
const MAX_C := 240
const MAX_S := 160
const MAX_H := 200

## sprite kinds, stored in the instance colour alpha (see glow.gdshader)
const K_SOFT := 0.0
const K_FLARE := 1.0
const K_STREAK := 2.0
const K_WASH := 3.0

static var _mm_g: MultiMesh
static var _mm_c: MultiMesh
static var _mm_s: MultiMesh
static var _mm_h: MultiMesh
static var _bg := PackedFloat32Array()
static var _bc := PackedFloat32Array()
static var _bs := PackedFloat32Array()
static var _bh := PackedFloat32Array()
static var _g: int = 0
static var _c: int = 0
static var _s: int = 0
static var _h: int = 0
static var _cam_basis := Basis.IDENTITY
static var _cam_pos := Vector3.ZERO
static var _art_src: Array[Vector3] = []
static var _art_tgt: Array[Vector3] = []
static var _art_by_bay: Array = []
static var _flash: float = 0.0
static var _can_body: Array[Transform3D] = []
static var _can_base: Array[Transform3D] = []


# ---------------------------------------------------------------- build

## Truss over each bay, floor uplight cans, blinder housings, the long rails, the dynamic
## MultiMeshes and the room-flash light.
static func build(root: Node3D, n_bays: int) -> void:
	_art_src.clear()
	_art_tgt.clear()
	_art_by_bay.clear()
	for b in n_bays:
		_art_by_bay.append([])
	var hw := Layout.HALF_W
	for b in n_bays:
		var z := Layout.bay_z(b)
		for dz in [-0.6, 0.6]:
			Architecture.block("truss", Vector3(hw * 2.0, 0.28, 0.28), Vector3(0, Layout.TRUSS_Y + 0.5, z + dz))
		for sx in [-1.0, 1.0]:
			# blinder housings hung from the ceiling near the walls
			Architecture.block("truss", Vector3(0.7, 0.3, 0.28), Vector3(sx * 5.8, 7.2, z))
			Architecture.block("truss", Vector3(0.04, Layout.WALL_H - 7.35, 0.04), Vector3(sx * 5.8, (Layout.WALL_H + 7.35) * 0.5, z))
			for sz in [-1.0, 1.0]:
				# par can: base plate and a can angled up at the wall
				var pz: float = z + sz * 2.6
				_can_base.append(Transform3D(Basis.from_scale(Vector3(0.46, 0.06, 0.4)), Vector3(sx * 6.25, 0.03, pz)))
				_can_base.append(Transform3D(Basis.from_scale(Vector3(0.2, 0.1, 0.3)), Vector3(sx * 6.2, 0.1, pz)))
				_can_body.append(Architecture.tube_xf(Vector3(sx * 6.17, 0.13, pz), Vector3(sx * 6.52, 0.52, pz), 0.14))
	_build_cans(root)
	var hall_len := Layout.HALL_Z0 - Layout.HALL_Z1
	for sx in [-3.6, 3.6]:
		Architecture.block("truss", Vector3(0.28, 0.28, hall_len), Vector3(sx, Layout.TRUSS_Y + 0.5, (Layout.HALL_Z0 + Layout.HALL_Z1) * 0.5))
	_build_dynamic(root)


## Floor-standing LED wash cans in blackened steel (the steel_black scan), tilted up at the wall.
## Their lens glow and the uplight scallop above them are drawn by Show.
static func _build_cans(root: Node3D) -> void:
	var m := Materials.pbr("steel_black", {"uv_scale": 1.5, "tint": Color(0.3, 0.3, 0.32), "roughness_mult": 0.9, "metallic": 0.85})
	var cyl := CylinderMesh.new()
	cyl.top_radius = 1.0
	cyl.bottom_radius = 0.8
	cyl.height = 1.0
	cyl.radial_segments = 14
	cyl.rings = 1
	Architecture.color_mm(root, cyl, m, _can_body, 1.0)
	Architecture.color_mm(root, Architecture.box(Vector3.ONE), m, _can_base, 1.0)
	_can_body = []
	_can_base = []


## Register a spot aimed at a picture. The body is a profile spot drawn each frame by Show with
## head(); this adds the static clamp that holds it on the rail.
static func add_art_light(b: int, src: Vector3, tgt: Vector3) -> void:
	_art_by_bay[b].append(_art_src.size())
	_art_src.append(src)
	_art_tgt.append(tgt)
	Architecture.block("truss", Vector3(0.16, 0.1, 0.16), Vector3(src.x, Layout.TRUSS_Y + 0.34, src.z))


## Indices of bay b's art lights; read them with art_src(i) / art_tgt(i).
static func art_lights(b: int) -> Array:
	return _art_by_bay[b]


static func art_src(i: int) -> Vector3:
	return _art_src[i]


static func art_tgt(i: int) -> Vector3:
	return _art_tgt[i]


static func _build_dynamic(root: Node3D) -> void:
	var mobile := Post.tier == Post.Tier.MOBILE
	var glow_q := QuadMesh.new()
	glow_q.size = Vector2.ONE
	var gm := Materials.get_mat("beam_glow") as ShaderMaterial
	gm.set_shader_parameter("halo_boost", 2.3 if mobile else 1.0)
	_mm_g = _dyn_mm(root, glow_q, gm, MAX_G)
	var cone := CylinderMesh.new()
	cone.top_radius = 0.03
	cone.bottom_radius = 1.0
	cone.height = 1.0
	cone.radial_segments = 16
	cone.rings = 1
	cone.cap_top = false
	cone.cap_bottom = false
	var cm := Materials.get_mat("beam_cone") as ShaderMaterial
	cm.set_shader_parameter("noise_oct", 1 if mobile else 2)
	_mm_c = _dyn_mm(root, cone, cm, MAX_C)
	_mm_s = _dyn_mm(root, _ribbon_mesh(), Materials.get_mat("laser_stick"), MAX_S)
	var hmat := ShaderMaterial.new()
	hmat.shader = load("res://shaders/light_head.gdshader")
	_mm_h = _dyn_mm(root, _head_mesh(), hmat, MAX_H)
	_bg.resize(MAX_G * 16)
	_bc.resize(MAX_C * 16)
	_bs.resize(MAX_S * 16)
	_bh.resize(MAX_H * 16)


static func _dyn_mm(root: Node3D, mesh: Mesh, mat: Material, cnt: int) -> MultiMesh:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = cnt
	mm.visible_instance_count = 0
	var inst := MultiMeshInstance3D.new()
	inst.multimesh = mm
	inst.material_override = mat
	inst.custom_aabb = AABB(Vector3(-100, -20, -300), Vector3(200, 60, 400))
	inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(inst)
	return mm


# ---------------------------------------------------------------- meshes

## Flat unit ribbon in XZ for lasers; the vertex shader turns it to face the camera.
static func _ribbon_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var ps := [Vector3(-0.5, 0, -0.5), Vector3(0.5, 0, -0.5), Vector3(0.5, 0, 0.5), Vector3(-0.5, 0, 0.5)]
	for i in [0, 1, 2, 0, 2, 3]:
		var p: Vector3 = ps[i]
		st.set_normal(Vector3.UP)
		st.set_uv(Vector2(p.x + 0.5, p.z + 0.5))
		st.add_vertex(p)
	return st.commit()


static func _tri(st: SurfaceTool, ps: Array, ns: Array, uv: Vector2, i0: int, i1: int, i2: int) -> void:
	var a: Vector3 = ps[i0]
	var b: Vector3 = ps[i1]
	var c: Vector3 = ps[i2]
	var out: Vector3 = (ns[i0] as Vector3) + (ns[i1] as Vector3) + (ns[i2] as Vector3)
	var order := [i0, i1, i2]
	# front faces are clockwise: the geometric normal must point away from the outside
	if (b - a).cross(c - a).dot(out) > 0.0:
		order = [i0, i2, i1]
	for i in order:
		st.set_normal(ns[i])
		st.set_uv(uv)
		st.add_vertex(ps[i])


static func _box_into(st: SurfaceTool, ctr: Vector3, sz: Vector3, uv: Vector2) -> void:
	var h := sz * 0.5
	for ax in 3:
		for sg in [-1.0, 1.0]:
			var n := Vector3.ZERO
			n[ax] = sg
			var u := Vector3.ZERO
			u[(ax + 1) % 3] = 1.0
			var v := n.cross(u)
			var ps := []
			var ns := []
			for q in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
				var p: Vector3 = ctr + n * h[ax] + u * (q.x * h[(ax + 1) % 3]) + v * (q.y * h[(ax + 2) % 3])
				ps.append(p)
				ns.append(n)
			_tri(st, ps, ns, uv, 0, 1, 2)
			_tri(st, ps, ns, uv, 0, 2, 3)


static func _disc_into(st: SurfaceTool, z: float, r: float, nz: float, uv: Vector2, seg: int, r_in: float = 0.0) -> void:
	for i in seg:
		var a0 := TAU * float(i) / float(seg)
		var a1 := TAU * float(i + 1) / float(seg)
		var n := Vector3(0, 0, nz)
		var ps := [Vector3(cos(a0) * r, sin(a0) * r, z), Vector3(cos(a1) * r, sin(a1) * r, z), Vector3(cos(a1) * r_in, sin(a1) * r_in, z), Vector3(cos(a0) * r_in, sin(a0) * r_in, z)]
		var ns := [n, n, n, n]
		_tri(st, ps, ns, uv, 0, 1, 2)
		if r_in > 0.0:
			_tri(st, ps, ns, uv, 0, 2, 3)


## Head: barrel along Z (front, the lens, at -Z), rear cap, lens disc (UV.y = 1) and yoke + stem
## (UV.x = 1, drawn in a yaw-only frame by light_head.gdshader). About 0.6 m long.
static func _head_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := [Vector2(0.3, 0.11), Vector2(0.22, 0.14), Vector2(0.0, 0.15), Vector2(-0.2, 0.16), Vector2(-0.26, 0.2), Vector2(-0.3, 0.2)]
	var seg := 10
	for k in rings.size() - 1:
		var r0: Vector2 = rings[k]
		var r1: Vector2 = rings[k + 1]
		for i in seg:
			var a0 := TAU * float(i) / float(seg)
			var a1 := TAU * float(i + 1) / float(seg)
			var ps := [Vector3(cos(a0) * r0.y, sin(a0) * r0.y, r0.x), Vector3(cos(a1) * r0.y, sin(a1) * r0.y, r0.x), Vector3(cos(a1) * r1.y, sin(a1) * r1.y, r1.x), Vector3(cos(a0) * r1.y, sin(a0) * r1.y, r1.x)]
			var ns := [Vector3(cos(a0), sin(a0), 0), Vector3(cos(a1), sin(a1), 0), Vector3(cos(a1), sin(a1), 0), Vector3(cos(a0), sin(a0), 0)]
			_tri(st, ps, ns, Vector2.ZERO, 0, 1, 2)
			_tri(st, ps, ns, Vector2.ZERO, 0, 2, 3)
	_disc_into(st, 0.3, 0.11, 1.0, Vector2.ZERO, seg)
	_disc_into(st, -0.3, 0.2, -1.0, Vector2.ZERO, seg, 0.15)
	_disc_into(st, -0.296, 0.15, -1.0, Vector2(0, 1), seg)
	for sx in [-1.0, 1.0]:
		_box_into(st, Vector3(sx * 0.215, 0.07, 0.0), Vector3(0.05, 0.5, 0.12), Vector2(1, 0))
	_box_into(st, Vector3(0, 0.33, 0), Vector3(0.48, 0.05, 0.12), Vector2(1, 0))
	_box_into(st, Vector3(0, 0.46, 0), Vector3(0.07, 0.22, 0.07), Vector2(1, 0))
	return st.commit()


# ---------------------------------------------------------------- per-frame setters

## Start a frame: reset the instance counters. Billboards face the camera basis; reflections
## are computed for the camera position.
static func begin(cam_basis: Basis, cam_pos: Vector3) -> void:
	_cam_basis = cam_basis
	_cam_pos = cam_pos
	_g = 0
	_c = 0
	_s = 0
	_h = 0
	_flash = 0.0


## Upload this frame's instances and fire the room-flash light.
static func flush() -> void:
	_mm_g.buffer = _bg
	_mm_g.visible_instance_count = maxi(_g, warm_min)
	_mm_c.buffer = _bc
	_mm_c.visible_instance_count = maxi(_c, warm_min)
	_mm_s.buffer = _bs
	_mm_s.visible_instance_count = maxi(_s, warm_min)
	_mm_h.buffer = _bh
	_mm_h.visible_instance_count = maxi(_h, warm_min)
	Lite.omni(_cam_pos + Vector3(0, 1.2, 0), FLASH_COLOR, clampf(_flash, 0.0, 1.0) * 2.4)


## Add to this frame's room flash (0..1); strobes and blinders in glow_bb do it automatically.
static func flash(v: float) -> void:
	_flash = maxf(_flash, v)


static func _put(buf: PackedFloat32Array, i: int, b: Basis, o: Vector3, c: Color, kind: float = 0.0) -> void:
	var k := i * 16
	buf[k] = b.x.x
	buf[k + 1] = b.y.x
	buf[k + 2] = b.z.x
	buf[k + 3] = o.x
	buf[k + 4] = b.x.y
	buf[k + 5] = b.y.y
	buf[k + 6] = b.z.y
	buf[k + 7] = o.y
	buf[k + 8] = b.x.z
	buf[k + 9] = b.y.z
	buf[k + 10] = b.z.z
	buf[k + 11] = o.z
	buf[k + 12] = c.r
	buf[k + 13] = c.g
	buf[k + 14] = c.b
	buf[k + 15] = kind


static func _dim(c: Color) -> bool:
	return c.r + c.g + c.b < 0.03


## Camera-facing glow sprite (flare, bulb halo, blinder). Small and medium ones are lens flares
## with a hot core; very large ones are soft washes of light.
static func glow_bb(pos: Vector3, size: float, c: Color) -> void:
	if _g >= MAX_G or _dim(c):
		return
	var kind := K_FLARE if size <= 6.0 else K_SOFT
	_put(_bg, _g, _cam_basis * Basis.from_scale(Vector3(size, size, 1.0)), pos, c, kind)
	_g += 1
	var m := maxf(c.r, maxf(c.g, c.b))
	# a white-hot blinder or strobe near the camera throws the whole room a flash
	if size >= 1.0 and size <= 6.0 and m > 0.5 and c.g > c.r * 0.3:
		var dd := pos.distance_to(_cam_pos)
		_flash = maxf(_flash, minf(m, 1.6) * 0.55 / (1.0 + dd * dd / 180.0))
	# its mirror image in the glossy floor
	if pos.y > 0.5 and size <= 6.0 and m > 0.35 and size >= 0.4:
		_reflect(pos, size, c, m)


## Reflection of a source at height h: the floor point is where the sight line to the mirrored
## source (x, -h, z) crosses the floor. It reads as a vertical streak below the light.
static func _reflect(pos: Vector3, size: float, c: Color, m: float) -> void:
	var cy := maxf(_cam_pos.y, 0.5)
	var t := cy / (cy + pos.y)
	var fx := _cam_pos.x + (pos.x - _cam_pos.x) * t
	var fz := _cam_pos.z + (pos.z - _cam_pos.z) * t
	if absf(fx) > Layout.HALF_W - 0.1 or fz > Layout.HALL_Z0 or fz < Layout.HALL_Z1:
		return
	var w := maxf(size * t * 1.1, 0.12)
	var fade := 1.0 / (1.0 + pos.y * 0.07)
	streak(Vector3(fx, 0.0, fz), w, w * 8.0 + 0.6, c * (0.42 * fade))


## Soft pool lying on the floor (or deck) at pos, with its reflection streak.
static func glow_floor(pos: Vector3, size: float, c: Color) -> void:
	if _g >= MAX_G or _dim(c):
		return
	var fp := Vector3(pos.x, maxf(pos.y, 0.0) + 0.03, pos.z)
	_put(_bg, _g, Basis(Vector3.RIGHT, -PI * 0.5) * Basis.from_scale(Vector3(size, size, 1.0)), fp, c, K_SOFT)
	_g += 1
	var m := maxf(c.r, maxf(c.g, c.b))
	if size < 12.0 and m > 0.12:
		streak(fp, size * 0.22, size * 1.6, c * 0.5)


## Wash on a side wall (side = -1 left, +1 right), w x h, facing into the hall.
static func glow_wall(pos: Vector3, side: float, w: float, h: float, c: Color) -> void:
	if _g >= MAX_G or _dim(c):
		return
	_put(_bg, _g, Basis(Vector3.UP, -side * PI * 0.5) * Basis.from_scale(Vector3(w, h, 1.0)), pos, c, K_SOFT)
	_g += 1


## Uplight scallop on a side wall: pos is the bottom-centre of the wash, h is its height.
static func wash_up(pos: Vector3, side: float, w: float, h: float, c: Color) -> void:
	if _g >= MAX_G or _dim(c):
		return
	_put(_bg, _g, Basis(Vector3.UP, -side * PI * 0.5) * Basis.from_scale(Vector3(w, h, 1.0)), pos + Vector3(0, h * 0.5, 0), c, K_WASH)
	_g += 1


## Fake floor reflection: a streak that starts at the hit point and runs toward the camera
## (so it reads as a vertical smear on screen), fading as the polished floor blurs it.
static func streak(pos: Vector3, w: float, l: float, c: Color) -> void:
	if _g >= MAX_G or _dim(c):
		return
	var dv := Vector2(_cam_pos.x - pos.x, _cam_pos.z - pos.z)
	if dv.length() < 0.5:
		return
	dv = dv.normalized()
	var phi := atan2(-dv.x, -dv.y)
	var b := Basis(Vector3.UP, phi) * Basis(Vector3.RIGHT, -PI * 0.5) * Basis.from_scale(Vector3(w, l, 1.0))
	_put(_bg, _g, b, Vector3(pos.x + dv.x * l * 0.44, 0.035, pos.z + dv.y * l * 0.44), c, K_STREAK)
	_g += 1


## Haze beam from o along d, length len, radius r at the far end.
static func cone(o: Vector3, d: Vector3, len_m: float, r: float, c: Color) -> void:
	if _c >= MAX_C or _dim(c):
		return
	var b := Architecture.look(d) * Basis(Vector3.RIGHT, PI * 0.5) * Basis.from_scale(Vector3(r, len_m, r))
	_put(_bc, _c, b, o + d * (len_m * 0.5), c)
	_c += 1


## Laser from o along d, length len, nominal width w (the core is never thinner than a pixel).
## Where it ends on the floor or a side wall it leaves a hot spot (and a floor reflection).
static func stick(o: Vector3, d: Vector3, len_m: float, w: float, c: Color) -> void:
	if _s >= MAX_S or _dim(c) or len_m < 0.1:
		return
	_put(_bs, _s, Architecture.look(d) * Basis.from_scale(Vector3(w, w, len_m)), o + d * (len_m * 0.5), c)
	_s += 1
	var e := o + d * len_m
	if e.y < 0.1:
		glow_floor(Vector3(e.x, 0.0, e.z), 1.1, c * 0.8)
	elif absf(e.x) > Layout.HALF_W - 0.2:
		var sd := signf(e.x)
		glow_wall(Vector3(sd * 6.93, e.y, e.z), sd, 1.0, 1.0, c * 1.1)


## Moving-head / profile-spot body pivoting at o, aimed along d. lens is the lens glow colour
## (colour * level), sc scales the whole fixture.
static func head(o: Vector3, d: Vector3, lens: Color = Color.BLACK, sc: float = 1.0) -> void:
	if _h >= MAX_H:
		return
	_put(_bh, _h, Architecture.look(d) * Basis.from_scale(Vector3(sc, sc, sc)), o, lens)
	_h += 1


# ---------------------------------------------------------------- shared show helpers

static func hash01(x: float) -> float:
	return fposmod(sin(x * 12.9898) * 43758.5453, 1.0)


## Shades of red, crimson to hot red, cycling with h.
static func rainbow(h: float) -> Color:
	var k := 0.5 + 0.5 * sin(h * TAU * 2.0)
	return Color.from_hsv(fposmod(lerpf(0.985, 1.0, k), 1.0), 0.95, lerpf(0.6, 1.0, k))
