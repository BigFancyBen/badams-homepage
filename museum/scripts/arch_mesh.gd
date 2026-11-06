extends RefCounted
## ArchMesh: a small mesh builder for architecture. Bevelled boxes, 2D profiles swept along a line
## or around a rectangle (mouldings), lathes, flutes, tubes and soft quads, all with real normals,
## metre-scaled UVs and baked vertex-colour AO (a Callable(pos, normal) -> float, set by the caller).
##
## Profiles are Vector2(x, y) lists. x = out along the surface normal N, y = along V (up the wall,
## or outward around a ring). Walk the profile with the air on your right; the normal of an edge
## (ex, ey) is then (ey, -ex). Triangle winding is fixed automatically from the normals, so a
## profile or a basis with the wrong handedness never shows up as a missing face.

var pos := PackedVector3Array()
var nrm := PackedVector3Array()
var uvs := PackedVector2Array()
var col := PackedColorArray()
var idx := PackedInt32Array()

## Optional Callable(p: Vector3, n: Vector3) -> float, multiplied into the vertex colour.
var ao: Callable
## Transform applied to everything that is added (positions and normals).
var xf := Transform3D.IDENTITY


func is_empty() -> bool:
	return idx.is_empty()


func vtx(p: Vector3, n: Vector3, uv: Vector2, c: Color = Color.WHITE) -> int:
	var wp := xf * p
	var wn := (xf.basis * n).normalized()
	var k := 1.0
	if ao.is_valid():
		k = float(ao.call(wp, wn))
	pos.append(wp)
	nrm.append(wn)
	uvs.append(uv)
	col.append(Color(c.r * k, c.g * k, c.b * k, c.a))
	return pos.size() - 1


func tri(a: int, b: int, c: int) -> void:
	var g := (pos[c] - pos[a]).cross(pos[b] - pos[a])
	if g.length_squared() < 1e-12:
		return
	if g.dot(nrm[a] + nrm[b] + nrm[c]) >= 0.0:
		idx.append(a)
		idx.append(b)
		idx.append(c)
	else:
		idx.append(a)
		idx.append(c)
		idx.append(b)


func quad(a: int, b: int, c: int, d: int) -> void:
	tri(a, b, c)
	tri(a, c, d)


## A flat quad from four corners (order around the quad) with one normal.
func flat(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, n: Vector3, uv_scale: float = 1.0, c: Color = Color.WHITE) -> void:
	var u := (p1 - p0).length() * uv_scale
	var v := (p3 - p0).length() * uv_scale
	var a := vtx(p0, n, Vector2(0, 0), c)
	var b := vtx(p1, n, Vector2(u, 0), c)
	var cc := vtx(p2, n, Vector2(u, v), c)
	var d := vtx(p3, n, Vector2(0, v), c)
	quad(a, b, cc, d)


## A rectangle centred at c spanned by half-vectors ha and hv, facing n.
func plane(c: Vector3, ha: Vector3, hv: Vector3, n: Vector3, col_in: Color = Color.WHITE) -> void:
	flat(c - ha - hv, c + ha - hv, c + ha + hv, c - ha + hv, n, 1.0, col_in)


# ---------------------------------------------------------------- profiles

static func edge_normals(profile: PackedVector2Array, smooth_deg: float) -> Array:
	## Per edge [n_start, n_end] (Vector2), smoothed across vertices whose edges meet at a shallow angle.
	var ne := profile.size() - 1
	var en: Array[Vector2] = []
	for k in ne:
		var e := profile[k + 1] - profile[k]
		var n2 := Vector2(e.y, -e.x)
		en.append(n2.normalized() if n2.length() > 1e-9 else Vector2(1, 0))
	var out: Array = []
	var cs := cos(deg_to_rad(smooth_deg))
	for k in ne:
		var n0: Vector2 = en[k]
		var n1: Vector2 = en[k]
		if k > 0 and en[k - 1].dot(en[k]) > cs:
			n0 = (en[k - 1] + en[k]).normalized()
		if k < ne - 1 and en[k + 1].dot(en[k]) > cs:
			n1 = (en[k + 1] + en[k]).normalized()
		out.append([n0, n1])
	return out


## Sweep a profile along the straight line a->b. N is the profile's x axis, V its y axis.
func sweep_line(profile: PackedVector2Array, a: Vector3, b: Vector3, N: Vector3, V: Vector3, tint: Color = Color.WHITE, smooth_deg: float = 35.0) -> void:
	var ens := edge_normals(profile, smooth_deg)
	var len_ab := a.distance_to(b)
	var vlen := 0.0
	for k in profile.size() - 1:
		var p0 := profile[k]
		var p1 := profile[k + 1]
		var seg := p0.distance_to(p1)
		var n: Array = ens[k]
		var n0: Vector2 = n[0]
		var n1: Vector2 = n[1]
		var w0 := N * p0.x + V * p0.y
		var w1 := N * p1.x + V * p1.y
		var i0 := vtx(a + w0, N * n0.x + V * n0.y, Vector2(0, vlen), tint)
		var i1 := vtx(a + w1, N * n1.x + V * n1.y, Vector2(0, vlen + seg), tint)
		var i2 := vtx(b + w1, N * n1.x + V * n1.y, Vector2(len_ab, vlen + seg), tint)
		var i3 := vtx(b + w0, N * n0.x + V * n0.y, Vector2(len_ab, vlen), tint)
		quad(i0, i1, i2, i3)
		vlen += seg


## Sweep a profile around a rectangle (mitred corners). The rectangle is centred at c, spans
## +-hw along A and +-hh along V; the profile's y runs outward from its edge, x along N.
## sides: bitmask 1 top(+V) 2 right(+A) 4 bottom(-V) 8 left(-A).
func sweep_rect(profile: PackedVector2Array, c: Vector3, A: Vector3, V: Vector3, N: Vector3, hw: float, hh: float, tint: Color = Color.WHITE, sides: int = 15, smooth_deg: float = 35.0) -> void:
	var ens := edge_normals(profile, smooth_deg)
	var defs := [
		[1, V, -1.0, 1.0, 1.0, 1.0],
		[2, A, 1.0, 1.0, 1.0, -1.0],
		[4, -V, 1.0, -1.0, -1.0, -1.0],
		[8, -A, -1.0, -1.0, -1.0, 1.0],
	]
	for d in defs:
		if (sides & int(d[0])) == 0:
			continue
		var o: Vector3 = d[1]
		var ca := Vector2(d[2], d[3])
		var cb := Vector2(d[4], d[5])
		var vlen := 0.0
		var side_len := (hw * 2.0 if int(d[0]) in [1, 4] else hh * 2.0)
		for k in profile.size() - 1:
			var p0 := profile[k]
			var p1 := profile[k + 1]
			var seg := p0.distance_to(p1)
			var n: Array = ens[k]
			var n0: Vector2 = n[0]
			var n1: Vector2 = n[1]
			var nw0 := N * n0.x + o * n0.y
			var nw1 := N * n1.x + o * n1.y
			var c00 := _rc(c, A, V, N, hw, hh, ca, p0)
			var c01 := _rc(c, A, V, N, hw, hh, cb, p0)
			var c10 := _rc(c, A, V, N, hw, hh, ca, p1)
			var c11 := _rc(c, A, V, N, hw, hh, cb, p1)
			var i0 := vtx(c00, nw0, Vector2(0, vlen), tint)
			var i1 := vtx(c10, nw1, Vector2(0, vlen + seg), tint)
			var i2 := vtx(c11, nw1, Vector2(side_len, vlen + seg), tint)
			var i3 := vtx(c01, nw0, Vector2(side_len, vlen), tint)
			quad(i0, i1, i2, i3)
			vlen += seg


static func _rc(c: Vector3, A: Vector3, V: Vector3, N: Vector3, hw: float, hh: float, corner: Vector2, p: Vector2) -> Vector3:
	return c + A * (corner.x * (hw + p.y)) + V * (corner.y * (hh + p.y)) + N * p.x


# ---------------------------------------------------------------- boxes

## A box with chamfered edges (chamfer r), flat-shaded faces, metre UVs.
func bevel_box(centre: Vector3, size: Vector3, r: float, tint: Color = Color.WHITE) -> void:
	var h := size * 0.5
	r = minf(r, minf(h.x, minf(h.y, h.z)) * 0.9)
	var ax := [Vector3.RIGHT, Vector3.UP, Vector3.BACK]
	var hs := [h.x, h.y, h.z]
	# faces
	for a in 3:
		var t1 := (a + 1) % 3
		var t2 := (a + 2) % 3
		for s in [-1.0, 1.0]:
			var n: Vector3 = ax[a] * s
			var c0: Vector3 = centre + n * hs[a]
			var e1: Vector3 = ax[t1] * (hs[t1] - r)
			var e2: Vector3 = ax[t2] * (hs[t2] - r)
			var ia := vtx(c0 - e1 - e2, n, Vector2(-(hs[t1]), -(hs[t2])), tint)
			var ib := vtx(c0 + e1 - e2, n, Vector2(hs[t1], -(hs[t2])), tint)
			var ic := vtx(c0 + e1 + e2, n, Vector2(hs[t1], hs[t2]), tint)
			var id := vtx(c0 - e1 + e2, n, Vector2(-(hs[t1]), hs[t2]), tint)
			quad(ia, ib, ic, id)
	# edges
	for a1 in 3:
		for a2 in range(a1 + 1, 3):
			var a3 := 3 - a1 - a2
			for s1 in [-1.0, 1.0]:
				for s2 in [-1.0, 1.0]:
					var n: Vector3 = (ax[a1] * s1 + ax[a2] * s2).normalized()
					var ps: Array[int] = []
					for s3 in [-1.0, 1.0]:
						var base3: Vector3 = ax[a3] * (s3 * (hs[a3] - r))
						var f1: Vector3 = centre + ax[a1] * (s1 * hs[a1]) + ax[a2] * (s2 * (hs[a2] - r)) + base3
						var f2: Vector3 = centre + ax[a1] * (s1 * (hs[a1] - r)) + ax[a2] * (s2 * hs[a2]) + base3
						ps.append(vtx(f1, n, Vector2(s3 * hs[a3], 0), tint))
						ps.append(vtx(f2, n, Vector2(s3 * hs[a3], r), tint))
					quad(ps[0], ps[1], ps[3], ps[2])
	# corners
	for sx in [-1.0, 1.0]:
		for sy in [-1.0, 1.0]:
			for sz in [-1.0, 1.0]:
				var n := Vector3(sx, sy, sz).normalized()
				var p1 := centre + Vector3(sx * h.x, sy * (h.y - r), sz * (h.z - r))
				var p2 := centre + Vector3(sx * (h.x - r), sy * h.y, sz * (h.z - r))
				var p3 := centre + Vector3(sx * (h.x - r), sy * (h.y - r), sz * h.z)
				tri(vtx(p1, n, Vector2.ZERO, tint), vtx(p2, n, Vector2(r, 0), tint), vtx(p3, n, Vector2(0, r), tint))


# ---------------------------------------------------------------- lathe, tubes

## Revolve a profile (x = radius, y = height) round Y at `at`. Walk bottom to top on the outside.
func lathe(profile: PackedVector2Array, at: Vector3, segs: int = 24, tint: Color = Color.WHITE, smooth_deg: float = 40.0) -> void:
	var ens := edge_normals(profile, smooth_deg)
	var vlen := 0.0
	for k in profile.size() - 1:
		var p0 := profile[k]
		var p1 := profile[k + 1]
		var seg := p0.distance_to(p1)
		var n: Array = ens[k]
		var n0: Vector2 = n[0]
		var n1: Vector2 = n[1]
		var prev0 := -1
		var prev1 := -1
		for s in segs + 1:
			var a := TAU * float(s) / float(segs)
			var dir := Vector3(cos(a), 0.0, sin(a))
			var u := a * maxf(p0.x, p1.x)
			var i0 := vtx(at + dir * p0.x + Vector3(0, p0.y, 0), dir * n0.x + Vector3(0, n0.y, 0), Vector2(u, vlen), tint)
			var i1 := vtx(at + dir * p1.x + Vector3(0, p1.y, 0), dir * n1.x + Vector3(0, n1.y, 0), Vector2(u, vlen + seg), tint)
			if prev0 >= 0:
				quad(prev0, prev1, i1, i0)
			prev0 = i0
			prev1 = i1
		vlen += seg


## A flat disc (cap) at height y with radius r, facing up or down.
func disc(at: Vector3, r: float, up: bool, segs: int = 24, tint: Color = Color.WHITE) -> void:
	var n := Vector3.UP if up else Vector3.DOWN
	var c := vtx(at, n, Vector2(0.5, 0.5), tint)
	var prev := -1
	for s in segs + 1:
		var a := TAU * float(s) / float(segs)
		var i := vtx(at + Vector3(cos(a) * r, 0, sin(a) * r), n, Vector2(0.5 + cos(a) * 0.5, 0.5 + sin(a) * 0.5), tint)
		if prev >= 0:
			tri(c, prev, i)
		prev = i


## A round tube along a polyline (parallel-transport frames), open ends.
func tube(pts: Array[Vector3], radius: float, sides: int = 8, tint: Color = Color.WHITE) -> void:
	var n := pts.size()
	if n < 2:
		return
	var rings: Array[PackedInt32Array] = []
	var t0 := (pts[1] - pts[0]).normalized()
	var ref := Vector3.UP if absf(t0.y) < 0.9 else Vector3.RIGHT
	var side_v := t0.cross(ref).normalized()
	var acc := 0.0
	for i in n:
		var t: Vector3
		if i == 0:
			t = (pts[1] - pts[0]).normalized()
		elif i == n - 1:
			t = (pts[i] - pts[i - 1]).normalized()
		else:
			t = (pts[i + 1] - pts[i - 1]).normalized()
		side_v = (side_v - t * side_v.dot(t)).normalized()
		var up_v := t.cross(side_v).normalized()
		if i > 0:
			acc += pts[i].distance_to(pts[i - 1])
		var ring := PackedInt32Array()
		for s in sides + 1:
			var a := TAU * float(s) / float(sides)
			var d := side_v * cos(a) + up_v * sin(a)
			ring.append(vtx(pts[i] + d * radius, d, Vector2(acc, a * radius), tint))
		rings.append(ring)
	for i in n - 1:
		for s in sides:
			quad(rings[i][s], rings[i + 1][s], rings[i + 1][s + 1], rings[i][s + 1])


## A tapered fluted shaft, base radius r0 at y0 up to r1 at y1, `flutes` grooves of depth d.
func fluted_shaft(at: Vector3, r0: float, r1: float, y0: float, y1: float, flutes: int, depth: float, per_flute: int = 6, rings: int = 3) -> void:
	var total := flutes * per_flute
	var ring_ids: Array[PackedInt32Array] = []
	for rr in rings + 1:
		var f := float(rr) / float(rings)
		var y := lerpf(y0, y1, f)
		var r := lerpf(r0, r1, f) + 0.012 * sin(f * PI)    # a hint of entasis
		var ids := PackedInt32Array()
		for s in total + 1:
			var a := TAU * float(s) / float(total)
			var fx := float(s % total) / float(per_flute)
			var fl := _flute(fx)
			var rad := r - depth * fl * (r / r0)
			var dfl := (_flute(fx + 0.01) - fl) / 0.01
			var drda := -depth * (r / r0) * dfl * float(flutes) / TAU
			var dir := Vector3(cos(a), 0.0, sin(a))
			var tang := Vector3(-sin(a), 0.0, cos(a))
			var nrm_v := (dir * rad - tang * drda).normalized()
			var shade := 1.0 - 0.55 * fl
			ids.append(vtx(at + dir * rad + Vector3(0, y, 0), nrm_v, Vector2(a * r, y), Color(shade, shade, shade)))
		ring_ids.append(ids)
	for rr in rings:
		for s in total:
			quad(ring_ids[rr][s], ring_ids[rr + 1][s], ring_ids[rr + 1][s + 1], ring_ids[rr][s + 1])


## Flute profile 0..1 (1 = deepest) for a position x in flute units; flat arris at the ends.
static func _flute(x: float) -> float:
	var f := x - floorf(x)
	if f < 0.12 or f > 0.88:
		return 0.0
	var u := (f - 0.12) / 0.76
	return sqrt(maxf(0.0, 1.0 - pow(2.0 * u - 1.0, 2.0)))


# ---------------------------------------------------------------- output

func to_mesh() -> ArrayMesh:
	var m := ArrayMesh.new()
	if idx.is_empty():
		return m
	var arr: Array = []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = pos
	arr[Mesh.ARRAY_NORMAL] = nrm
	arr[Mesh.ARRAY_TEX_UV] = uvs
	arr[Mesh.ARRAY_COLOR] = col
	arr[Mesh.ARRAY_INDEX] = idx
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return m
