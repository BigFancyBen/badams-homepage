extends RefCounted
## Architecture: the hall's static shell and the shared static-geometry helpers. Owns the floor,
## walls, coffered ceiling, fluted columns and pilasters, skirting / wainscot / dado / picture rail /
## cornice mouldings, picture frames with mat boards, plinths with plaque stands, turned brass
## stanchions with catenary velvet ropes, the soft contact-shadow quads, plus the static batch
## registry every other module adds boxes to (Architecture.add / block). Architecture.flush()
## turns the registry and all merged architecture meshes into a handful of draw calls.
## Mesh construction lives in arch_mesh.gd (bevelled boxes, swept profiles, lathes, tubes).
##
## Public API (unchanged): build, flush, add, block, mi, box, look, pl, tube_xf, color_mm, frame,
## plinth, stanchions. New: contact_rect / contact_disc (soft multiply shadows, usable by anyone
## before flush), stat_tris (triangle count of everything this module made, valid after flush).

const Layout := preload("res://scripts/layout.gd")
const Materials := preload("res://scripts/materials.gd")
const ArchMesh := preload("res://scripts/arch_mesh.gd")

## Preview only: build the surfaces from the CC0 scans in assets/textures instead of
## Materials.get_mat, and drop a few test lights in so profiles catch highlights. Remove with
## arch_preview_mat() once Materials.pbr is wired in.
const PREVIEW_SCANS := false
const PREVIEW_LIGHTS := false

const CEIL_Y := Layout.WALL_H + 0.22
const WALL_FACE := 7.0
const COL_X := 6.5
const MAT_B := 0.09          # mat board border around a picture
const DADO_Y := 1.12
const PANEL_Y0 := 1.6
const PANEL_Y1 := 5.5
const RAIL_Y := 5.8

# key "kind|material" -> {"kind", "mat", "xfs"}
static var _batches: Dictionary = {}
static var _meshes: Dictionary = {}
static var _merged: Dictionary = {}     # material name -> ArchMesh (world space, vertex AO baked)
static var _contact: ArchMesh
static var _vcol: Dictionary = {}
static var _preview: Dictionary = {}
static var stat_tris: int = 0
static var stat_draws: int = 0


# ---------------------------------------------------------------- shared helpers

static func box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


## One MeshInstance3D (no shadows) with a material, parented to root.
static func mi(root: Node3D, mesh: Mesh, mat: Material, pos: Vector3) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = mat
	m.position = pos
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(m)
	return m


static func look(d: Vector3) -> Basis:
	var up := Vector3.UP if absf(d.y) < 0.97 else Vector3.RIGHT
	return Basis.looking_at(d, up)


## Local-frame transform: rot * scale, at org + rot * local.
static func pl(rot: Basis, org: Vector3, local: Vector3, sc: Vector3) -> Transform3D:
	return Transform3D(rot * Basis.from_scale(sc), org + rot * local)


## A unit cylinder along Y from a to b with radius r.
static func tube_xf(a: Vector3, b: Vector3, r: float) -> Transform3D:
	var dv := b - a
	var l := maxf(dv.length(), 0.001)
	return Transform3D(look(dv / l) * Basis(Vector3.RIGHT, PI * 0.5) * Basis.from_scale(Vector3(r, l, r)), (a + b) * 0.5)


## A MultiMesh of unit meshes with per-instance colour (all set to grey v), parented to root.
static func color_mm(root: Node3D, mesh: Mesh, mat: Material, xfs: Array[Transform3D], v: float) -> MultiMesh:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = xfs.size()
	for i in xfs.size():
		mm.set_instance_transform(i, xfs[i])
		mm.set_instance_color(i, Color(v, v, v))
	var inst := MultiMeshInstance3D.new()
	inst.multimesh = mm
	inst.material_override = mat
	inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(inst)
	return mm


# ---------------------------------------------------------------- materials

## The surface for a role name. Vertex colour (baked AO) is switched on for StandardMaterial3D
## surfaces, on a cached duplicate, so whatever the material library provides keeps working.
static func _surface(mat_name: String) -> Material:
	if _vcol.has(mat_name):
		return _vcol[mat_name]
	var m: Material = arch_preview_mat(mat_name) if PREVIEW_SCANS else Materials.get_mat(mat_name)
	if m is StandardMaterial3D:
		var d: StandardMaterial3D = (m as StandardMaterial3D).duplicate()
		d.vertex_color_use_as_albedo = true
		m = d
	_vcol[mat_name] = m
	return m


## PREVIEW ONLY. A StandardMaterial3D from the scan sets, triplanar in world space.
static func arch_preview_mat(mat_name: String) -> Material:
	if _preview.has(mat_name):
		return _preview[mat_name]
	var set_name := "wall"
	var tint := Color(0.62, 0.56, 0.5)
	var metal := 0.0
	var scale_m := 2.0
	match mat_name:
		"floor":
			set_name = "floor"
			tint = Color(0.5, 0.5, 0.55)
			scale_m = 6.0
		"wall":
			tint = Color(0.5, 0.44, 0.38)
		"ceiling":
			tint = Color(0.3, 0.27, 0.25)
		"stone", "column":
			tint = Color(0.62, 0.56, 0.5)
		"wood_dark":
			set_name = "wood_dark"
			tint = Color(1, 1, 1)
		"trim_brass", "plaque_brass", "frame":
			set_name = "brass"
			tint = Color(1.0, 0.88, 0.62)
			metal = 0.75
			scale_m = 1.0
		"frame_step":
			set_name = "wood_dark"
			tint = Color(0.8, 0.7, 0.6)
		"velvet":
			set_name = "velvet"
			tint = Color(0.75, 0.1, 0.14)
			scale_m = 0.5
		_:
			return Materials.get_mat(mat_name)
	var dir := "res://assets/textures/%s/" % set_name
	var m := StandardMaterial3D.new()
	m.albedo_texture = load(dir + "albedo.jpg")
	m.albedo_color = tint
	m.normal_enabled = true
	m.normal_texture = load(dir + "normal.jpg")
	m.roughness_texture = load(dir + "roughness.jpg")
	m.roughness = 1.0
	m.metallic = metal
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3.ONE / scale_m
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_preview[mat_name] = m
	return m


# ---------------------------------------------------------------- baked ambient occlusion

## Vertex AO for world-space architecture: dark where a surface meets the floor, the ceiling or a wall.
static func _ao(p: Vector3, _n: Vector3) -> float:
	var k := 1.0
	k *= 1.0 - 0.55 * exp(-maxf(p.y, 0.0) / 0.28)
	k *= 1.0 - 0.5 * exp(-maxf(CEIL_Y - p.y, 0.0) / 0.35)
	k *= 1.0 - 0.3 * exp(-maxf(WALL_FACE - absf(p.x), 0.0) / 0.18)
	return clampf(k, 0.2, 1.0)


static func _mb(mat_name: String) -> ArchMesh:
	if not _merged.has(mat_name):
		var m := ArchMesh.new()
		m.ao = _ao
		_merged[mat_name] = m
	return _merged[mat_name]


# ---------------------------------------------------------------- contact shadows

static func _cm() -> ArchMesh:
	if _contact == null:
		_contact = ArchMesh.new()
	return _contact


const SHADOW_TINT := Color(0.05, 0.03, 0.035)


## A soft rectangular shadow: full strength inside +-hw x +-hh (along A and V), fading to nothing
## over `margin`. n is the facing of the surface it lies on.
static func contact_rect(c: Vector3, A: Vector3, V: Vector3, n: Vector3, hw: float, hh: float, margin: float, strength: float) -> void:
	var m := _cm()
	var xs := [-hw - margin, -hw, hw, hw + margin]
	var ys := [-hh - margin, -hh, hh, hh + margin]
	var ids: Array = []
	for j in 4:
		for i in 4:
			var edge := (i == 0 or i == 3 or j == 0 or j == 3)
			ids.append(m.vtx(c + A * float(xs[i]) + V * float(ys[j]), n, Vector2.ZERO, Color(SHADOW_TINT.r, SHADOW_TINT.g, SHADOW_TINT.b, 0.0 if edge else strength)))
	for j in 3:
		for i in 3:
			m.quad(ids[j * 4 + i], ids[j * 4 + i + 1], ids[(j + 1) * 4 + i + 1], ids[(j + 1) * 4 + i])


## A soft round shadow on the floor (or any plane facing n): full strength to r_in, zero at r_out.
static func contact_disc(c: Vector3, r_in: float, r_out: float, strength: float, n: Vector3 = Vector3.UP) -> void:
	var m := _cm()
	var A := Vector3.RIGHT if absf(n.x) < 0.9 else Vector3.UP
	var t1 := n.cross(A).normalized()
	var t2 := n.cross(t1).normalized()
	var segs := 16
	var ci := m.vtx(c, n, Vector2.ZERO, Color(SHADOW_TINT.r, SHADOW_TINT.g, SHADOW_TINT.b, strength))
	var inner: Array = []
	var outer: Array = []
	for s in segs:
		var a := TAU * float(s) / float(segs)
		var d := t1 * cos(a) + t2 * sin(a)
		inner.append(m.vtx(c + d * r_in, n, Vector2.ZERO, Color(SHADOW_TINT.r, SHADOW_TINT.g, SHADOW_TINT.b, strength)))
		outer.append(m.vtx(c + d * r_out, n, Vector2.ZERO, Color(SHADOW_TINT.r, SHADOW_TINT.g, SHADOW_TINT.b, 0.0)))
	for s in segs:
		var s2 := (s + 1) % segs
		m.tri(ci, inner[s], inner[s2])
		m.quad(inner[s], outer[s], outer[s2], inner[s2])


## A one-sided gradient strip: strength s along the edge a->b, fading to 0 at distance `w` along dir.
static func contact_strip(a: Vector3, b: Vector3, dir: Vector3, w: float, strength: float, n: Vector3) -> void:
	var m := _cm()
	var c0 := Color(SHADOW_TINT.r, SHADOW_TINT.g, SHADOW_TINT.b, strength)
	var c1 := Color(SHADOW_TINT.r, SHADOW_TINT.g, SHADOW_TINT.b, 0.0)
	var i0 := m.vtx(a, n, Vector2.ZERO, c0)
	var i1 := m.vtx(b, n, Vector2.ZERO, c0)
	var i2 := m.vtx(b + dir * w, n, Vector2.ZERO, c1)
	var i3 := m.vtx(a + dir * w, n, Vector2.ZERO, c1)
	m.quad(i0, i1, i2, i3)


# ---------------------------------------------------------------- profiles (x out, y up/outward)

static func _pv(a: Array) -> PackedVector2Array:
	var out := PackedVector2Array()
	for p in a:
		out.append(Vector2(float(p[0]), float(p[1])))
	return out


static func _arc(cx: float, cy: float, r: float, a0: float, a1: float, n: int) -> Array:
	var out: Array = []
	for i in n + 1:
		var a := deg_to_rad(lerpf(a0, a1, float(i) / float(n)))
		out.append([cx + r * cos(a), cy + r * sin(a)])
	return out


static func _prof_skirting() -> PackedVector2Array:
	return _pv([[0, 0], [0.05, 0], [0.05, 0.30], [0.058, 0.32], [0.058, 0.345], [0.042, 0.37], [0.02, 0.4], [0, 0.41]])


static func _prof_dado() -> PackedVector2Array:
	return _pv([[0, 0], [0.03, 0], [0.05, 0.02], [0.066, 0.05], [0.07, 0.08], [0.066, 0.11], [0.05, 0.14], [0.03, 0.156], [0, 0.16]])


static func _prof_rail() -> PackedVector2Array:
	return _pv([[0, 0], [0.03, 0], [0.03, 0.03], [0.05, 0.045], [0.056, 0.07], [0.05, 0.095], [0.03, 0.11], [0, 0.11]])


static func _prof_panel() -> PackedVector2Array:
	return _pv([[0, 0], [0.012, 0], [0.02, 0.01], [0.022, 0.022], [0.014, 0.032], [0.014, 0.042], [0.026, 0.052], [0.028, 0.064], [0.02, 0.074], [0, 0.074]])


static func _prof_bead() -> PackedVector2Array:
	return _pv([[0, 0], [0.01, 0.0], [0.016, 0.006], [0.016, 0.014], [0.01, 0.02], [0, 0.02]])


static func _prof_cornice() -> PackedVector2Array:
	var pts: Array = [[0, 0], [0.07, 0], [0.07, 0.12], [0.1, 0.145], [0.1, 0.19], [0.13, 0.215], [0.13, 0.25]]
	pts.append_array(_arc(0.62, 0.25, 0.49, 180.0, 90.0, 8))
	pts.append_array([[0.64, 0.75], [0.64, 0.82], [0.61, 0.88], [0.55, 0.94], [0.5, 1.0], [0.5, 1.17], [0, 1.17]])
	return _pv(pts)


static func _prof_architrave() -> PackedVector2Array:
	# x out of the face, y outward from the opening edge
	return _pv([[0.0, 0.0], [0.05, 0.0], [0.05, 0.02], [0.065, 0.03], [0.065, 0.14], [0.085, 0.16], [0.085, 0.2], [0.07, 0.215], [0.07, 0.3], [0.1, 0.32], [0.1, 0.36], [0.0, 0.36]])


static func _prof_frame_inner() -> PackedVector2Array:
	return _pv([[0.095, 0.0], [0.14, 0.0], [0.15, 0.01], [0.15, 0.028], [0.128, 0.036], [0.122, 0.06]])


static func _prof_frame_outer() -> PackedVector2Array:
	return _pv([[0.122, 0.06], [0.14, 0.075], [0.162, 0.095], [0.168, 0.12], [0.16, 0.145], [0.14, 0.165], [0.15, 0.172], [0.15, 0.188], [0.135, 0.2], [0.0, 0.2]])


static func _prof_plinth_foot() -> PackedVector2Array:
	return _pv([[0.1, 0.0], [0.085, 0.02], [0.06, 0.035], [0.05, 0.06], [0.0, 0.06]])


static func _prof_plinth_cap() -> PackedVector2Array:
	return _pv([[0.09, 0.0], [0.09, 0.07], [0.055, 0.07], [0.04, 0.06], [0.03, 0.04], [0.0, 0.025], [0.0, 0.0]])


# ---------------------------------------------------------------- static batches

## Queue a transform for the batch of (mesh kind, material name). Kinds: "box" (unit cube),
## "cyl12" (unit cylinder), "sph8" (unit-radius sphere), "column" (a whole fluted column, 9.22 m,
## origin at its foot), "stanchion" (a turned brass post, 0.94 m, origin at its foot).
static func add(mat_name: String, xf: Transform3D, kind: String = "box") -> void:
	var key := kind + "|" + mat_name
	if not _batches.has(key):
		var xfs: Array[Transform3D] = []
		_batches[key] = {"kind": kind, "mat": mat_name, "xfs": xfs}
	var list: Array[Transform3D] = _batches[key]["xfs"]
	list.append(xf)


## Queue a box of the given size centred at pos.
static func block(mat_name: String, size: Vector3, pos: Vector3) -> void:
	add(mat_name, Transform3D(Basis.from_scale(size), pos))


static func _mesh(kind: String) -> Mesh:
	if _meshes.has(kind):
		return _meshes[kind]
	var m: Mesh
	match kind:
		"cyl12":
			var c := CylinderMesh.new()
			c.top_radius = 1.0
			c.bottom_radius = 1.0
			c.height = 1.0
			c.radial_segments = 12
			c.rings = 1
			m = c
		"sph8":
			var s := SphereMesh.new()
			s.radius = 1.0
			s.height = 2.0
			s.radial_segments = 8
			s.rings = 4
			m = s
		"column":
			m = _column_mesh()
		"stanchion":
			m = _stanchion_mesh()
		_:
			m = box(Vector3.ONE)
	_meshes[kind] = m
	return m


static func _column_mesh() -> Mesh:
	var b := ArchMesh.new()
	var top := CEIL_Y
	# plinth block and torus foot
	b.bevel_box(Vector3(0, 0.17, 0), Vector3(1.0, 0.34, 1.0), 0.03)
	var foot: Array = []
	foot.append_array(_arc(0.37, 0.41, 0.07, -90.0, 90.0, 4))
	foot.append_array([[0.34, 0.48], [0.34, 0.53]])
	b.lathe(_pv(foot), Vector3.ZERO, 20, Color(0.85, 0.85, 0.85))
	# fluted shaft
	var y1 := top - 1.12
	b.fluted_shaft(Vector3.ZERO, 0.34, 0.29, 0.52, y1, 12, 0.036, 6, 3)
	# astragal and echinus
	var cap: Array = [[0.3, y1], [0.33, y1 + 0.02]]
	cap.append_array(_arc(0.325, y1 + 0.06, 0.035, -90.0, 90.0, 4))
	cap.append_array([[0.3, y1 + 0.1], [0.3, y1 + 0.12], [0.33, y1 + 0.2], [0.385, y1 + 0.32], [0.43, y1 + 0.43], [0.45, y1 + 0.52], [0.45, y1 + 0.6]])
	b.lathe(_pv(cap), Vector3.ZERO, 20)
	var ab_h := top - (y1 + 0.6)
	b.bevel_box(Vector3(0, y1 + 0.6 + ab_h * 0.5, 0), Vector3(1.0, ab_h, 1.0), 0.035)
	return b.to_mesh()


static func _stanchion_mesh() -> Mesh:
	var b := ArchMesh.new()
	var pts: Array = [[0.17, 0.0], [0.174, 0.014], [0.14, 0.04], [0.08, 0.06], [0.026, 0.074],
		[0.022, 0.1], [0.034, 0.118], [0.022, 0.14], [0.02, 0.36], [0.03, 0.378], [0.02, 0.4],
		[0.018, 0.7], [0.032, 0.72], [0.032, 0.74], [0.018, 0.76], [0.018, 0.82]]
	pts.append_array(_arc(0.0, 0.88, 0.048, -128.0, 90.0, 6))
	b.lathe(_pv(pts), Vector3.ZERO, 10)
	return b.to_mesh()


## Turn every queued batch and merged architecture mesh into scene nodes. Call once, after all
## modules have built.
static func flush(root: Node3D) -> void:
	stat_draws = 0
	for key in _batches:
		var info: Dictionary = _batches[key]
		var xfs: Array[Transform3D] = info["xfs"]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		var mesh := _mesh(str(info["kind"]))
		mm.mesh = mesh
		mm.instance_count = xfs.size()
		for i in xfs.size():
			mm.set_instance_transform(i, xfs[i])
		var inst := MultiMeshInstance3D.new()
		inst.multimesh = mm
		inst.material_override = _surface(str(info["mat"]))
		inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(inst)
		stat_draws += 1
		if str(info["kind"]) in ["column", "stanchion"]:
			stat_tris += xfs.size() * _tri_count(mesh)
	_batches.clear()
	for mat_name in _merged:
		var b: ArchMesh = _merged[mat_name]
		if b.is_empty():
			continue
		var node := MeshInstance3D.new()
		node.mesh = b.to_mesh()
		node.material_override = _surface(str(mat_name))
		node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(node)
		stat_draws += 1
		stat_tris += b.idx.size() / 3
	_merged.clear()
	if _contact != null and not _contact.is_empty():
		var cm := ShaderMaterial.new()
		cm.shader = load("res://shaders/arch_contact.gdshader")
		cm.render_priority = 8
		var cn := MeshInstance3D.new()
		cn.mesh = _contact.to_mesh()
		cn.material_override = cm
		cn.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(cn)
		stat_draws += 1
		stat_tris += _contact.idx.size() / 3
	_contact = null
	print("Architecture: %d tris, %d draw calls (own batches)" % [stat_tris, stat_draws])


static func _tri_count(m: Mesh) -> int:
	var arr := m.surface_get_arrays(0)
	return (arr[Mesh.ARRAY_INDEX] as PackedInt32Array).size() / 3


# ---------------------------------------------------------------- shell

## Floor, side walls with skirting, wainscot, dado, panels, rail and cornice, the coffered
## ceiling, the entrance end wall, the portal architrave, and the fluted columns (opposite each
## bay, plus both ends). n_bays = exhibit count.
## `tick` is awaited between the parts, so the page gets to repaint between them (see hall.gd).
static func build(root: Node3D, n_bays: int, tick: Callable) -> void:
	_batches.clear()
	_merged.clear()
	_contact = null
	stat_tris = 0
	var hw := Layout.HALF_W
	var wh := Layout.WALL_H
	var hall_len := Layout.HALL_Z0 - Layout.HALL_Z1
	var mid := (Layout.HALL_Z0 + Layout.HALL_Z1) * 0.5
	mi(root, box(Vector3(hw * 2.0, 0.2, hall_len)), _surface("floor"), Vector3(0, -0.1, mid))
	var wall_mat := _surface("wall")
	for sx: float in [-1.0, 1.0]:
		mi(root, box(Vector3(0.4, wh + 0.6, hall_len)), wall_mat, Vector3(sx * (hw + 0.2), (wh + 0.6) * 0.5, mid))
	mi(root, box(Vector3(hw * 2.0 + 0.8, wh + 0.6, 0.4)), wall_mat, Vector3(0, (wh + 0.6) * 0.5, Layout.HALL_Z0 + 0.2))

	# fluted columns
	var cps: Array[Vector3] = []
	for b in n_bays:
		cps.append(Vector3(-Layout.bay_side(b) * COL_X, 0, Layout.bay_z(b)))
	for sx: float in [-1.0, 1.0]:
		cps.append(Vector3(sx * COL_X, 0, 4.0))
		cps.append(Vector3(sx * COL_X, 0, Layout.HALL_Z1 + 2.0))
	for p in cps:
		add("stone", Transform3D(Basis.IDENTITY, p), "column")
		contact_disc(p + Vector3(0, 0.006, 0), 0.52, 1.25, 0.6)

	await tick.call()
	_walls(n_bays, cps)
	await tick.call()
	_ceiling()
	_portal()
	_ground_shadows(n_bays)
	if PREVIEW_LIGHTS:
		_preview_lights(root)


static func _walls(_n_bays: int, cps: Array[Vector3]) -> void:
	var z0 := Layout.HALL_Z0
	var z1 := Layout.HALL_Z1
	var zs := Layout.ST_Z0
	var stone := _mb("stone")
	var wood := _mb("wood_dark")
	var brass := _mb("trim_brass")
	var wall := _mb("wall")
	for sx: float in [-1.0, 1.0]:
		var N := Vector3(-sx, 0, 0)
		var x: float = sx * WALL_FACE
		# runs that stop where the stage deck starts
		stone.sweep_line(_prof_skirting(), Vector3(x, 0, z0), Vector3(x, 0, zs), N, Vector3.UP)
		wood.sweep_line(_prof_dado(), Vector3(x, DADO_Y - 0.08, z0), Vector3(x, DADO_Y - 0.08, zs), N, Vector3.UP)
		# wainscot: a plain wood field with raised panels
		wood.sweep_line(PackedVector2Array([Vector2(0, 0.41), Vector2(0.03, 0.41), Vector2(0.03, DADO_Y - 0.08), Vector2(0, DADO_Y - 0.08)]), Vector3(x, 0, z0), Vector3(x, 0, zs), N, Vector3.UP)
		var cells := int((z0 - zs) / 1.75)
		var cw := (z0 - zs) / float(cells)
		for i in cells:
			var zc := z0 - cw * (float(i) + 0.5)
			var cy := (0.41 + DADO_Y - 0.08) * 0.5 + 0.0
			var hh := (DADO_Y - 0.08 - 0.41) * 0.5 - 0.1
			var hww := cw * 0.5 - 0.17
			wood.sweep_rect(_prof_bead_off(0.03), Vector3(x, cy, zc), Vector3.BACK, Vector3.UP, N, hww, hh)
			wood.plane(Vector3(x, cy, zc) + N * 0.034, Vector3.BACK * hww, Vector3.UP * hh, N)
		# picture rail and cornice, the full length (cornice also runs along the stage)
		stone.sweep_line(_prof_rail(), Vector3(x, RAIL_Y, z0), Vector3(x, RAIL_Y, zs), N, Vector3.UP)
		brass.sweep_line(_prof_bead(), Vector3(x, RAIL_Y + 0.045, z0), Vector3(x, RAIL_Y + 0.045, zs), N + N * 0.05, Vector3.UP)
		stone.sweep_line(_prof_cornice(), Vector3(x, Layout.WALL_H - 0.95, z0), Vector3(x, Layout.WALL_H - 0.95, z1), N, Vector3.UP)
		brass.sweep_line(_prof_bead(), Vector3(x, Layout.WALL_H - 0.95 + 0.115, z0), Vector3(x, Layout.WALL_H - 0.95 + 0.115, z1), N * 1.0 + N * 0.07, Vector3.UP)
		# pilasters behind each column, and tall panels in between
		var pz: Array[float] = []
		for p in cps:
			if signf(p.x) == sx:
				pz.append(p.z)
		pz.sort()
		pz.reverse()
		for z in pz:
			if z < zs + 1.0:
				continue
			_pilaster(stone, sx, z)
		var edges: Array[float] = []
		for zq in pz:
			if zq > zs + 1.0:
				edges.append(zq)
		edges.append(zs + 0.3)
		for i in edges.size() - 1:
			var za: float = edges[i] - (0.95 if i >= 0 else 0.3)
			var zb: float = edges[i + 1] + (0.95 if i + 1 < edges.size() - 1 else 0.3)
			var ln := za - zb
			if ln < 2.0:
				continue
			var hwp := ln * 0.5 - 0.25
			var chh := (PANEL_Y1 - PANEL_Y0) * 0.5
			var cz := (za + zb) * 0.5
			stone.sweep_rect(_prof_panel(), Vector3(x, (PANEL_Y1 + PANEL_Y0) * 0.5, cz), Vector3.BACK, Vector3.UP, N, hwp, chh)
			stone.sweep_rect(_prof_bead(), Vector3(x, (PANEL_Y1 + PANEL_Y0) * 0.5, cz), Vector3.BACK, Vector3.UP, N, hwp - 0.18, chh - 0.18)
		# wall shadow under the cornice and above the floor
		contact_strip(Vector3(x, 0.006, z0), Vector3(x, 0.006, z1), N, 1.1, 0.6, Vector3.UP)
		contact_strip(Vector3(x - sx * 0.006, Layout.WALL_H - 0.95, z0), Vector3(x - sx * 0.006, Layout.WALL_H - 0.95, z1), Vector3.DOWN, 1.3, 0.55, N)
	# entrance end wall
	var Ne := Vector3(0, 0, -1)
	stone.sweep_line(_prof_skirting(), Vector3(-WALL_FACE, 0, z0), Vector3(WALL_FACE, 0, z0), Ne, Vector3.UP)
	wood.sweep_line(_prof_dado(), Vector3(-WALL_FACE, DADO_Y - 0.08, z0), Vector3(WALL_FACE, DADO_Y - 0.08, z0), Ne, Vector3.UP)
	stone.sweep_line(_prof_cornice(), Vector3(-WALL_FACE, Layout.WALL_H - 0.95, z0), Vector3(WALL_FACE, Layout.WALL_H - 0.95, z0), Ne, Vector3.UP)


static func _prof_bead_off(depth: float) -> PackedVector2Array:
	# a small raised-panel fillet on a field of the given depth
	return _pv([[depth, 0.0], [depth + 0.02, 0.0], [depth + 0.026, 0.012], [depth + 0.026, 0.026], [depth, 0.036]])


static func _pilaster(stone: ArchMesh, sx: float, z: float) -> void:
	var x: float = sx * WALL_FACE
	var dx := -sx
	# shaft, plinth and capital blocks, proud of the wall by 0.15
	stone.bevel_box(Vector3(x + dx * 0.075, 0.2, z), Vector3(0.15, 0.4, 1.3), 0.015)
	stone.bevel_box(Vector3(x + dx * 0.07, (0.4 + CEIL_Y - 1.1) * 0.5, z), Vector3(0.14, CEIL_Y - 1.5, 1.0), 0.015)
	stone.bevel_box(Vector3(x + dx * 0.085, CEIL_Y - 0.55, z), Vector3(0.17, 0.2, 1.2), 0.015)
	stone.bevel_box(Vector3(x + dx * 0.1, CEIL_Y - 0.3, z), Vector3(0.2, 0.3, 1.3), 0.02)


static func _ceiling() -> void:
	var wall := _mb("wall")
	var z0 := Layout.HALL_Z0
	var z1 := Layout.HALL_Z1
	var len_z := z0 - z1
	wall.plane(Vector3(0, CEIL_Y, (z0 + z1) * 0.5), Vector3(WALL_FACE + 0.2, 0, 0), Vector3(0, 0, len_z * 0.5), Vector3.DOWN)
	var bw := 0.32
	var bh := 0.36
	var by := CEIL_Y - bh * 0.5
	var nz := int(round(len_z / 4.0))
	for k in nz + 1:
		var z := z0 - 4.0 * float(k)
		wall.bevel_box(Vector3(0, by, z), Vector3(WALL_FACE * 2.0, bh, bw), 0.025)
	var xs := [-6.38, -2.49, -2.17, 2.17, 2.49, 6.38]
	for sx in [-2.33, 2.33]:
		wall.bevel_box(Vector3(sx, by, (z0 + z1) * 0.5), Vector3(bw, bh, len_z), 0.025)
	for k in nz:
		var za := z0 - 4.0 * float(k) - bw * 0.5
		var zb := z0 - 4.0 * float(k + 1) + bw * 0.5
		for c in 3:
			var xa: float = xs[c * 2]
			var xb: float = xs[c * 2 + 1]
			var ctr := Vector3((xa + xb) * 0.5, CEIL_Y, (za + zb) * 0.5)
			wall.sweep_rect(_prof_bead(), ctr, Vector3.RIGHT, Vector3.BACK, Vector3.DOWN, (xb - xa) * 0.5 - 0.12, (za - zb) * 0.5 - 0.12)


## Architrave around the hall opening under the marquee: jambs and lintel with moulded face.
static func _portal() -> void:
	var stone := _mb("stone")
	var zf := Layout.MQ_Z
	var y_top := 4.78
	var hh := (y_top - 0.36) * 0.5
	stone.sweep_rect(_prof_architrave(), Vector3(0, hh, zf), Vector3.RIGHT, Vector3.UP, Vector3.BACK, 6.28, hh, Color.WHITE, 11)
	for sx: float in [-1.0, 1.0]:
		stone.bevel_box(Vector3(sx * 6.62, 0.3, zf + 0.1), Vector3(0.8, 0.6, 0.3), 0.02)


static func _ground_shadows(n_bays: int) -> void:
	for b in n_bays:
		var z := Layout.bay_z(b)
		for sx: float in [-1.0, 1.0]:
			for sz in [-1.0, 1.0]:
				contact_rect(Vector3(sx * 6.3, 0.006, z + sz * 2.6), Vector3.RIGHT, Vector3.BACK, Vector3.UP, 0.25, 0.25, 0.4, 0.65)


static func _preview_lights(root: Node3D) -> void:
	for z in [6.0, -10.0, -24.0, -40.0, -60.0, -80.0, -100.0, -112.0]:
		var l := OmniLight3D.new()
		l.position = Vector3(0, 6.0, z)
		l.omni_range = 16.0
		l.light_energy = 1.4
		l.light_color = Color(1.0, 0.86, 0.7)
		root.add_child(l)


# ---------------------------------------------------------------- per-bay pieces

## A picture frame (moulded gilt profile with a dark inner slip, cream mat board with a bevelled
## window) around a w x h picture centred at (side * 6.92, cy, zc). The picture plane sits 0.08 m
## off the wall; the frame crest stands 0.17 m off it.
static func frame(side: float, cy: float, zc: float, w: float, h: float) -> void:
	var N := Vector3(-side, 0, 0)
	var c := Vector3(side * WALL_FACE, cy, zc)
	var hwp := w * 0.5
	var hhp := h * 0.5
	var fw := hwp + MAT_B
	var fh := hhp + MAT_B
	_mb("frame").sweep_rect(_prof_frame_outer(), c, Vector3.BACK, Vector3.UP, N, fw, fh)
	_mb("frame_step").sweep_rect(_prof_frame_inner(), c, Vector3.BACK, Vector3.UP, N, fw, fh)
	# mat board: bevelled window, then a face that darkens under the frame lip
	var mat := _mb("mat_board")
	mat.sweep_rect(_pv([[0.08, 0.0], [0.096, 0.014]]), c, Vector3.BACK, Vector3.UP, N, hwp, hhp, Color(1, 1, 1))
	mat.sweep_rect(_pv([[0.096, 0.014], [0.096, 0.062]]), c, Vector3.BACK, Vector3.UP, N, hwp, hhp, Color(0.8, 0.8, 0.8))
	mat.sweep_rect(_pv([[0.096, 0.062], [0.096, 0.078]]), c, Vector3.BACK, Vector3.UP, N, hwp, hhp, Color(0.68, 0.68, 0.68))
	mat.sweep_rect(_pv([[0.096, 0.078], [0.096, MAT_B]]), c, Vector3.BACK, Vector3.UP, N, hwp, hhp, Color(0.52, 0.5, 0.5))
	# shadow the frame throws on the wall, a little below it
	contact_rect(c + N * 0.006 + Vector3(0, -0.07, 0), Vector3.BACK, Vector3.UP, N, fw + 0.02, fh + 0.02, 0.26, 0.38)


## Plinth (moulded foot, die, moulded cap, wood top) and the leaning wooden plaque stand for bay b.
static func plinth(b: int) -> void:
	var side := Layout.bay_side(b)
	var z := Layout.bay_z(b)
	var stone := _mb("stone")
	var cx := side * 5.2
	var c := Vector3(cx, 0, z)
	var die_w := Vector3(0.98, 0.0, 2.78)
	stone.bevel_box(c + Vector3(0, 0.27, 0), Vector3(die_w.x, 0.4, die_w.z), 0.012)
	stone.sweep_rect(_prof_plinth_foot(), c, Vector3.BACK, Vector3.RIGHT, Vector3.UP, die_w.z * 0.5, die_w.x * 0.5)
	stone.sweep_rect(_prof_plinth_cap(), c + Vector3(0, 0.47, 0), Vector3.BACK, Vector3.RIGHT, Vector3.UP, die_w.z * 0.5, die_w.x * 0.5)
	_mb("wood_dark").bevel_box(c + Vector3(0, 0.585, 0), Vector3(1.22, 0.07, 3.02), 0.015)
	contact_rect(Vector3(cx, 0.006, z), Vector3.BACK, Vector3.RIGHT, Vector3.UP, 1.45, 0.52, 0.5, 0.75)
	# plaque stand
	var wood := _mb("wood_dark")
	wood.xf = Transform3D(Layout.plaque_rot(b), Layout.plaque_org(b))
	wood.bevel_box(Vector3(0, 0.56, -0.1), Vector3(2.9, 1.2, 0.14), 0.02)
	wood.xf = Transform3D.IDENTITY


## Four brass stanchions with a draped velvet rope between them, along bay b.
static func stanchions(b: int) -> void:
	var side := Layout.bay_side(b)
	var z := Layout.bay_z(b)
	var pz: Array[float] = [-3.6, -1.2, 1.2, 3.6]
	var tops: Array[Vector3] = []
	for pzv in pz:
		var px := side * 3.0
		add("trim_brass", Transform3D(Basis.IDENTITY, Vector3(px, 0, z + pzv)), "stanchion")
		contact_disc(Vector3(px, 0.006, z + pzv), 0.17, 0.5, 0.75)
		tops.append(Vector3(px, 0.79, z + pzv))
	var velvet := _mb("velvet")
	for i in 3:
		var a: Vector3 = tops[i]
		var c: Vector3 = tops[i + 1]
		var along := (c - a).normalized()
		a += along * 0.03
		c -= along * 0.03
		var span := a.distance_to(c)
		var sag := 0.2
		var kk := 2.4
		var den := cosh(kk * span * 0.5) - 1.0
		var pts: Array[Vector3] = []
		for s in 13:
			var t := float(s) / 12.0
			var xl := (t - 0.5) * span
			var drop := sag * (1.0 - (cosh(kk * xl) - 1.0) / den)
			pts.append(a.lerp(c, t) - Vector3(0, drop, 0))
		velvet.tube(pts, 0.024, 6)
		# soft shadow of the rope on the floor
		var mid := a.lerp(c, 0.5)
		contact_rect(Vector3(mid.x, 0.006, mid.z), Vector3.BACK, Vector3.RIGHT, Vector3.UP, span * 0.5 - 0.1, 0.02, 0.12, 0.3)
